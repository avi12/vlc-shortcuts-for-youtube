//! The Firefox dev profile: the real session re-cloned on every launch, so a fresh login reaches
//! the next dev session, plus the prefs the dev server needs.

use std::collections::BTreeMap;
use std::path::{Path, PathBuf};

use serde_json::{json, Value};

use crate::error::Result;
use crate::launcher::log_event;
use crate::profile::{clone_files, Environment};

const PROFILES_INI: &str = "profiles.ini";
const PROFILE_LOCK_FILES: [&str; 3] = ["parent.lock", ".parentlock", "lock"];
/// Session state only, so the launch prefs aren't shadowed by the real `prefs.js`. Each `SQLite`
/// store's `-wal` holds its recent writes (a fresh login) until checkpointed.
const SESSION_FILES: [&str; 11] = [
    "cookies.sqlite",
    "cookies.sqlite-wal",
    "key4.db",
    "logins.json",
    "cert9.db",
    "permissions.sqlite",
    "permissions.sqlite-wal",
    "places.sqlite",
    "places.sqlite-wal",
    "favicons.sqlite",
    "favicons.sqlite-wal",
];
/// Pins the `moz-extension://` UUID across sessions.
const EXTENSION_UUID_VARIABLE: &str = "EXTENSION_UUID";
const DEFAULT_EXTENSION_UUID: &str = "7c1e4a52-3b9d-4f60-a8e2-5d0c9b7f1e36";
/// Where automation tools attach.
const MARIONETTE_PORT: u16 = 2829;
/// Both halves of the Remote Agent: CDP and `BiDi`.
const ACTIVE_REMOTE_PROTOCOLS: u8 = 3;

fn data_directory(environment: &Environment) -> PathBuf {
    if cfg!(windows) {
        return environment.directory("APPDATA").join("Mozilla/Firefox");
    }
    if cfg!(target_os = "macos") {
        return environment
            .home()
            .join("Library/Application Support/Firefox");
    }
    environment.home().join(".mozilla/firefox")
}

#[derive(Default)]
struct IniProfile {
    path: Option<String>,
    is_default: bool,
    is_relative: bool,
}

fn is_profile_header(line: &str) -> bool {
    let digit = line
        .strip_prefix("[Profile")
        .and_then(|rest| rest.chars().next());
    digit.is_some_and(|character| character.is_ascii_digit())
}

/// The `[Install...] Default=` profile Firefox actually launches, else the `Default=1` profile.
fn default_profile_path(ini: &str, data_directory: &Path) -> Option<PathBuf> {
    let mut is_install_section = false;
    let mut profiles: Vec<IniProfile> = Vec::new();
    for line in ini.lines().map(str::trim) {
        if line.starts_with('[') {
            is_install_section = line.starts_with("[Install");
            if is_profile_header(line) {
                profiles.push(IniProfile::default());
            }
            continue;
        }
        if let Some(value) = line.strip_prefix("Default=").filter(|_| is_install_section) {
            return Some(data_directory.join(value.trim()));
        }
        let Some(profile) = profiles.last_mut().filter(|_| !is_install_section) else {
            continue;
        };
        match line.split_once('=') {
            Some(("Path", value)) => profile.path = Some(value.trim().to_owned()),
            Some(("Default", "1")) => profile.is_default = true,
            Some(("IsRelative", "1")) => profile.is_relative = true,
            _ => {}
        }
    }
    let default = profiles.into_iter().find(|profile| profile.is_default)?;
    let path = PathBuf::from(default.path?);
    Some(if default.is_relative {
        data_directory.join(path)
    } else {
        path
    })
}

/// `user.js` is merged into the prefs at every startup.
fn user_prefs(gecko_id: &str, uuid: &str) -> Result<String> {
    let uuids = serde_json::to_string(&BTreeMap::from([(gecko_id, uuid)]))?;
    let prefs: [(&str, Value); 13] = [
        ("extensions.webextensions.uuids", Value::String(uuids)),
        // MV3 treats host permissions as optional; granting them lets the content scripts run
        ("extensions.originControls.grantByDefault", json!(true)),
        ("devtools.debugger.remote-enabled", json!(true)),
        ("devtools.debugger.prompt-connection", json!(false)),
        ("devtools.chrome.enabled", json!(true)),
        ("marionette.port", json!(MARIONETTE_PORT)),
        ("marionette.log.level", json!("Fatal")),
        ("remote.active-protocols", json!(ACTIVE_REMOTE_PROTOCOLS)),
        ("app.update.auto", json!(false)),
        ("app.update.enabled", json!(false)),
        ("browser.shell.checkDefaultBrowser", json!(false)),
        ("browser.startup.homepage_override.mstone", json!("ignore")),
        ("browser.tabs.warnOnClose", json!(false)),
    ];
    Ok(prefs.iter().fold(String::new(), |lines, (name, value)| {
        format!("{lines}user_pref(\"{name}\", {value});\n")
    }))
}

pub(crate) fn setup(profile: &Path, environment: &Environment, gecko_id: &str) -> Result<()> {
    std::fs::create_dir_all(profile)?;
    for lock in PROFILE_LOCK_FILES {
        std::fs::remove_file(profile.join(lock)).ok();
    }
    let data = data_directory(environment);
    let ini = std::fs::read_to_string(data.join(PROFILES_INI)).unwrap_or_default();
    if let Some(source) = default_profile_path(&ini, &data).filter(|path| path.is_dir()) {
        log_event(&format!(
            "Cloning the Firefox session from {}",
            source.display()
        ));
        clone_files(&source, profile, &SESSION_FILES)?;
    }
    let uuid = environment
        .get(EXTENSION_UUID_VARIABLE)
        .unwrap_or(DEFAULT_EXTENSION_UUID);
    std::fs::write(profile.join("user.js"), user_prefs(gecko_id, uuid)?)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use crate::profile::firefox::*;

    #[test]
    fn the_install_section_names_the_profile_in_use() {
        let ini = "[Profile0]\nPath=a\nDefault=1\n[Install1A]\nDefault=Profiles/b\n";
        assert_eq!(
            default_profile_path(ini, Path::new("data")),
            Some(Path::new("data").join("Profiles/b"))
        );
    }

    #[test]
    fn the_uuid_pref_maps_the_gecko_id() -> Result<()> {
        let prefs = user_prefs("a@b.c", "u")?;
        assert!(prefs.starts_with(
            "user_pref(\"extensions.webextensions.uuids\", \"{\\\"a@b.c\\\":\\\"u\\\"}\");\n"
        ));
        Ok(())
    }
}
