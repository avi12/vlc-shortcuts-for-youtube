//! The hot loop of the extension dev server: watch the project, rebuild on save, reload the
//! extension over the browser's own debugging protocol and evaluate the rebuilt page scripts into
//! the open pages, which never reload.

pub mod changes;
pub mod driver;
pub mod error;
pub mod orchestrator;
pub mod refresh;
pub mod types;

pub use error::{Error, Result};
