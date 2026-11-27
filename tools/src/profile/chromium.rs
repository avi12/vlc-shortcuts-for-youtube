//! A Chromium dev profile: its own user-data directory, seeded once from the real profile so the
//! dev browser carries the `YouTube` session, and never writing to the real one.

use std::path::{Path, PathBuf};

use serde_json::{json, Map, Value};

use crate::browser::Browser;
use crate::error::Result;
use crate::launcher::log_event;
use crate::profile::{clone_files, Environment};

pub(crate) const CHROMIUM_PROFILE_NAME: &str = "Default";
const SEEDED_SENTINEL: &str = ".seeded";
/// Names the real Chrome profile to seed from, when it is not the default one.
const SOURCE_PROFILE_VARIABLE: &str = "DEV_CHROME_SOURCE_PROFILE";
/// Holds the key that decrypts the cookies.
const USER_DATA_FILES: [&str; 1] = ["Local State"];
/// Settings and session only: cache, extensions and storage are skipped so the browser starts lean.
const PROFILE_FILES: [&str; 12] = [
    "Preferences",
    "Secure Preferences",
    "Bookmarks",
    "Login Data",
    "Login Data For Account",
    "History",
    "Favicons",
    "Web Data",
    "Top Sites",
    "Network/Cookies",
    "Network/Network Persistent State",
    "Network/TransportSecurity",
];

fn user_data_directory(browser: Browser, environment: &Environment) -> PathBuf {
    let is_opera = browser == Browser::Opera;
    if cfg!(windows) {
        if is_opera {
            return environment
                .directory("APPDATA")
                .join("Opera Software/Opera Stable");
        }
        return environment
            .directory("LOCALAPPDATA")
            .join("Google/Chrome/User Data");
    }
    let relative = match (cfg!(target_os = "macos"), is_opera) {
        (true, true) => "Library/Application Support/com.operasoftware.Opera",
        (true, false) => "Library/Application Support/Google/Chrome",
        (false, true) => ".config/opera",
        (false, false) => ".config/google-chrome",
    };
    environment.home().join(relative)
}

/// The object under `key`, replacing whatever else sits there.
fn object<'map>(
    map: &'map mut Map<String, Value>,
    key: &str,
) -> Option<&'map mut Map<String, Value>> {
    let entry = map.entry(key).or_insert_with(|| json!({}));
    if !entry.is_object() {
        *entry = json!({});
    }
    entry.as_object_mut()
}

/// Reloading an unpacked extension needs developer mode, which a cloned profile may have off. Its
/// `protection` hashes no longer match the edited preferences, so they go.
fn with_developer_mode(stored: &str) -> Value {
    let mut preferences: Map<String, Value> = serde_json::from_str(stored).unwrap_or_default();
    preferences.remove("protection");
    if let Some(interface) =
        object(&mut preferences, "extensions").and_then(|map| object(map, "ui"))
    {
        interface.insert("developer_mode".to_owned(), Value::Bool(true));
    }
    Value::Object(preferences)
}

fn source_profile_name(browser: Browser, environment: &Environment) -> &str {
    environment
        .get(SOURCE_PROFILE_VARIABLE)
        .filter(|_| browser == Browser::Chrome)
        .unwrap_or(CHROMIUM_PROFILE_NAME)
}

pub(crate) fn setup(profile: &Path, browser: Browser, environment: &Environment) -> Result<()> {
    let default = profile.join(CHROMIUM_PROFILE_NAME);
    let sentinel = default.join(SEEDED_SENTINEL);
    let source = user_data_directory(browser, environment);
    let source_profile = source.join(source_profile_name(browser, environment));
    let should_seed = !sentinel.exists() && source_profile.is_dir();
    if should_seed {
        log_event(&format!(
            "Seeding the dev {} profile from {}",
            browser.name(),
            source_profile.display()
        ));
        clone_files(&source, profile, &USER_DATA_FILES)?;
        clone_files(&source_profile, &default, &PROFILE_FILES)?;
    }
    std::fs::create_dir_all(&default)?;
    let preferences = default.join("Preferences");
    let stored = std::fs::read_to_string(&preferences).unwrap_or_default();
    std::fs::write(preferences, with_developer_mode(&stored).to_string())?;
    std::fs::write(sentinel, "")?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use crate::profile::chromium::*;

    #[test]
    fn developer_mode_is_added_without_losing_preferences() {
        let next = with_developer_mode(r#"{"a":1,"protection":{},"extensions":{"b":2}}"#);
        assert_eq!(
            next,
            json!({"a":1,"extensions":{"b":2,"ui":{"developer_mode":true}}})
        );
        assert_eq!(
            with_developer_mode("not json"),
            json!({"extensions":{"ui":{"developer_mode":true}}})
        );
    }
}
