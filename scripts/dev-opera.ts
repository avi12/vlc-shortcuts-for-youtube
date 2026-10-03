/**
 * Opera dev-server target. Opera is Chromium, so it reuses the Chrome machinery (profile cloning, CDP content
 * script injection) via createChromiumTarget - only the WXT build target, the binary, the profile and the debug port
 * differ.
 */

import { createChromiumTarget } from "./dev-chrome";
import { existsSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const OPERA_DEBUG_PORT = 9340;
const { APPDATA = "", LOCALAPPDATA = "" } = process.env;
const OPERA_INSTALL_DIR = join(LOCALAPPDATA, "Programs", "Opera");

// The opera.exe at the install root is a launcher that hands off to the versioned binary and exits, which
// web-ext reads as the browser closing - so launch the newest versioned binary directly
function findOperaBinary() {
  if (!existsSync(OPERA_INSTALL_DIR)) {
    return undefined;
  }

  const versionDirs = readdirSync(OPERA_INSTALL_DIR).filter(name => /^\d+(\.\d+)+$/.test(name));
  const [newestVersion] = versionDirs.sort((versionA, versionB) => versionB.localeCompare(versionA, undefined, {
    numeric: true
  }));
  const binaryPath = newestVersion && join(OPERA_INSTALL_DIR, newestVersion, "opera.exe");
  return binaryPath && existsSync(binaryPath) ? binaryPath : undefined;
}

export const operaTarget = createChromiumTarget({
  name: "Opera",
  wxtBrowser: "opera",
  profileSubdir: "opera",
  debugPort: OPERA_DEBUG_PORT,
  findBinary: findOperaBinary,
  sourceUserData: {
    win32: join(APPDATA, "Opera Software", "Opera Stable"),
    darwin: join(homedir(), "Library", "Application Support", "com.operasoftware.Opera"),
    linux: join(homedir(), ".config", "opera")
  }
});
