//! The one loop: a batch of saves, then a build, then a reload. Strictly one build at a time:
//! saves landing during a build queue up and are merged into a single follow-up run.

use std::future::Future;

use tokio::sync::mpsc;
use tokio::time::Instant;
use tokio_util::sync::CancellationToken;

use crate::changes::scope::BuildScope;
use crate::changes::watcher::ChangeBatch;
use crate::driver::BrowserDriver;
use crate::error::Result;
use crate::refresh::PageRefresh;

/// What one build left in the directory the browser loaded the extension from.
#[derive(Debug)]
pub struct Build {
    /// Whether any output file's bytes differ from the build before.
    pub is_changed: bool,
    /// What the open pages are handed.
    pub refresh: PageRefresh,
}

/// Builds the extension into the directory the browser loaded it from.
pub trait Builder: Send {
    /// Runs one development build.
    fn build(&mut self, scope: BuildScope) -> impl Future<Output = Result<Build>> + Send;
}

/// The number of pages refreshed, or nothing when the build changed nothing.
async fn apply<B: Builder, D: BrowserDriver>(
    builder: &mut B,
    driver: &D,
    scope: BuildScope,
) -> Result<Option<usize>> {
    let build = builder.build(scope).await?;
    let is_env_change = scope == BuildScope::Environment;
    let is_reload_needed = build.is_changed || is_env_change;
    if !is_reload_needed {
        return Ok(None);
    }
    driver.reload_extension().await?;
    driver.refresh_pages(&build.refresh).await.map(Some)
}

/// Rebuilds and reloads for every batch of changes until `shutdown` is cancelled or the watcher
/// stops. A failed build or reload is logged and the next save tries again.
pub async fn run<B: Builder, D: BrowserDriver>(
    mut batches: mpsc::Receiver<ChangeBatch>,
    mut builder: B,
    driver: D,
    shutdown: CancellationToken,
) {
    loop {
        let batch = tokio::select! {
            biased;
            () = shutdown.cancelled() => return,
            batch = batches.recv() => batch,
        };
        let Some(batch) = batch else {
            return;
        };
        let mut scope = BuildScope::for_batch(&batch);
        let mut paths: Vec<String> = Vec::new();
        let mut next = Some(batch);
        while let Some(batch) = next {
            scope = scope.max(BuildScope::for_batch(&batch));
            paths.extend(
                batch
                    .events
                    .iter()
                    .map(|event| event.path.as_str().to_owned()),
            );
            next = batches.try_recv().ok();
        }
        tracing::info!("Change detected: {} - rebuilding", paths.join(", "));
        let started = Instant::now();
        let outcome = tokio::select! {
            () = shutdown.cancelled() => return,
            outcome = apply(&mut builder, &driver, scope) => outcome,
        };
        let seconds = started.elapsed().as_secs_f32();
        match outcome {
            Ok(Some(pages)) => tracing::info!(
                "Reloaded the extension and refreshed {pages} open YouTube page(s) in place ({seconds:.1}s)"
            ),
            Ok(None) => {
                tracing::info!("No effective output change ({seconds:.1}s) - skipped reload");
            }
            Err(error) => tracing::error!("Rebuild failed: {error}"),
        }
    }
}

#[cfg(test)]
mod tests;
