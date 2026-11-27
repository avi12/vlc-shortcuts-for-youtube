//! The installed Firefox on its dev profile: the extension installed as a temporary add-on over
//! its debugger server (RDP). Marionette and the Remote Agent are on by default, so automation tools
//! can attach; both set `navigator.webdriver`, which makes Google refuse sign-in, so they can be
//! left off.

use std::path::PathBuf;
use std::process::Stdio;
use std::time::Duration;

use dev_hot::driver::rdp::RdpClient;
use dev_hot::driver::BrowserDriver;
use dev_hot::refresh::MANIFEST_FILE;
use serde::Deserialize;
use tokio::process::{Child, Command};
use tokio::time::{sleep, Instant};

use crate::browser::startup::{claim_port, STARTUP_TIMEOUT};
use crate::browser::{language_argument, Launch, START_URL};
use crate::error::{Error, Result};
use crate::launcher::log_event;
use crate::profile::{self, Environment};

const PREFERRED_DEBUGGER_PORT: u16 = 6000;
const PREFERRED_REMOTE_AGENT_PORT: u16 = 9230;
/// Lets automation tools reach privileged pages, such as the extension's storage.
const SYSTEM_ACCESS_VARIABLE: &str = "MOZ_REMOTE_ALLOW_SYSTEM_ACCESS";
const CONNECT_RETRY_DELAY: Duration = Duration::from_millis(500);
const MAC_BINARY: &str = "/Applications/Firefox.app/Contents/MacOS/firefox";
const LINUX_BINARY: &str = "firefox";
const WINDOWS_BINARY_PATH: &str = "Mozilla Firefox/firefox.exe";
const PROGRAM_FILES_VARIABLES: [&str; 2] = ["ProgramFiles", "ProgramFiles(x86)"];

#[derive(Deserialize)]
struct Manifest {
    browser_specific_settings: BrowserSettings,
}

#[derive(Deserialize)]
struct BrowserSettings {
    gecko: Gecko,
}

#[derive(Deserialize)]
struct Gecko {
    id: String,
}

fn find_firefox(environment: &Environment) -> Result<PathBuf> {
    if cfg!(target_os = "macos") {
        return Ok(PathBuf::from(MAC_BINARY));
    }
    if !cfg!(windows) {
        return Ok(PathBuf::from(LINUX_BINARY));
    }
    PROGRAM_FILES_VARIABLES
        .iter()
        .map(|root| environment.directory(root).join(WINDOWS_BINARY_PATH))
        .find(|candidate| candidate.is_file())
        .ok_or_else(|| Error::Browser("could not find Firefox".to_owned()))
}

/// The debugger server opens some time after the process starts.
async fn install_when_ready(driver: &RdpClient, process: &mut Child) -> Result<()> {
    let deadline = Instant::now() + STARTUP_TIMEOUT;
    loop {
        let Err(error) = driver.reload_extension().await else {
            return Ok(());
        };
        let is_out_of_time = Instant::now() >= deadline;
        let is_exited = process.try_wait()?.is_some();
        if is_out_of_time || is_exited {
            return Err(error.into());
        }
        sleep(CONNECT_RETRY_DELAY).await;
    }
}

pub(crate) async fn launch(
    launch: Launch<'_>,
    is_marionette_enabled: bool,
) -> Result<(Child, RdpClient)> {
    let Launch {
        profile_directory,
        extension_directory,
        environment,
        ..
    } = launch;
    let manifest = std::fs::read_to_string(extension_directory.join(MANIFEST_FILE))?;
    let manifest: Manifest = serde_json::from_str(&manifest)?;
    let gecko_id = manifest.browser_specific_settings.gecko.id;
    profile::firefox::setup(profile_directory, environment, &gecko_id)?;
    let port = claim_port(PREFERRED_DEBUGGER_PORT, "Firefox debugger")?;
    let mut command = Command::new(find_firefox(environment)?);
    command
        .arg("-profile")
        .arg(profile_directory)
        .args(["-no-remote", "--allow-downgrade", "-start-debugger-server"])
        .arg(port.get().to_string())
        .args(language_argument(environment));
    if cfg!(windows) {
        // Keeps the launched process alive as long as the browser, so its exit means "closed"
        command.arg("-wait-for-browser");
    }
    if is_marionette_enabled {
        let agent = claim_port(PREFERRED_REMOTE_AGENT_PORT, "Firefox Remote Agent")?;
        command
            .arg("--marionette")
            .arg(format!("--remote-debugging-port={}", agent.get()))
            .env(SYSTEM_ACCESS_VARIABLE, "1");
        log_event(&format!("Firefox Remote Agent port {}", agent.get()));
    }
    let mut process = command
        .args(["-url", START_URL])
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .kill_on_drop(true)
        .spawn()?;
    let driver = RdpClient::new(port, extension_directory.to_path_buf());
    install_when_ready(&driver, &mut process).await?;
    Ok((process, driver))
}
