use std::future::{ready, Future};
use std::sync::{Arc, Mutex, PoisonError};

use crate::changes::watcher::{ChangeEvent, ChangeKind};
use crate::error::Error;
use crate::orchestrator::*;
use crate::types::RelPath;

#[derive(Debug, Clone, Default)]
struct Log(Arc<Mutex<Vec<String>>>);

impl Log {
    fn push(&self, line: String) {
        self.0
            .lock()
            .unwrap_or_else(PoisonError::into_inner)
            .push(line);
    }

    fn lines(&self) -> Vec<String> {
        self.0
            .lock()
            .unwrap_or_else(PoisonError::into_inner)
            .clone()
    }
}

#[derive(Clone, Copy)]
enum Outcome {
    Changed,
    Unchanged,
    Broken,
}

struct FakeBuilder {
    log: Log,
    outcome: Outcome,
}

impl Builder for FakeBuilder {
    fn build(&mut self, scope: BuildScope) -> impl Future<Output = Result<Build>> + Send {
        self.log.push(format!("build {scope:?}"));
        let is_changed = match self.outcome {
            Outcome::Changed => true,
            Outcome::Unchanged => false,
            Outcome::Broken => {
                return ready(Err(Error::Host {
                    message: "broken".to_owned(),
                }))
            }
        };
        ready(Ok(Build {
            is_changed,
            refresh: PageRefresh::default(),
        }))
    }
}

struct FakeDriver(Log);

impl BrowserDriver for FakeDriver {
    fn reload_extension(&self) -> impl Future<Output = Result<()>> + Send {
        self.0.push("reload extension".to_owned());
        ready(Ok(()))
    }

    fn refresh_pages(&self, _refresh: &PageRefresh) -> impl Future<Output = Result<usize>> + Send {
        self.0.push("refresh pages".to_owned());
        ready(Ok(1))
    }
}

async fn run_batches(paths: &[&str], outcome: Outcome) -> Vec<String> {
    let log = Log::default();
    let (sender, receiver) = mpsc::channel(paths.len().max(1));
    for path in paths {
        let events = vec![ChangeEvent {
            path: RelPath::new(path),
            kind: ChangeKind::Modified,
        }];
        sender.send(ChangeBatch { events }).await.ok();
    }
    drop(sender);
    let builder = FakeBuilder {
        log: log.clone(),
        outcome,
    };
    run(
        receiver,
        builder,
        FakeDriver(log.clone()),
        CancellationToken::new(),
    )
    .await;
    log.lines()
}

#[tokio::test]
async fn queued_batches_merge_into_one_build_of_the_widest_scope() {
    let lines = run_batches(&["src/a.ts", "wxt.config.ts"], Outcome::Changed).await;
    assert_eq!(
        lines,
        ["build Project", "reload extension", "refresh pages"]
    );
}

#[tokio::test]
async fn an_unchanged_or_failed_build_reloads_nothing() {
    for outcome in [Outcome::Unchanged, Outcome::Broken] {
        assert_eq!(run_batches(&["src/a.ts"], outcome).await, ["build Source"]);
    }
}

#[tokio::test]
async fn an_env_change_reloads_even_with_unchanged_output() {
    let lines = run_batches(&[".env"], Outcome::Unchanged).await;
    assert_eq!(
        lines,
        ["build Environment", "reload extension", "refresh pages"]
    );
}
