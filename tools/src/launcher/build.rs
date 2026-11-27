//! The development build: a warm WXT worker, replaced when the project around the source changes,
//! and a byte-for-byte comparison of what it wrote.

use std::collections::BTreeMap;
use std::io::ErrorKind;
use std::path::{Path, PathBuf};
use std::time::Duration;

use dev_hot::changes::scope::BuildScope;
use dev_hot::orchestrator::{Build, Builder};
use dev_hot::refresh::PageRefresh;
use tokio::time::sleep;

use crate::browser::Browser;
use crate::error::{Error, Result};
use crate::launcher::wxt_worker::WxtWorker;

/// The browser holds the output files open, so a write can hit a transient Windows lock.
const TRANSIENT_LOCK_MARKERS: [&str; 2] = ["EPERM", "EBUSY"];
const MAX_BUILD_ATTEMPTS: u32 = 3;
const BUILD_RETRY_DELAY: Duration = Duration::from_millis(300);

type Snapshot = BTreeMap<PathBuf, Vec<u8>>;

pub(super) struct WxtBuilder {
    project_root: PathBuf,
    browser: Browser,
    worker: Option<WxtWorker>,
}

fn is_retryable(error: &Error, attempt: u32) -> bool {
    let text = error.to_string();
    attempt < MAX_BUILD_ATTEMPTS
        && TRANSIENT_LOCK_MARKERS
            .iter()
            .any(|marker| text.contains(marker))
}

/// Every file under `directory` with its bytes: WXT rewrites each output on every build, often
/// identically, so modified times can't tell a real change from a rewrite.
fn snapshot(directory: &Path) -> Result<Snapshot> {
    let mut files = Snapshot::new();
    let mut pending = vec![directory.to_path_buf()];
    while let Some(next) = pending.pop() {
        let entries = match std::fs::read_dir(next) {
            Ok(entries) => entries,
            Err(error) if error.kind() == ErrorKind::NotFound => continue,
            Err(error) => return Err(error.into()),
        };
        for entry in entries {
            let path = entry?.path();
            if path.is_dir() {
                pending.push(path);
                continue;
            }
            let bytes = std::fs::read(&path)?;
            files.insert(path, bytes);
        }
    }
    Ok(files)
}

impl WxtBuilder {
    pub(super) const fn new(project_root: PathBuf, browser: Browser) -> Self {
        Self {
            project_root,
            browser,
            worker: None,
        }
    }

    async fn build_once(&mut self) -> Result<()> {
        let warm = self
            .worker
            .take()
            .and_then(|mut worker| worker.is_alive().then_some(worker));
        let mut worker = match warm {
            Some(worker) => worker,
            None => WxtWorker::spawn(&self.project_root).await?,
        };
        let outcome = worker.build(&self.project_root, self.browser).await;
        self.worker = Some(worker);
        outcome
    }

    pub(super) async fn build_with_lock_retry(&mut self) -> Result<()> {
        let mut attempt = 1;
        loop {
            match self.build_once().await {
                Err(error) if is_retryable(&error, attempt) => sleep(BUILD_RETRY_DELAY).await,
                outcome => return outcome,
            }
            attempt += 1;
        }
    }

    async fn compared_build(&mut self) -> Result<Build> {
        let output = self.browser.output_directory(&self.project_root);
        let before = snapshot(&output)?;
        self.build_with_lock_retry().await?;
        Ok(Build {
            is_changed: before != snapshot(&output)?,
            refresh: PageRefresh::read(&output)?,
        })
    }
}

impl Builder for WxtBuilder {
    async fn build(&mut self, scope: BuildScope) -> dev_hot::Result<Build> {
        let is_fresh_worker_needed = scope > BuildScope::Source;
        if is_fresh_worker_needed {
            self.worker = None;
        }
        self.compared_build()
            .await
            .map_err(|error| dev_hot::Error::Host {
                message: error.to_string(),
            })
    }
}

#[cfg(test)]
mod tests {
    use crate::launcher::build::*;

    #[test]
    fn a_snapshot_follows_the_bytes_not_the_rewrite() -> Result<()> {
        let root = std::env::temp_dir().join(format!("dev-snapshot-{}", std::process::id()));
        std::fs::create_dir_all(root.join("nested"))?;
        let file = root.join("nested").join("a.js");
        std::fs::write(&file, "1")?;
        let first = snapshot(&root)?;
        std::fs::write(&file, "1")?;
        let rewritten = snapshot(&root)?;
        std::fs::write(&file, "2")?;
        let edited = snapshot(&root)?;
        std::fs::remove_dir_all(&root)?;
        assert_eq!(first, rewritten);
        assert_ne!(first, edited);
        Ok(())
    }
}
