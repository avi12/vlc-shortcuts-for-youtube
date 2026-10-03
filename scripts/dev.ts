/**
 * Dev-server entry, ported from youtube-time-manager's extension dev server: builds the WXT development
 * bundle (with inline source maps), sideloads it into an isolated clone of the real browser profile, and on
 * every change under src/ rebuilds and reloads the extension and/or the open YouTube tabs.
 *
 * Usage:
 *   tsx scripts/dev.ts                            - Chrome
 *   tsx scripts/dev.ts --opera                    - Opera
 *   tsx scripts/dev.ts --firefox                  - Firefox
 *   tsx scripts/dev.ts --firefox --no-marionette  - Firefox without automation flags, to sign in to Google
 */

import { chromeTarget } from "./dev-chrome";
import "./dev-env";
import { createFirefoxTarget } from "./dev-firefox";
import { operaTarget } from "./dev-opera";
import { installProcessDiagnostics, logEvent, runDevServer } from "./dev-shared";

function resolveTarget() {
  if (process.argv.includes("--firefox")) {
    return createFirefoxTarget({ isMarionetteEnabled: !process.argv.includes("--no-marionette") });
  }

  return process.argv.includes("--opera") ? operaTarget : chromeTarget;
}

installProcessDiagnostics();
runDevServer(resolveTarget()).catch(error => {
  logEvent("Fatal error in runDevServer():");
  console.error(error);
  process.exit(1);
});
