//! How the dev server talks to the running browser: the Chrome `DevTools` Protocol for Chromium,
//! Firefox's remote debugging protocol (RDP) for Firefox. The extension needs no dev-only
//! permission or code.

pub mod cdp;
mod net;
pub mod rdp;

use std::future::Future;
use std::time::Duration;

use crate::error::Result;
use crate::refresh::PageRefresh;

/// A page that stops answering can't hold up the refresh of the others.
const PAGE_REFRESH_TIMEOUT: Duration = Duration::from_secs(10);

/// Reload operations on a running browser.
pub trait BrowserDriver: Send + Sync {
    /// Loads the freshly built extension into the browser.
    fn reload_extension(&self) -> impl Future<Output = Result<()>> + Send;

    /// Evaluates the rebuilt page scripts into every open page the content scripts run on, without
    /// reloading it; returns how many pages were reached.
    fn refresh_pages(&self, refresh: &PageRefresh) -> impl Future<Output = Result<usize>> + Send;
}
