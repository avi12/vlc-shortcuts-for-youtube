//! The typed shape of CDP messages: the commands a session sends and the frames it reads back.
//! Chrome sends more than is read here, so unknown fields are ignored.

use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::error::Result;

/// The event naming each execution context of a target.
pub const CONTEXT_CREATED_EVENT: &str = "Runtime.executionContextCreated";

/// The CDP commands sent.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
pub enum Method {
    /// Evaluates an expression.
    #[serde(rename = "Runtime.evaluate")]
    RuntimeEvaluate,
    /// Reports the contexts, one event each, before it replies.
    #[serde(rename = "Runtime.enable")]
    RuntimeEnable,
    /// The frames of a target.
    #[serde(rename = "Page.getFrameTree")]
    PageGetFrameTree,
}

/// A command with no parameters.
#[derive(Debug, Clone, Copy, Serialize)]
pub struct NoParams {}

/// The parameters of `Runtime.evaluate`.
#[derive(Debug, Clone, Copy, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EvaluateParams<'request> {
    expression: &'request str,
    #[serde(rename = "awaitPromise")]
    is_awaiting_promise: bool,
    #[serde(rename = "returnByValue")]
    should_return_by_value: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    context_id: Option<u64>,
}

impl<'request> EvaluateParams<'request> {
    /// Evaluates in the page's own context, awaiting a promise and returning its value.
    pub const fn awaited(expression: &'request str) -> Self {
        Self {
            expression,
            is_awaiting_promise: true,
            should_return_by_value: true,
            context_id: None,
        }
    }

    /// Evaluates in one frame's context, without waiting on the result.
    pub const fn in_context(expression: &'request str, context_id: u64) -> Self {
        Self {
            expression,
            is_awaiting_promise: false,
            should_return_by_value: false,
            context_id: Some(context_id),
        }
    }
}

#[derive(Serialize)]
struct Command<'request, P> {
    id: u64,
    method: Method,
    #[serde(rename = "params")]
    parameters: &'request P,
}

/// The message text of one command.
pub fn encode_command<P: Serialize>(id: u64, method: Method, parameters: &P) -> Result<String> {
    Ok(serde_json::to_string(&Command {
        id,
        method,
        parameters,
    })?)
}

/// One message from a target: the reply to a command (`id`) or an event (no `id`).
#[derive(Debug, Deserialize)]
pub struct Incoming {
    /// The command this answers.
    pub id: Option<u64>,
    /// The command's result.
    pub result: Option<Value>,
    /// Why the command failed.
    pub error: Option<Value>,
    /// The event's name.
    pub method: Option<String>,
    /// The event's parameters.
    pub params: Option<Value>,
}

/// What `Page.getFrameTree` returns.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FrameTreeResult {
    /// The target's top frame and its descendants.
    pub frame_tree: FrameTree,
}

/// One frame and its child frames.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FrameTree {
    /// The frame itself.
    pub frame: Frame,
    /// The frames inside it.
    #[serde(default)]
    pub child_frames: Vec<FrameTree>,
}

/// One frame.
#[derive(Debug, Deserialize)]
pub struct Frame {
    /// The frame id contexts refer to.
    pub id: String,
    /// The document's URL.
    pub url: String,
}

/// The parameters of the context-created event.
#[derive(Debug, Deserialize)]
pub struct ContextCreated {
    /// The new context.
    pub context: ExecutionContext,
}

/// One execution context.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExecutionContext {
    /// The id evaluations target.
    pub id: u64,
    /// Which frame it belongs to.
    #[serde(default)]
    pub aux_data: AuxData,
}

/// Where a context lives.
#[derive(Debug, Default, Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct AuxData {
    /// Whether it is the frame's own (main world) context.
    pub is_default: bool,
    /// The frame.
    pub frame_id: Option<String>,
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use crate::driver::cdp::protocol::*;

    #[test]
    fn commands_keep_their_wire_shape() -> Result<()> {
        let parameters = EvaluateParams::in_context("1", 3);
        let sent = encode_command(2, Method::RuntimeEvaluate, &parameters)?;
        let expected = json!({"id":2,"method":"Runtime.evaluate",
            "params":{"expression":"1","awaitPromise":false,"returnByValue":false,"contextId":3}});
        assert_eq!(serde_json::from_str::<Value>(&sent)?, expected);
        Ok(())
    }

    #[test]
    fn replies_parse_with_unknown_fields() -> Result<()> {
        let reply: Incoming = serde_json::from_str(r#"{"id":4,"result":{},"sessionId":"s"}"#)?;
        assert_eq!(reply.id, Some(4));
        Ok(())
    }
}
