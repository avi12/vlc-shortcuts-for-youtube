//! What an open page is handed after a rebuild, read off the built manifest: the stylesheets, then
//! the MAIN-world scripts. These need no extension API, so the debugging protocol can evaluate them
//! with no `scripting` permission. Each new MAIN-world copy retires the one already running.

use std::fmt::Write;
use std::path::Path;

use serde::Deserialize;

use crate::error::Result;

/// The manifest in a build output.
pub const MANIFEST_FILE: &str = "manifest.json";
const MAIN_WORLD: &str = "MAIN";
const DEV_STYLE_ATTRIBUTE: &str = "data-vlc-controls-dev-style";
const SCHEME_SEPARATOR: &str = "://";
const SUBDOMAIN_WILDCARD: &str = "*.";
const WILDCARD: char = '*';

#[derive(Deserialize)]
struct Manifest {
    #[serde(default)]
    content_scripts: Vec<ContentScript>,
}

#[derive(Deserialize)]
struct ContentScript {
    #[serde(default)]
    matches: Vec<String>,
    #[serde(default, rename = "js")]
    scripts: Vec<String>,
    #[serde(default)]
    css: Vec<String>,
    world: Option<String>,
}

/// The expressions to evaluate in each page the content scripts run on.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct PageRefresh {
    /// The manifest's match patterns.
    pub matches: Vec<String>,
    /// Evaluated in order, in the page's own context.
    pub expressions: Vec<String>,
}

/// The extension's stylesheets leave the open pages with the reload, so each comes back as a
/// `<style>` tagged with its file and replaced in place on the next rebuild.
fn style_expression(style_sheets: &[(&str, String)]) -> Result<String> {
    let sheets = serde_json::to_string(style_sheets)?;
    Ok(format!(
        r#"(() => {{
  for (const [file, text] of {sheets}) {{
    const selector = 'style[{DEV_STYLE_ATTRIBUTE}="' + CSS.escape(file) + '"]';
    const elStyle = document.querySelector(selector) ?? document.documentElement.appendChild(document.createElement("style"));
    elStyle.setAttribute("{DEV_STYLE_ATTRIBUTE}", file);
    elStyle.textContent = text;
  }}
}})()"#
    ))
}

impl PageRefresh {
    /// Reads the manifest and the files it names from a build output.
    pub fn read(output_directory: &Path) -> Result<Self> {
        let read = |file: &str| std::fs::read_to_string(output_directory.join(file));
        let manifest: Manifest = serde_json::from_str(&read(MANIFEST_FILE)?)?;
        let mut matches = Vec::new();
        let mut style_sheets = Vec::new();
        let mut scripts = Vec::new();
        for content_script in &manifest.content_scripts {
            matches.extend(content_script.matches.iter().cloned());
            for file in &content_script.css {
                style_sheets.push((file.as_str(), read(file)?));
            }
            let is_main_world = content_script.world.as_deref() == Some(MAIN_WORLD);
            if !is_main_world {
                continue;
            }
            for file in &content_script.scripts {
                let mut script = read(file)?;
                // Writing into a String cannot fail
                write!(script, "\n//# sourceURL={file}").ok();
                scripts.push(script);
            }
        }
        matches.sort();
        matches.dedup();
        let mut expressions = vec![style_expression(&style_sheets)?];
        expressions.extend(scripts);
        Ok(Self {
            matches,
            expressions,
        })
    }

    /// Whether the content scripts run on `url`.
    pub fn is_matching(&self, url: &str) -> bool {
        self.matches
            .iter()
            .any(|pattern| is_pattern_match(pattern, url))
    }
}

fn split_url(url: &str) -> Option<(&str, &str, &str)> {
    let (scheme, rest) = url.split_once(SCHEME_SEPARATOR)?;
    let path_start = rest.find('/').unwrap_or(rest.len());
    let (host, path) = rest.split_at_checked(path_start)?;
    Some((scheme, host, path))
}

fn is_glob_match(pattern: &str, text: &str) -> bool {
    let Some((head, tail)) = pattern.split_once(WILDCARD) else {
        return pattern == text;
    };
    let Some(rest) = text.strip_prefix(head) else {
        return false;
    };
    rest.char_indices()
        .map(|(start, _)| start)
        .chain(std::iter::once(rest.len()))
        .any(|start| {
            rest.get(start..)
                .is_some_and(|suffix| is_glob_match(tail, suffix))
        })
}

fn is_host_match(pattern: &str, host: &str) -> bool {
    let Some(domain) = pattern.strip_prefix(SUBDOMAIN_WILDCARD) else {
        return pattern == "*" || pattern == host;
    };
    host == domain
        || host
            .strip_suffix(domain)
            .is_some_and(|subdomain| subdomain.ends_with('.'))
}

/// A `WebExtension` match pattern against a page URL.
fn is_pattern_match(pattern: &str, url: &str) -> bool {
    let (Some((scheme, host, path)), Some((url_scheme, url_host, url_path))) =
        (split_url(pattern), split_url(url))
    else {
        return false;
    };
    let url_path = url_path.split('#').next().unwrap_or_default();
    (scheme == "*" || scheme == url_scheme)
        && is_host_match(host, url_host)
        && is_glob_match(path, url_path)
}

#[cfg(test)]
mod tests;
