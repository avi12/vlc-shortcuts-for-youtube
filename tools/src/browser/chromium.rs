//! The installed Chrome or Opera on its dev profile, started through a Node launcher that loads the
//! extension over the browser's debugging pipe, and driven over its debugging port.

use std::path::{Path, PathBuf};
use std::process::Stdio;

use dev_hot::driver::cdp::CdpClient;
use dev_hot::refresh::MANIFEST_FILE;
use serde::Deserialize;
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::{Child, Command};
use tokio::time::timeout;

use crate::browser::startup::{claim_port, STARTUP_TIMEOUT};
use crate::browser::{language_argument, Browser, Launch, START_URL};
use crate::error::{Error, Result};
use crate::launcher::log_event;
use crate::profile::{self, Environment, CHROMIUM_PROFILE_NAME};

const LAUNCHER_SOURCE: &str = include_str!("../../assets/chromium-launcher.mjs");
const NODE_COMMAND: &str = "node";
/// 9222 is often taken by the user's own debuggable browser.
const CHROME_DEBUG_PORT: u16 = 9333;
const OPERA_DEBUG_PORT: u16 = 9340;
const OPERA_BINARY: &str = "opera.exe";
const CHROME_WINDOWS_BINARY: &str = "Google/Chrome/Application/chrome.exe";
const CHROME_WINDOWS_ROOTS: [&str; 3] = ["ProgramFiles", "ProgramFiles(x86)", "LOCALAPPDATA"];
const CHROME_MAC_BINARY: &str = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const OPERA_MAC_BINARY: &str = "/Applications/Opera.app/Contents/MacOS/Opera";
const CHROME_LINUX_BINARY: &str = "google-chrome";
const OPERA_LINUX_BINARY: &str = "opera";

#[derive(Deserialize)]
struct ManifestName {
    name: String,
}

/// The launcher's one line: whether the extension loaded.
#[derive(Deserialize)]
struct LoadReply {
    error: Option<String>,
}

fn version_numbers(name: &str) -> Option<Vec<u64>> {
    name.split('.').map(|part| part.parse().ok()).collect()
}

/// The newest versioned folder: the `opera.exe` at the install root is a launcher that hands off to
/// it and exits, which would read as the browser closing.
fn newest_version_directory(install: &Path) -> Option<PathBuf> {
    std::fs::read_dir(install)
        .ok()?
        .filter_map(std::result::Result::ok)
        .filter_map(|entry| {
            let numbers = version_numbers(entry.file_name().to_str()?)?;
            Some((numbers, entry.path()))
        })
        .max()
        .map(|(_numbers, path)| path)
}

fn find_binary(browser: Browser, environment: &Environment) -> Result<PathBuf> {
    let is_opera = browser == Browser::Opera;
    let found = if cfg!(windows) {
        if is_opera {
            let install = environment.directory("LOCALAPPDATA").join("Programs/Opera");
            newest_version_directory(&install).map(|directory| directory.join(OPERA_BINARY))
        } else {
            CHROME_WINDOWS_ROOTS
                .iter()
                .map(|root| environment.directory(root).join(CHROME_WINDOWS_BINARY))
                .find(|candidate| candidate.is_file())
        }
    } else if cfg!(target_os = "macos") {
        Some(PathBuf::from(if is_opera {
            OPERA_MAC_BINARY
        } else {
            CHROME_MAC_BINARY
        }))
    } else {
        Some(PathBuf::from(if is_opera {
            OPERA_LINUX_BINARY
        } else {
            CHROME_LINUX_BINARY
        }))
    };
    found.ok_or_else(|| Error::Browser(format!("could not find {}", browser.name())))
}

async fn wait_until_loaded(child: &mut Child) -> Result<LoadReply> {
    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| Error::Browser("the launcher has no stdout".to_owned()))?;
    let mut lines = BufReader::new(stdout).lines();
    let line = timeout(STARTUP_TIMEOUT, lines.next_line())
        .await
        .map_err(|_elapsed| Error::Browser("it never answered over its pipe".to_owned()))??
        .ok_or_else(|| Error::Browser("it exited before loading the extension".to_owned()))?;
    Ok(serde_json::from_str(&line)?)
}

pub(crate) async fn launch(launch: Launch<'_>) -> Result<(Child, CdpClient)> {
    let Launch {
        browser,
        profile_directory,
        extension_directory,
        environment,
    } = launch;
    profile::chromium::setup(profile_directory, browser, environment)?;
    let manifest = std::fs::read_to_string(extension_directory.join(MANIFEST_FILE))?;
    let ManifestName { name } = serde_json::from_str(&manifest)?;
    let is_opera = browser == Browser::Opera;
    let preferred = if is_opera {
        OPERA_DEBUG_PORT
    } else {
        CHROME_DEBUG_PORT
    };
    let port = claim_port(preferred, "debug")?;
    let mut command = Command::new(NODE_COMMAND);
    command
        .args(["--input-type=module", "--eval", LAUNCHER_SOURCE, "--"])
        .arg(find_binary(browser, environment)?)
        .arg(extension_directory)
        .arg(START_URL)
        .arg(format!("--user-data-dir={}", profile_directory.display()))
        .arg(format!("--profile-directory={CHROMIUM_PROFILE_NAME}"))
        .arg("--remote-debugging-address=127.0.0.1")
        .arg(format!("--remote-debugging-port={}", port.get()))
        .arg("--no-first-run")
        .arg("--no-default-browser-check")
        .arg("--disable-blink-features=AutomationControlled")
        .args(language_argument(environment));
    if is_opera {
        // An Opera without the pipe's load command still sideloads from the command line
        command.arg(format!(
            "--load-extension={}",
            extension_directory.display()
        ));
    }
    let mut child = command
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::inherit())
        .kill_on_drop(true)
        .spawn()?;
    if let Some(error) = wait_until_loaded(&mut child).await?.error {
        if !is_opera {
            return Err(Error::Browser(format!("loading the extension: {error}")));
        }
        log_event(&format!("Opera refused the pipe load: {error}"));
    }
    log_event(&format!("{} debug port {}", browser.name(), port.get()));
    Ok((child, CdpClient::new(port, name)))
}

#[cfg(test)]
mod tests {
    use crate::browser::chromium::*;

    #[test]
    fn versions_compare_by_number_and_other_folders_are_ignored() {
        assert!(version_numbers("100.0.1") > version_numbers("99.9.9"));
        assert_eq!(version_numbers("autoupdate"), None);
    }
}
