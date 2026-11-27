//! The RDP client against an in-process fake Firefox.

use std::sync::{Arc, Mutex};

use dev_hot::driver::rdp::{encode_packet, PacketDecoder, RdpClient};
use dev_hot::driver::BrowserDriver;
use dev_hot::refresh::PageRefresh;
use dev_hot::types::Port;
use dev_hot::Result;
use serde_json::{json, Value};
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::{TcpListener, TcpStream};

type CallLog = Arc<Mutex<Vec<String>>>;

fn replies(request: &Value) -> Vec<Value> {
    let from = request["to"].clone();
    match request["type"].as_str().unwrap() {
        "getRoot" => vec![json!({ "from": from, "addonsActor": "addons" })],
        "installTemporaryAddon" => vec![json!({ "from": from, "addon": { "id": "a@b.c" } })],
        "listTabs" => vec![json!({ "from": from, "tabs": [
            { "actor": "tab1", "url": "https://www.youtube.com/watch" },
            { "actor": "tab2", "url": "https://example.com/" },
        ] })],
        "getTarget" => vec![json!({ "from": from, "frame": { "consoleActor": "console" } })],
        _ => vec![
            json!({ "from": from, "resultID": "r" }),
            json!({ "from": from, "type": "evaluationResult", "resultID": "r" }),
        ],
    }
}

async fn serve(mut stream: TcpStream, calls: CallLog) {
    let greeting = encode_packet(&json!({ "from": "root" })).unwrap();
    stream.write_all(&greeting).await.unwrap();
    let mut decoder = PacketDecoder::default();
    let mut chunk = [0_u8; 4096];
    loop {
        let read = stream.read(&mut chunk).await.unwrap_or(0);
        if read == 0 {
            return;
        }
        for request in decoder.push(&chunk[..read]).unwrap() {
            let call = format!("{} {}", request["to"], request["type"]).replace('"', "");
            calls.lock().unwrap().push(call);
            for reply in replies(&request) {
                let bytes = encode_packet(&reply).unwrap();
                stream.write_all(&bytes).await.unwrap();
            }
        }
    }
}

async fn start_fake() -> Result<(RdpClient, CallLog)> {
    let listener = TcpListener::bind("127.0.0.1:0").await?;
    let port = Port::new(listener.local_addr()?.port())?;
    let calls = CallLog::default();
    let served = Arc::clone(&calls);
    tokio::spawn(async move {
        while let Ok((stream, _peer)) = listener.accept().await {
            tokio::spawn(serve(stream, Arc::clone(&served)));
        }
    });
    Ok((RdpClient::new(port, "build".into()), calls))
}

#[tokio::test]
async fn the_extension_is_installed_as_a_temporary_add_on() -> Result<()> {
    let (client, calls) = start_fake().await?;
    client.reload_extension().await?;
    assert_eq!(
        *calls.lock().unwrap(),
        ["root getRoot", "addons installTemporaryAddon"]
    );
    Ok(())
}

#[tokio::test]
async fn only_matching_tabs_are_evaluated_into() -> Result<()> {
    let (client, calls) = start_fake().await?;
    let refresh = PageRefresh {
        matches: vec!["https://www.youtube.com/*".to_owned()],
        expressions: vec!["one".to_owned(), "two".to_owned()],
    };
    assert_eq!(client.refresh_pages(&refresh).await?, 1);
    assert_eq!(
        *calls.lock().unwrap(),
        [
            "root listTabs",
            "tab1 getTarget",
            "console evaluateJSAsync",
            "console evaluateJSAsync",
        ]
    );
    Ok(())
}
