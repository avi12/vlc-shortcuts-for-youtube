//! Firefox's remote debugging protocol: the extension is installed as a temporary add-on (which
//! needs no automation flags) and each open page is evaluated into through its tab's web console.
//! One connection serves one operation and is dropped afterwards.

mod connection;
mod packet;

use std::path::PathBuf;

use serde_json::{json, Value};
use tokio::time::timeout;

use self::connection::Connection;
pub use self::packet::{encode_packet, PacketDecoder};
use crate::driver::{BrowserDriver, PAGE_REFRESH_TIMEOUT};
use crate::error::{Error, Result};
use crate::refresh::PageRefresh;
use crate::types::Port;

const ROOT_ACTOR: &str = "root";
const EVALUATION_RESULT_TYPE: &str = "evaluationResult";

/// A client of one Firefox's debugger server, installing the extension from one build output.
#[derive(Debug, Clone)]
pub struct RdpClient {
    port: Port,
    extension_directory: PathBuf,
}

/// The string at `pointer`, or a protocol error naming what is missing.
fn text_at(packet: &Value, pointer: &'static str) -> Result<String> {
    packet
        .pointer(pointer)
        .and_then(Value::as_str)
        .map(str::to_owned)
        .ok_or_else(|| Error::Protocol(format!("no {pointer} in {packet}")))
}

/// The string a packet holds under `key`.
fn field<'packet>(packet: &'packet Value, key: &str) -> Option<&'packet str> {
    packet.get(key).and_then(Value::as_str)
}

/// A tab's web console evaluates in the page's own context regardless of the page's CSP. Each
/// evaluation replies at once with an id, and later with its result as an event.
async fn refresh_tab(connection: &mut Connection, tab: &str, expressions: &[String]) -> Result<()> {
    let target = connection
        .request(json!({ "to": tab, "type": "getTarget" }))
        .await?;
    let console = text_at(&target, "/frame/consoleActor")?;
    for expression in expressions {
        let evaluation = json!({ "to": console, "type": "evaluateJSAsync", "text": expression });
        let reply = connection.request(evaluation).await?;
        let result_id = text_at(&reply, "/resultID")?;
        connection
            .wait_for(|packet| {
                field(packet, "type") == Some(EVALUATION_RESULT_TYPE)
                    && field(packet, "resultID") == Some(result_id.as_str())
            })
            .await?;
    }
    Ok(())
}

impl RdpClient {
    /// A client for the debugger server on `port`.
    pub const fn new(port: Port, extension_directory: PathBuf) -> Self {
        Self {
            port,
            extension_directory,
        }
    }
}

impl BrowserDriver for RdpClient {
    /// Installing an installed temporary add-on again is how Firefox reloads it.
    async fn reload_extension(&self) -> Result<()> {
        let mut connection = Connection::open(self.port).await?;
        let root = connection
            .request(json!({ "to": ROOT_ACTOR, "type": "getRoot" }))
            .await?;
        let addons = text_at(&root, "/addonsActor")?;
        let install = json!({
            "to": addons,
            "type": "installTemporaryAddon",
            "addonPath": self.extension_directory,
        });
        let reply = connection.request(install).await?;
        text_at(&reply, "/addon/id")?;
        Ok(())
    }

    async fn refresh_pages(&self, refresh: &PageRefresh) -> Result<usize> {
        let mut connection = Connection::open(self.port).await?;
        let reply = connection
            .request(json!({ "to": ROOT_ACTOR, "type": "listTabs" }))
            .await?;
        let tabs = reply.get("tabs").and_then(Value::as_array);
        let matching = tabs
            .into_iter()
            .flatten()
            .filter(|tab| refresh.is_matching(field(tab, "url").unwrap_or_default()))
            .filter_map(|tab| field(tab, "actor"));
        let mut reached = 0;
        for tab in matching {
            let refreshing = refresh_tab(&mut connection, tab, &refresh.expressions);
            match timeout(PAGE_REFRESH_TIMEOUT, refreshing).await {
                Ok(Ok(())) => reached += 1,
                Ok(Err(error)) => tracing::warn!("RDP refresh of a tab skipped: {error}"),
                Err(_elapsed) => tracing::warn!("a tab stopped answering"),
            }
        }
        Ok(reached)
    }
}
