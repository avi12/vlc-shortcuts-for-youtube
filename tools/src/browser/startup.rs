//! Claiming a debug port, so another browser's debugger never captures ours.

use std::net::{Ipv4Addr, TcpListener};
use std::time::Duration;

use dev_hot::types::Port;

use crate::error::{Error, Result};
use crate::launcher::log_event;

const MAX_PORT_PROBES: u16 = 50;
/// How long a browser gets to open its debugger and take the extension.
pub(super) const STARTUP_TIMEOUT: Duration = Duration::from_secs(60);

fn is_port_free(port: u16) -> bool {
    TcpListener::bind((Ipv4Addr::LOCALHOST, port)).is_ok()
}

/// The first free loopback port at or above `preferred`.
pub(super) fn claim_port(preferred: u16, label: &str) -> Result<Port> {
    let port = (preferred..preferred.saturating_add(MAX_PORT_PROBES))
        .find(|candidate| is_port_free(*candidate))
        .ok_or_else(|| Error::Browser(format!("no free {label} port from {preferred}")))?;
    let is_preferred_busy = port != preferred;
    if is_preferred_busy {
        log_event(&format!("{label} port {preferred} busy - using {port}"));
    }
    Ok(Port::new(port)?)
}
