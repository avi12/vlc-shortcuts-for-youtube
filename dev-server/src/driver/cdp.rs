//! Chrome `DevTools` Protocol client: `/json` over plain HTTP on the debug port, and one WebSocket
//! per target. The extension is reloaded from `chrome://extensions`, whose private API reloads an
//! unpacked extension even while its service worker sleeps.

mod http;
pub mod protocol;
mod session;
mod target;

use std::time::Duration;

use futures_util::future::join_all;
use tokio::time::{sleep, timeout, Instant};

use self::http::Verb;
use self::session::Session;
pub use self::target::{is_background_worker, CdpTarget, TargetId, TargetKind};
use crate::driver::{BrowserDriver, PAGE_REFRESH_TIMEOUT};
use crate::error::{Error, Result};
use crate::refresh::PageRefresh;
use crate::types::Port;

const RELOAD_EXTENSION_SOURCE: &str = include_str!("../../assets/reload-extension.js");
const EXTENSIONS_PAGE_URL: &str = "chrome://extensions";
/// A freshly opened page offers no signal this client can subscribe to before it may already have
/// loaded, so its private API is retried until it answers.
const READY_ATTEMPTS: u32 = 25;
const READY_RETRY_DELAY: Duration = Duration::from_millis(200);
const BACKGROUND_START_TIMEOUT: Duration = Duration::from_secs(5);
const BACKGROUND_POLL_INTERVAL: Duration = Duration::from_millis(250);
const BACKGROUND_START_ATTEMPTS: u32 = 3;

/// A CDP client for one browser's debug port, reloading the extension of one name.
#[derive(Debug, Clone)]
pub struct CdpClient {
    port: Port,
    extension_name: String,
}

impl CdpClient {
    /// A client for the browser listening on `port`.
    pub const fn new(port: Port, extension_name: String) -> Self {
        Self {
            port,
            extension_name,
        }
    }

    /// All targets of the browser (`/json/list`).
    pub async fn list_targets(&self) -> Result<Vec<CdpTarget>> {
        let list = http::request(self.port, Verb::Get, "/json/list").await?;
        Ok(serde_json::from_str(&list)?)
    }

    async fn background_worker_ids(&self) -> Vec<TargetId> {
        let targets = self.list_targets().await.unwrap_or_default();
        targets
            .into_iter()
            .filter(is_background_worker)
            .map(|target| target.id)
            .collect()
    }

    async fn is_new_worker_started(&self, previous: &[TargetId]) -> bool {
        let deadline = Instant::now() + BACKGROUND_START_TIMEOUT;
        while Instant::now() < deadline {
            let ids = self.background_worker_ids().await;
            if ids.iter().any(|id| !previous.contains(id)) {
                return true;
            }
            sleep(BACKGROUND_POLL_INTERVAL).await;
        }
        false
    }

    async fn reload_once(&self) -> Result<()> {
        let path = format!("/json/new?{EXTENSIONS_PAGE_URL}");
        let opened = http::request(self.port, Verb::Put, &path).await?;
        let page: CdpTarget = serde_json::from_str(&opened)?;
        let name = serde_json::to_string(&self.extension_name)?;
        let expression = format!(
            "{RELOAD_EXTENSION_SOURCE}
globalThis.reloadExtension({name})"
        );
        let outcome = match page.debugger_url() {
            Some(url) => evaluate_when_ready(url, &expression).await,
            None => Err(Error::Protocol(
                "the extensions page has no debugger URL".to_owned(),
            )),
        };
        let close = format!("/json/close/{}", page.id);
        if let Err(error) = http::request(self.port, Verb::Get, &close).await {
            tracing::warn!("could not close the extensions page: {error}");
        }
        outcome
    }
}

async fn evaluate_when_ready(url: &str, expression: &str) -> Result<()> {
    let mut last = Error::Timeout("the extensions page");
    for _ in 0..READY_ATTEMPTS {
        match Session::evaluate(url, expression).await {
            Ok(()) => return Ok(()),
            Err(error) => last = error,
        }
        sleep(READY_RETRY_DELAY).await;
    }
    Err(last)
}

/// A closed, vanished or silent page never fails the batch.
async fn refresh_target(target: CdpTarget, refresh: &PageRefresh) -> bool {
    let Some(url) = target.debugger_url() else {
        return false;
    };
    match timeout(PAGE_REFRESH_TIMEOUT, Session::refresh(url, refresh)).await {
        Ok(Ok(is_reached)) => is_reached,
        Ok(Err(error)) => {
            tracing::warn!("CDP refresh of {} skipped: {error}", target.id);
            false
        }
        Err(_elapsed) => false,
    }
}

impl BrowserDriver for CdpClient {
    /// A reload that lands while the previous reload's service worker is still registering fails
    /// that registration and leaves the extension with no background at all, so each reload waits
    /// for a fresh worker and retries without one.
    async fn reload_extension(&self) -> Result<()> {
        for attempt in 1..=BACKGROUND_START_ATTEMPTS {
            let previous = self.background_worker_ids().await;
            self.reload_once().await?;
            if self.is_new_worker_started(&previous).await {
                return Ok(());
            }
            tracing::info!(
                "The extension's background didn't start (attempt {attempt}/{BACKGROUND_START_ATTEMPTS})"
            );
        }
        Ok(())
    }

    async fn refresh_pages(&self, refresh: &PageRefresh) -> Result<usize> {
        let pages = self
            .list_targets()
            .await?
            .into_iter()
            .filter(|target| target.kind.is_frame_host() && refresh.is_matching(&target.url));
        let outcomes = join_all(pages.map(|target| refresh_target(target, refresh))).await;
        Ok(outcomes.into_iter().filter(|reached| *reached).count())
    }
}
