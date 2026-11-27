//! The log of a session, `[2:05:33 PM] message`, mirrored to `.dev-logs/<browser>.log` so build
//! output and errors survive the process being killed. The previous session is kept as
//! `.prev.log`, and the file rotates once it grows past its limit.

use std::fmt::{self, Debug, Write as _};
use std::fs::{File, OpenOptions};
use std::io::Write as _;
use std::path::{Path, PathBuf};
use std::sync::{Mutex, PoisonError};

use jiff::Zoned;
use tracing::field::{Field, Visit};
use tracing::{Event, Level, Subscriber};
use tracing_subscriber::layer::{Context, Layer, SubscriberExt};

use crate::error::{Error, Result};

const MESSAGE_FIELD: &str = "message";
const LOG_DIRECTORY: &str = ".dev-logs";
const MAX_LOG_BYTES: usize = 1_000_000;
const MAX_ENTRY_CHARS: usize = 2000;

static DEV_LOG: Mutex<Option<DevLog>> = Mutex::new(None);

struct DevLog {
    path: PathBuf,
    previous_path: PathBuf,
    file: File,
    bytes: usize,
}

impl DevLog {
    fn open(path: PathBuf) -> std::io::Result<Self> {
        let previous_path = path.with_extension("prev.log");
        // A locked previous log is no reason to fail: the current one is truncated instead
        std::fs::rename(&path, &previous_path).ok();
        let file = OpenOptions::new()
            .write(true)
            .create(true)
            .truncate(true)
            .open(&path)?;
        Ok(Self {
            path,
            previous_path,
            file,
            bytes: 0,
        })
    }

    fn append(&mut self, line: &str) -> std::io::Result<()> {
        let is_full = self.bytes + line.len() > MAX_LOG_BYTES;
        if is_full {
            std::fs::copy(&self.path, &self.previous_path)?;
            self.file = File::create(&self.path)?;
            self.bytes = 0;
        }
        writeln!(self.file, "{line}")?;
        self.bytes += line.len();
        Ok(())
    }
}

/// Starts the session's log file.
pub(super) fn open_dev_log(project_root: &Path, name: &str) -> Result<()> {
    let directory = project_root.join(LOG_DIRECTORY);
    std::fs::create_dir_all(&directory)?;
    let log = DevLog::open(directory.join(format!("{name}.log")))?;
    let path = log.path.display().to_string();
    *DEV_LOG.lock().unwrap_or_else(PoisonError::into_inner) = Some(log);
    log_event(&format!("Dev log -> {path}"));
    Ok(())
}

fn truncated(text: &str) -> String {
    let mut characters = text.chars();
    let kept: String = characters.by_ref().take(MAX_ENTRY_CHARS).collect();
    if characters.next().is_none() {
        return kept;
    }
    format!("{kept} ...[truncated]")
}

fn append_to_dev_log(line: &str) {
    let mut log = DEV_LOG.lock().unwrap_or_else(PoisonError::into_inner);
    if let Some(log) = log.as_mut() {
        // Logging must never take the dev server down
        log.append(line).ok();
    }
}

/// Prints a line of a child process as it is.
pub(super) fn log_output(line: &str) {
    println!("{line}");
    append_to_dev_log(&truncated(line));
}

/// Prints one timestamped line.
pub(crate) fn log_event(message: &str) {
    let line = format!("[{}] {message}", Zoned::now().strftime("%-I:%M:%S %p"));
    println!("{line}");
    append_to_dev_log(&truncated(&line));
}

#[derive(Default)]
struct MessageVisitor {
    text: String,
}

impl Visit for MessageVisitor {
    fn record_debug(&mut self, field: &Field, value: &dyn Debug) {
        let is_message = field.name() == MESSAGE_FIELD;
        if is_message {
            // Writing into a String cannot fail
            let _ = write!(self.text, "{value:?}");
        }
    }
}

impl fmt::Display for MessageVisitor {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str(&self.text)
    }
}

struct PrintLayer;

impl<S: Subscriber> Layer<S> for PrintLayer {
    fn on_event(&self, event: &Event<'_>, _context: Context<'_, S>) {
        let mut visitor = MessageVisitor::default();
        event.record(&mut visitor);
        let level = *event.metadata().level();
        let is_warning_or_worse = level <= Level::WARN;
        if is_warning_or_worse {
            log_event(&format!("{level} {visitor}"));
            return;
        }
        log_event(&visitor.to_string());
    }
}

/// Routes the library's `tracing` events through [`log_event`].
pub(super) fn install_log_layer() -> Result<()> {
    tracing::subscriber::set_global_default(tracing_subscriber::registry().with(PrintLayer))
        .map_err(|error| Error::Logging(error.to_string()))
}

#[cfg(test)]
mod tests {
    use crate::launcher::log::*;

    #[test]
    fn only_long_entries_are_truncated() {
        assert_eq!(truncated("short"), "short");
        let long = "a".repeat(MAX_ENTRY_CHARS + 1);
        assert!(truncated(&long).ends_with("a ...[truncated]"));
    }

    #[test]
    fn a_new_session_keeps_the_previous_log() -> Result<()> {
        let path = std::env::temp_dir().join(format!("dev-log-{}.log", std::process::id()));
        DevLog::open(path.clone())?.append("first")?;
        let second = DevLog::open(path.clone())?;
        let previous = std::fs::read_to_string(&second.previous_path)?;
        std::fs::remove_file(&path)?;
        std::fs::remove_file(&second.previous_path)?;
        assert_eq!(previous, "first\n");
        Ok(())
    }
}
