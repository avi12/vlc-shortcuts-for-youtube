//! One CDP session: a WebSocket to one target, request/reply correlation by command id, and the
//! evaluations the reloads run in it.

use std::time::Duration;

use futures_util::{SinkExt, StreamExt};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use tokio::net::TcpStream;
use tokio_tungstenite::tungstenite::{Error as WebSocketError, Message};
use tokio_tungstenite::{connect_async, MaybeTlsStream, WebSocketStream};

use crate::driver::cdp::protocol::{
    encode_command, ContextCreated, EvaluateParams, ExecutionContext, FrameTree, FrameTreeResult,
    Incoming, Method, NoParams, CONTEXT_CREATED_EVENT,
};
use crate::driver::net::within;
use crate::error::{Error, Result};
use crate::refresh::PageRefresh;

const CONNECT_TIMEOUT: Duration = Duration::from_secs(3);
const REPLY_TIMEOUT: Duration = Duration::from_secs(5);

/// The part of a `Runtime.evaluate` result this client reads.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Outcome {
    /// Present only when the expression threw; printed as Chrome sent it.
    exception_details: Option<Value>,
}

/// One CDP session: a WebSocket to one target, a command counter and the contexts reported so far.
pub(super) struct Session {
    socket: WebSocketStream<MaybeTlsStream<TcpStream>>,
    next_id: u64,
    contexts: Vec<ExecutionContext>,
}

/// The ids of the frames in `tree` whose document the content scripts run on.
fn matching_frames(tree: FrameTree, refresh: &PageRefresh) -> Vec<String> {
    let mut pending = vec![tree];
    let mut ids = Vec::new();
    while let Some(FrameTree {
        frame,
        child_frames,
    }) = pending.pop()
    {
        if refresh.is_matching(&frame.url) {
            ids.push(frame.id);
        }
        pending.extend(child_frames);
    }
    ids
}

impl Session {
    async fn open(url: &str) -> Result<Self> {
        let (socket, _response) = within(
            CONNECT_TIMEOUT,
            "the CDP WebSocket handshake",
            connect_async(url),
        )
        .await?;
        Ok(Self {
            socket,
            next_id: 1,
            contexts: Vec::new(),
        })
    }

    async fn close(mut self) {
        self.socket.close(None).await.ok();
    }

    async fn call<P: Serialize + Sync>(&mut self, method: Method, parameters: &P) -> Result<Value> {
        let id = self.next_id;
        self.next_id += 1;
        let payload = encode_command(id, method, parameters)?;
        within(
            REPLY_TIMEOUT,
            "sending a CDP command",
            self.socket.send(Message::text(payload)),
        )
        .await?;
        within(REPLY_TIMEOUT, "a CDP reply", self.reply_to(id)).await
    }

    fn remember_context(&mut self, event: Incoming) {
        let is_context_event = event.method.as_deref() == Some(CONTEXT_CREATED_EVENT);
        let Some(params) = event.params.filter(|_| is_context_event) else {
            return;
        };
        if let Ok(ContextCreated { context }) = serde_json::from_value(params) {
            self.contexts.push(context);
        }
    }

    async fn reply_to(&mut self, id: u64) -> Result<Value> {
        while let Some(frame) = self.socket.next().await {
            let Message::Text(text) = frame? else {
                continue;
            };
            let reply: Incoming = serde_json::from_str(text.as_str())?;
            let is_other_reply = reply.id != Some(id);
            if is_other_reply {
                self.remember_context(reply);
                continue;
            }
            if let Some(error) = reply.error {
                return Err(Error::Protocol(format!("CDP error: {error}")));
            }
            return Ok(reply.result.unwrap_or(Value::Null));
        }
        Err(WebSocketError::ConnectionClosed.into())
    }

    /// Runs `expression` (awaited, by value) in the target at `url`; a thrown exception is an error.
    pub(super) async fn evaluate(url: &str, expression: &str) -> Result<()> {
        let mut session = Self::open(url).await?;
        let parameters = EvaluateParams::awaited(expression);
        let outcome = session.call(Method::RuntimeEvaluate, &parameters).await;
        session.close().await;
        let Outcome { exception_details } = serde_json::from_value(outcome?)?;
        if let Some(details) = exception_details {
            return Err(Error::Protocol(format!("evaluation threw: {details}")));
        }
        Ok(())
    }

    /// `Runtime.enable` replays one event per existing context before it replies, so the list is
    /// complete by then. CDP evaluates in a frame's own context regardless of the page's CSP.
    async fn refresh_frames(&mut self, refresh: &PageRefresh) -> Result<bool> {
        let result = self.call(Method::PageGetFrameTree, &NoParams {}).await?;
        let FrameTreeResult { frame_tree } = serde_json::from_value(result)?;
        let frames = matching_frames(frame_tree, refresh);
        self.call(Method::RuntimeEnable, &NoParams {}).await?;
        let targets: Vec<u64> = self
            .contexts
            .iter()
            .filter(|context| context.aux_data.is_default)
            .filter(|context| {
                let frame = context.aux_data.frame_id.as_ref();
                frame.is_some_and(|id| frames.contains(id))
            })
            .map(|context| context.id)
            .collect();
        for context_id in &targets {
            for expression in &refresh.expressions {
                let parameters = EvaluateParams::in_context(expression, *context_id);
                self.call(Method::RuntimeEvaluate, &parameters).await?;
            }
        }
        Ok(!targets.is_empty())
    }

    /// Hands the rebuilt scripts to every matching frame of the target at `url`; tells whether any
    /// was reached.
    pub(super) async fn refresh(url: &str, refresh: &PageRefresh) -> Result<bool> {
        let mut session = Self::open(url).await?;
        let outcome = session.refresh_frames(refresh).await;
        session.close().await;
        outcome
    }
}
