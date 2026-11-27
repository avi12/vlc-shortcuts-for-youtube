//! One RDP connection: framing, request/reply correlation by actor, and a bounded queue of packets
//! nobody asked for yet.

use std::collections::VecDeque;
use std::time::Duration;

use serde_json::Value;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpStream;
use tokio::time::Instant;

use super::packet::{encode_packet, PacketDecoder};
use super::ROOT_ACTOR;
use crate::driver::net::{loopback, until, within};
use crate::error::{Error, Result};
use crate::types::Port;

const REPLY_TIMEOUT: Duration = Duration::from_secs(5);
const READ_CHUNK_BYTES: usize = 8192;
const MAX_QUEUED_PACKETS: usize = 512;

/// One RDP connection: framing, a bounded queue of packets nobody asked for yet, and deadlines.
#[derive(Debug)]
pub(super) struct Connection {
    stream: TcpStream,
    decoder: PacketDecoder,
    queue: VecDeque<Value>,
}

/// A reply comes from the actor the request went to and, unlike an event, carries no type.
fn is_reply_from(packet: &Value, actor: &Value) -> bool {
    packet.get("from") == Some(actor) && packet.get("type").is_none()
}

impl Connection {
    /// Connects to `port` and waits for the root actor's greeting.
    pub(super) async fn open(port: Port) -> Result<Self> {
        let connecting = TcpStream::connect(loopback(port));
        let mut connection = Self {
            stream: within(REPLY_TIMEOUT, "the RDP connection", connecting).await?,
            decoder: PacketDecoder::default(),
            queue: VecDeque::new(),
        };
        connection
            .wait_for(|packet| packet.get("from").and_then(Value::as_str) == Some(ROOT_ACTOR))
            .await?;
        Ok(connection)
    }

    async fn fill(&mut self, deadline: Instant) -> Result<()> {
        let mut chunk = [0_u8; READ_CHUNK_BYTES];
        let read = until(deadline, "an RDP packet", self.stream.read(&mut chunk)).await?;
        let bytes = chunk.get(..read).unwrap_or_default();
        if bytes.is_empty() {
            return Err(Error::Protocol("the RDP socket closed".to_owned()));
        }
        for packet in self.decoder.push(bytes)? {
            let is_queue_full = self.queue.len() >= MAX_QUEUED_PACKETS;
            if is_queue_full {
                self.queue.pop_front();
            }
            self.queue.push_back(packet);
        }
        Ok(())
    }

    /// The first packet that `matches`, within the reply timeout.
    pub(super) async fn wait_for(
        &mut self,
        matches: impl Fn(&Value) -> bool + Send,
    ) -> Result<Value> {
        let deadline = Instant::now() + REPLY_TIMEOUT;
        loop {
            let found = self.queue.iter().position(&matches);
            if let Some(packet) = found.and_then(|index| self.queue.remove(index)) {
                return Ok(packet);
            }
            self.fill(deadline).await?;
        }
    }

    /// Sends `packet` and waits for its actor's reply; a reply naming an error is one.
    pub(super) async fn request(&mut self, packet: Value) -> Result<Value> {
        let bytes = encode_packet(&packet)?;
        within(
            REPLY_TIMEOUT,
            "sending an RDP packet",
            self.stream.write_all(&bytes),
        )
        .await?;
        let actor = packet.get("to").unwrap_or(&Value::Null);
        let reply = self
            .wait_for(|incoming| is_reply_from(incoming, actor))
            .await?;
        if let Some(error) = reply.get("error") {
            return Err(Error::Protocol(format!("RDP error: {error} in {reply}")));
        }
        Ok(reply)
    }
}
