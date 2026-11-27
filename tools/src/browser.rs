//! The dev browsers: what differs between them, and how each is launched.

pub(crate) mod chromium;
pub(crate) mod firefox;
mod startup;

use std::path::{Path, PathBuf};

use crate::profile::Environment;

const BUILD_DIRECTORY: &str = "build";
const LANGUAGE_VARIABLE: &str = "LANG";
const DEFAULT_LANGUAGE: &str = "en";
const START_URL: &str = "https://www.youtube.com/watch?v=aqz-KE-bpKQ";

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum Browser {
    Chrome,
    Opera,
    Firefox,
}

impl Browser {
    pub(crate) const fn name(self) -> &'static str {
        match self {
            Self::Chrome => "Chrome",
            Self::Opera => "Opera",
            Self::Firefox => "Firefox",
        }
    }

    /// The name WXT builds for, which also names the profile and the dev log.
    pub(crate) const fn slug(self) -> &'static str {
        match self {
            Self::Chrome => "chrome",
            Self::Opera => "opera",
            Self::Firefox => "firefox",
        }
    }

    /// WXT's output folder under `build/`, distinct per browser so two dev servers never race one
    /// directory.
    pub(crate) const fn output_directory_template(self) -> &'static str {
        match self {
            Self::Chrome => "chrome-mv3-development",
            Self::Opera => "opera-mv3-development",
            Self::Firefox => "firefox-mv3-development",
        }
    }

    pub(crate) fn output_directory(self, project_root: &Path) -> PathBuf {
        project_root
            .join(BUILD_DIRECTORY)
            .join(self.output_directory_template())
    }
}

/// What a launch needs.
#[derive(Debug, Clone, Copy)]
pub(crate) struct Launch<'a> {
    pub(crate) browser: Browser,
    pub(crate) profile_directory: &'a Path,
    pub(crate) extension_directory: &'a Path,
    pub(crate) environment: &'a Environment,
}

/// The flag that makes the browser speak `LANG`, when it asks for another than English.
fn language_argument(environment: &Environment) -> Option<String> {
    environment
        .get(LANGUAGE_VARIABLE)
        .filter(|language| *language != DEFAULT_LANGUAGE)
        .map(|language| format!("--lang={language}"))
}
