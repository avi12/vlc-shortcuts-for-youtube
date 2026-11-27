//! The targets `/json/list` reports.

use std::fmt;

use serde::Deserialize;

const EXTENSION_URL_PREFIX: &str = "chrome-extension://";
const BACKGROUND_SCRIPT_PATH: &str = "/background.js";

/// The id of a CDP target, as `/json/list` reports it.
#[derive(Debug, Clone, PartialEq, Eq, PartialOrd, Ord, Hash, Deserialize)]
#[serde(transparent)]
pub struct TargetId(pub String);

impl fmt::Display for TargetId {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str(&self.0)
    }
}

/// What a target is.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Deserialize)]
#[serde(rename_all = "snake_case")]
#[non_exhaustive]
pub enum TargetKind {
    /// A tab or an extension page.
    Page,
    /// A cross-site frame, such as an embed on another site.
    Iframe,
    /// A service worker, such as the extension's background.
    ServiceWorker,
    /// Any other kind.
    #[serde(other)]
    Other,
}

impl TargetKind {
    /// Whether the target shows documents the content scripts could run on.
    pub const fn is_frame_host(self) -> bool {
        matches!(self, Self::Page | Self::Iframe)
    }
}

/// One entry of `/json/list`.
#[derive(Debug, Clone, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CdpTarget {
    /// The target id.
    pub id: TargetId,
    /// What the target is.
    #[serde(rename = "type")]
    pub kind: TargetKind,
    /// The target URL.
    #[serde(default)]
    pub url: String,
    /// Where to open a session; missing when another client holds the target.
    #[serde(default)]
    pub web_socket_debugger_url: Option<String>,
}

impl CdpTarget {
    /// Where to open a session, when no other client holds the target.
    pub fn debugger_url(&self) -> Option<&str> {
        self.web_socket_debugger_url.as_deref()
    }
}

/// Whether a target is an extension's background service worker.
pub fn is_background_worker(target: &CdpTarget) -> bool {
    target.kind == TargetKind::ServiceWorker
        && target.url.starts_with(EXTENSION_URL_PREFIX)
        && target.url.ends_with(BACKGROUND_SCRIPT_PATH)
}

#[cfg(test)]
mod tests {
    use crate::driver::cdp::target::*;
    use crate::error::Result;

    #[test]
    fn only_an_extension_service_worker_is_a_background_worker() -> Result<()> {
        let list: Vec<CdpTarget> = serde_json::from_str(
            r#"[{"id":"1","type":"service_worker","url":"chrome-extension://a/background.js"},
            {"id":"2","type":"service_worker","url":"https://www.youtube.com/background.js"},
            {"id":"3","type":"webview"}]"#,
        )?;
        let flags: Vec<bool> = list.iter().map(is_background_worker).collect();
        assert_eq!(flags, [true, false, false]);
        assert_eq!(list.last().map(|item| item.kind), Some(TargetKind::Other));
        Ok(())
    }
}
