// Starts an installed Chromium browser and loads the unpacked extension into it. Branded Chrome 137+ ignores
// --load-extension and takes an unpacked extension only over its debugging pipe (file descriptors 3 and 4), which Node
// can hand to a child process. The browser closes when this process, and with it the pipe, goes away
import { spawn } from "node:child_process";

const [binary, extensionDirectory, startUrl, ...browserArgs] = process.argv.slice(1);
const MESSAGE_END = "\0";
const LOAD_REQUEST_ID = 1;
const OPEN_REQUEST_ID = 2;

function send({ id, method, params }) {
  const message = JSON.stringify({
    id,
    method,
    params
  });
  commands.write(`${message}${MESSAGE_END}`);
}

const browser = spawn(binary, [
  ...browserArgs,
  "--remote-debugging-pipe",
  "--enable-unsafe-extension-debugging"
], { stdio: ["ignore", "ignore", "ignore", "pipe", "pipe"] });
const [,,, commands, replies] = browser.stdio;

browser.on("error", error => {
  console.error(error);
  process.exit(1);
});
browser.on("exit", () => process.exit(0));

let buffer = "";
replies.setEncoding("utf8");
replies.on("data", chunk => {
  const messages = `${buffer}${chunk}`.split(MESSAGE_END);
  buffer = messages.pop();
  for (const message of messages.map(text => JSON.parse(text))) {
    const isLoadReply = message.id === LOAD_REQUEST_ID;
    if (!isLoadReply) {
      continue;
    }

    // Opened only now, so the content scripts are there when it loads
    send({
      id: OPEN_REQUEST_ID,
      method: "Target.createTarget",
      params: {
        url: startUrl
      }
    });
    console.log(JSON.stringify({ error: message.error?.message ?? null }));
  }
});

send({
  id: LOAD_REQUEST_ID,
  method: "Extensions.loadUnpacked",
  params: {
    path: extensionDirectory
  }
});
