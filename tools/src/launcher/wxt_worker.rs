//! The warm Node process that runs `wxt`'s `build()`, so a rebuild skips the cold start.

use std::path::{Path, PathBuf};
use std::process::Stdio;

use serde::{Deserialize, Serialize};
use tokio::fs;
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader, Lines};
use tokio::process::{Child, ChildStderr, ChildStdin, ChildStdout, Command};

use crate::browser::Browser;
use crate::error::{Error, Result};
use crate::launcher::log::log_output;

const MANIFEST_VERSION: u8 = 3;

const WORKER_SOURCE: &str = include_str!("../../assets/wxt-build-worker.mjs");
const WORKER_FILE: &str = "wxt-build-worker.mjs";
/// Inside `node_modules`, so the script's `import "wxt"` resolves.
const WORKER_DIRECTORY: &str = "node_modules/.cache/dev-server";
const NODE_COMMAND: &str = "node";
const DEVELOPMENT_MODE: &str = "development";
/// Read by `wxt.config.ts`: inline source maps, which the browser's debugger can always load.
const INLINE_SOURCEMAPS_VARIABLE: &str = "WXT_INLINE_SOURCEMAPS";

/// The config handed to `build()`.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct WorkerRequest<'request> {
    root: &'request Path,
    browser: &'static str,
    mode: &'static str,
    manifest_version: u8,
    out_dir_template: &'static str,
}

/// Forwards the worker's progress and errors into the dev log.
async fn forward_output(stderr: ChildStderr) {
    let mut lines = BufReader::new(stderr).split(b'\n');
    while let Ok(Some(line)) = lines.next_segment().await {
        log_output(String::from_utf8_lossy(&line).trim_end());
    }
}

#[derive(Deserialize)]
#[serde(tag = "type", rename_all = "camelCase")]
#[serde(deny_unknown_fields)]
enum WorkerReply {
    Done,
    Failed { message: String },
}

pub(super) struct WxtWorker {
    process: Child,
    stdin: ChildStdin,
    stdout_lines: Lines<BufReader<ChildStdout>>,
}

async fn ensure_script(project_root: &Path) -> Result<PathBuf> {
    let directory = project_root.join(WORKER_DIRECTORY);
    let script = directory.join(WORKER_FILE);
    fs::create_dir_all(&directory).await?;
    fs::write(&script, WORKER_SOURCE).await?;
    Ok(script)
}

impl WxtWorker {
    pub(super) async fn spawn(project_root: &Path) -> Result<Self> {
        let script = ensure_script(project_root).await?;
        let mut process = Command::new(NODE_COMMAND)
            .arg(&script)
            .current_dir(project_root)
            .env(INLINE_SOURCEMAPS_VARIABLE, "1")
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .kill_on_drop(true)
            .spawn()?;
        let (Some(stdin), Some(stdout), Some(stderr)) = (
            process.stdin.take(),
            process.stdout.take(),
            process.stderr.take(),
        ) else {
            return Err(Error::Build("the WXT worker has no stdio".to_owned()));
        };
        tokio::spawn(forward_output(stderr));
        Ok(Self {
            process,
            stdin,
            stdout_lines: BufReader::new(stdout).lines(),
        })
    }

    pub(super) fn is_alive(&mut self) -> bool {
        matches!(self.process.try_wait(), Ok(None))
    }

    pub(super) async fn build(&mut self, project_root: &Path, browser: Browser) -> Result<()> {
        let line = serde_json::to_string(&WorkerRequest {
            root: project_root,
            browser: browser.slug(),
            mode: DEVELOPMENT_MODE,
            manifest_version: MANIFEST_VERSION,
            out_dir_template: browser.output_directory_template(),
        })?;
        self.stdin.write_all(line.as_bytes()).await?;
        self.stdin.write_all(b"\n").await?;
        self.stdin.flush().await?;
        let Some(reply) = self.stdout_lines.next_line().await? else {
            return Err(Error::Build("the WXT worker exited mid-build".to_owned()));
        };
        match serde_json::from_str::<WorkerReply>(&reply)? {
            WorkerReply::Done => Ok(()),
            WorkerReply::Failed { message } => Err(Error::Build(message)),
        }
    }
}
