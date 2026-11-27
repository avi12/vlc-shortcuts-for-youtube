//! `devtool dev`: set up the isolated profile, build, launch the browser with the extension and
//! rebuild on every save until the browser closes or Ctrl+C.

mod build;
mod log;
mod wxt_worker;

use std::path::{Path, PathBuf};
use std::time::Duration;

use clap::Args;
use dev_hot::changes::scope::{ENV_FILES_MOST_SPECIFIC_FIRST, SOURCE_DIRECTORY};
use dev_hot::changes::watcher::{self, ChangeBatch, WatchConfig};
use dev_hot::driver::BrowserDriver;
use dev_hot::orchestrator;
use dev_hot::types::RelPath;
use tokio::process::Child;
use tokio::sync::mpsc;
use tokio_util::sync::CancellationToken;

use self::build::WxtBuilder;
pub(crate) use self::log::log_event;
use self::log::{install_log_layer, open_dev_log};
use crate::browser::{chromium, firefox, Browser, Launch};
use crate::error::Result;
use crate::profile::{self, Environment};

/// Build inputs besides the source and the env files.
const WATCHED_CONFIG_FILES: [&str; 3] = ["wxt.config.ts", "package.json", "bun.lock"];
const WATCH_POLL_INTERVAL: Duration = Duration::from_millis(500);
/// Doubles as the write-settle window, so a build never reads a half-written source.
const REBUILD_DEBOUNCE: Duration = Duration::from_millis(800);

#[derive(Debug, Args)]
pub(crate) struct DevArgs {
    /// Develop in Firefox instead of Chrome.
    #[arg(long = "firefox", conflicts_with = "is_opera")]
    is_firefox: bool,
    /// Develop in Opera instead of Chrome.
    #[arg(long = "opera")]
    is_opera: bool,
    /// Launch Firefox without automation flags, to sign in to Google.
    #[arg(long = "no-marionette", requires = "is_firefox")]
    is_marionette_disabled: bool,
    /// The extension project.
    #[arg(long, default_value = ".")]
    project_root: PathBuf,
}

impl DevArgs {
    const fn browser(&self) -> Browser {
        if self.is_firefox {
            return Browser::Firefox;
        }
        if self.is_opera {
            return Browser::Opera;
        }
        Browser::Chrome
    }
}

fn watch_config(root: &Path) -> WatchConfig {
    let paths = std::iter::once(SOURCE_DIRECTORY)
        .chain(WATCHED_CONFIG_FILES)
        .chain(ENV_FILES_MOST_SPECIFIC_FIRST)
        .map(RelPath::new)
        .collect();
    WatchConfig {
        root: root.to_path_buf(),
        paths,
        poll_interval: WATCH_POLL_INTERVAL,
        debounce: REBUILD_DEBOUNCE,
    }
}

/// Everything the rebuild loop runs on, whichever browser it drives.
struct Session {
    batches: mpsc::Receiver<ChangeBatch>,
    builder: WxtBuilder,
    shutdown: CancellationToken,
}

impl Session {
    /// Rebuilds on every save until the dev browser closes or Ctrl+C.
    async fn serve(self, browser: Browser, mut process: Child, driver: impl BrowserDriver) {
        log_event(&format!(
            "{} launched with the extension sideloaded - watching for changes",
            browser.name()
        ));
        let rebuilds = orchestrator::run(self.batches, self.builder, driver, self.shutdown.clone());
        tokio::select! {
            () = rebuilds => {}
            _ = process.wait() => log_event("The browser closed"),
            _ = tokio::signal::ctrl_c() => log_event("Interrupted"),
        }
        self.shutdown.cancel();
    }
}

pub(crate) async fn run(args: DevArgs) -> Result<()> {
    let browser = args.browser();
    let project_root = std::path::absolute(&args.project_root)?;
    open_dev_log(&project_root, browser.slug())?;
    install_log_layer()?;

    let environment = Environment::read(&project_root);
    let profile_directory = profile::directory(&project_root, browser);
    profile::stop_leftover_instances(&profile_directory).await?;

    log_event(&format!(
        "Building for {} (development, inline source maps)",
        browser.name()
    ));
    // Watching starts before the build, so a save made while the browser starts is not lost
    let shutdown = CancellationToken::new();
    let batches = watcher::spawn(watch_config(&project_root), shutdown.clone())?;
    let mut builder = WxtBuilder::new(project_root.clone(), browser);
    builder.build_with_lock_retry().await?;

    let extension_directory = browser.output_directory(&project_root);
    let launch = Launch {
        browser,
        profile_directory: &profile_directory,
        extension_directory: &extension_directory,
        environment: &environment,
    };
    let session = Session {
        batches,
        builder,
        shutdown,
    };
    if browser == Browser::Firefox {
        let (process, driver) = firefox::launch(launch, !args.is_marionette_disabled).await?;
        session.serve(browser, process, driver).await;
    } else {
        let (process, driver) = chromium::launch(launch).await?;
        session.serve(browser, process, driver).await;
    }
    profile::stop_leftover_instances(&profile_directory).await?;
    log_event("Dev server stopped");
    Ok(())
}
