use serde_json::json;

use crate::refresh::*;

#[test]
fn only_pages_the_content_scripts_run_on_match() {
    let refresh = PageRefresh {
        matches: vec![
            "https://www.youtube.com/*".to_owned(),
            "https://www.youtube-nocookie.com/embed/*".to_owned(),
        ],
        expressions: Vec::new(),
    };
    assert!(refresh.is_matching("https://www.youtube.com/watch?v=1#t"));
    assert!(refresh.is_matching("https://www.youtube-nocookie.com/embed/a"));
    assert!(!refresh.is_matching("https://www.youtube-nocookie.com/watch"));
    assert!(!refresh.is_matching("http://www.youtube.com/"));
    assert!(!refresh.is_matching("https://example.com/https://www.youtube.com/"));
    assert!(!refresh.is_matching("about:blank"));
}

#[test]
fn styles_come_first_then_only_main_world_scripts() -> Result<()> {
    let root = std::env::temp_dir().join(format!("dev-refresh-{}", std::process::id()));
    std::fs::create_dir_all(&root)?;
    let manifest = json!({"content_scripts": [
        {"matches": ["https://a.b/*"], "css": ["a.css"], "js": ["isolated.js"]},
        {"matches": ["https://a.b/*"], "js": ["main.js"], "world": "MAIN"},
    ]});
    std::fs::write(root.join(MANIFEST_FILE), manifest.to_string())?;
    std::fs::write(root.join("a.css"), "body {}")?;
    std::fs::write(root.join("main.js"), "run()")?;
    let refresh = PageRefresh::read(&root);
    std::fs::remove_dir_all(&root)?;
    let refresh = refresh?;
    assert_eq!(refresh.matches, ["https://a.b/*"]);
    let [styles, script] = refresh.expressions.as_slice() else {
        panic!("expected two expressions, got {:?}", refresh.expressions);
    };
    assert!(styles.contains(r#"[["a.css","body {}"]]"#));
    assert_eq!(script, "run()\n//# sourceURL=main.js");
    Ok(())
}
