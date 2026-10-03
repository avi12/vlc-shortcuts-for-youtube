import { join } from "node:path";
import { defineWebExtConfig } from "wxt";

const DEV_CHROME_PROFILE_DIR = join(import.meta.dirname, "user-profiles", "chrome");
const DEV_CDP_PORT = 9333;

// Dev runner: the isolated profile seeded by scripts/clone-chrome-profile.ts, with a fixed CDP port
// for driving the dev browser (the real Chrome may already own 9222)
export default defineWebExtConfig({
  chromiumProfile: DEV_CHROME_PROFILE_DIR,
  keepProfileChanges: true,
  startUrls: ["https://www.youtube.com/watch?v=aqz-KE-bpKQ"],
  chromiumArgs: [
    "--remote-debugging-address=127.0.0.1",
    `--remote-debugging-port=${DEV_CDP_PORT}`,
    "--no-first-run",
    "--no-default-browser-check",
    "--profile-directory=Default",
    "--disable-blink-features=AutomationControlled"
  ]
});
