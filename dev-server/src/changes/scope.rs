//! How much a batch of saved files invalidates.

use crate::changes::watcher::ChangeBatch;

/// The directory holding the extension's own source.
pub const SOURCE_DIRECTORY: &str = "src";

/// Dotenv files in WXT's development cascade; the first one naming a variable wins.
pub const ENV_FILES_MOST_SPECIFIC_FIRST: [&str; 4] = [
    ".env.development.local",
    ".env.development",
    ".env.local",
    ".env",
];

/// What the next build has to redo. Ordered, so the widest scope of several batches wins.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
pub enum BuildScope {
    /// Only extension source changed: a warm build is enough.
    Source,
    /// A build input outside the source changed (config, dependencies): start the build process
    /// afresh, so nothing it loaded earlier survives.
    Project,
    /// An env file changed: as for `Project`, and reload even when no output moved, since the
    /// browser may still hold the stale values.
    Environment,
}

impl BuildScope {
    /// The scope of one batch.
    pub fn for_batch(batch: &ChangeBatch) -> Self {
        let scopes = batch.events.iter().map(|event| {
            if ENV_FILES_MOST_SPECIFIC_FIRST.contains(&event.path.as_str()) {
                return Self::Environment;
            }
            let is_source = event
                .path
                .strip_prefix(SOURCE_DIRECTORY)
                .is_some_and(|rest| rest.starts_with('/'));
            if is_source {
                return Self::Source;
            }
            Self::Project
        });
        scopes.max().unwrap_or(Self::Source)
    }
}

#[cfg(test)]
mod tests {
    use crate::changes::scope::*;
    use crate::changes::watcher::{ChangeEvent, ChangeKind};
    use crate::types::RelPath;

    fn scope_of(paths: &[&str]) -> BuildScope {
        BuildScope::for_batch(&ChangeBatch {
            events: paths
                .iter()
                .map(|path| ChangeEvent {
                    path: RelPath::new(path),
                    kind: ChangeKind::Modified,
                })
                .collect(),
        })
    }

    #[test]
    fn the_widest_changed_input_decides_the_scope() {
        assert_eq!(scope_of(&["src/a.ts"]), BuildScope::Source);
        for path in ["wxt.config.ts", "bun.lock", "srcx/a"] {
            assert_eq!(scope_of(&["src/a.ts", path]), BuildScope::Project);
        }
        assert_eq!(
            scope_of(&["wxt.config.ts", ".env.local"]),
            BuildScope::Environment
        );
    }
}
