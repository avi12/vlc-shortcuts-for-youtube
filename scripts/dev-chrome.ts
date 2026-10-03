/**
 * Chromium dev-server target factory, shared by every Chromium-family browser (Chrome here, Opera in
 * `dev-opera.ts`): profile cloning, sideload launch over web-ext-run, and reloading YouTube tabs over CDP.
 *
 * Every Chromium target launches against its OWN cloned `--user-data-dir` under user-profiles/, seeded once
 * from the real profile so the dev browser carries the YouTube session, while closing it never touches the
 * user's real browser.
 */

import {
  type BrowserTarget,
  cloneFile,
  findFreeTcpPort,
  LANG_ARGS,
  PROJECT_ROOT,
  START_URL,
  USER_PROFILES_DIR,
  YOUTUBE_HOST
} from "./dev-shared";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir, platform } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import webExtRun from "web-ext-run";

const DEFAULT_CHROMIUM_PROFILE_NAME = "Default";

interface ChromiumTargetOptions {
  name: string;
  wxtBrowser: "chrome" | "opera";
  // Sub-directory under user-profiles/ for this browser's isolated dev profile
  profileSubdir: string;
  // Preferred debug port; the first free loopback port at or above it is used, so another browser already
  // listening there can never capture this server's reloads
  debugPort: number;
  // Where each OS keeps this browser's real "User Data" root, cloned once into the dev profile
  sourceUserData: Partial<Record<NodeJS.Platform, string>>;
  // The real profile to clone, when it isn't the default one
  sourceProfileName?: string;
  // Omit for Chrome (web-ext finds it)
  findBinary?: () => string | undefined;
}

// ── Profile setup ────────────────────────────────────────────────────────────

// Only what a logged-in debug session needs: Local State holds the key that decrypts the cookies, the
// profile files carry settings and session, Network/ the cookies themselves. Cache, extensions and storage
// are skipped so the browser starts lean
const USER_DATA_FILES = ["Local State"];
const PROFILE_FILES = [
  "Preferences",
  "Secure Preferences",
  "Bookmarks",
  "Login Data",
  "Login Data For Account",
  "History",
  "Favicons",
  "Web Data",
  "Top Sites"
];
const PROFILE_NETWORK_FILES = ["Cookies", "Network Persistent State", "TransportSecurity"];

// web-ext loads the unpacked build over CDP, which needs developer mode on - the cloned preferences carry
// the real profile's setting, which may be off
function ensureDeveloperMode(profileDir: string) {
  const preferencesPath = join(profileDir, DEFAULT_CHROMIUM_PROFILE_NAME, "Preferences");
  mkdirSync(dirname(preferencesPath), { recursive: true });
  const preferences = existsSync(preferencesPath) ? JSON.parse(readFileSync(preferencesPath, "utf-8")) : {};
  preferences.extensions = {
    ...preferences.extensions,
    ui: {
      ...preferences.extensions?.ui,
      developer_mode: true
    }
  };
  delete preferences.protection;
  writeFileSync(preferencesPath, JSON.stringify(preferences));
}

function setupChromiumProfile({ profileDir, sourceUserData, sourceProfileName = DEFAULT_CHROMIUM_PROFILE_NAME }: {
  profileDir: string;
} & Pick<ChromiumTargetOptions, "sourceUserData" | "sourceProfileName">) {
  const seededSentinel = join(profileDir, DEFAULT_CHROMIUM_PROFILE_NAME, ".seeded");
  const isSeeded = existsSync(seededSentinel);
  const sourceRoot = sourceUserData[platform()];
  const sourceProfile = sourceRoot && join(sourceRoot, sourceProfileName);
  if (!isSeeded && sourceRoot && sourceProfile && existsSync(sourceProfile)) {
    console.log(`Cloning ${basename(profileDir)} profile from ${sourceProfile}...`);
    const destinationProfile = join(profileDir, DEFAULT_CHROMIUM_PROFILE_NAME);
    for (const file of USER_DATA_FILES) {
      cloneFile({
        source: join(sourceRoot, file),
        destination: join(profileDir, file)
      });
    }
    for (const file of PROFILE_FILES) {
      cloneFile({
        source: join(sourceProfile, file),
        destination: join(destinationProfile, file)
      });
    }
    for (const file of PROFILE_NETWORK_FILES) {
      cloneFile({
        source: join(sourceProfile, "Network", file),
        destination: join(destinationProfile, "Network", file)
      });
    }
  }

  ensureDeveloperMode(profileDir);
  writeFileSync(seededSentinel, "");
  return profileDir;
}

// ── Tab reload ───────────────────────────────────────────────────────────────

interface CdpTarget {
  type?: string;
  url?: string;
  webSocketDebuggerUrl?: string;
}

function evaluateOverCdp({ webSocketUrl, expression }: {
  webSocketUrl: string;
  expression: string;
}) {
  return new Promise<void>(resolvePromise => {
    const webSocket = new WebSocket(webSocketUrl);
    webSocket.onopen = () => webSocket.send(
      JSON.stringify({
        id: 1,
        method: "Runtime.evaluate",
        params: {
          expression
        }
      })
    );
    webSocket.onmessage = () => {
      webSocket.close();
      resolvePromise();
    };
    webSocket.onerror = () => resolvePromise();
    webSocket.onclose = () => resolvePromise();
  });
}

async function reloadYoutubeTabsOverCdp(debugPort: number) {
  const targets: CdpTarget[] = await fetch(`http://127.0.0.1:${debugPort}/json`)
    .then(response => response.json())
    .catch(() => []);
  const youtubeTabs = targets.filter(target => target.type === "page" && target.url?.includes(YOUTUBE_HOST));
  await Promise.all(
    youtubeTabs.map(target => target.webSocketDebuggerUrl && evaluateOverCdp({
      webSocketUrl: target.webSocketDebuggerUrl,
      expression: "location.reload()"
    }))
  );
}

// ── Target factory ───────────────────────────────────────────────────────────

export function createChromiumTarget(options: ChromiumTargetOptions): BrowserTarget {
  const outputDirName = `${options.name.toLowerCase()}-mv3-development`;
  const profileDir = join(USER_PROFILES_DIR, options.profileSubdir);

  async function launch(profileDirectory: string) {
    const debugPort = await findFreeTcpPort(options.debugPort);
    if (debugPort !== options.debugPort) {
      console.log(`${options.name} debug port ${options.debugPort} busy; using ${debugPort} instead`);
    }

    const chromiumBinary = options.findBinary?.();
    const runner = await webExtRun.cmd.run(
      {
        target: "chromium",
        sourceDir: resolve(PROJECT_ROOT, "build", outputDirName),
        startUrl: [START_URL],
        keepProfileChanges: true,
        chromiumProfile: profileDirectory,
        ...chromiumBinary && {
          chromiumBinary
        },
        args: [
          ...LANG_ARGS,
          "--remote-debugging-address=127.0.0.1",
          `--remote-debugging-port=${debugPort}`,
          "--no-first-run",
          "--no-default-browser-check",
          `--profile-directory=${DEFAULT_CHROMIUM_PROFILE_NAME}`,
          "--disable-blink-features=AutomationControlled"
        ],
        noReload: true,
        noInput: true
      },
      { shouldExitProgram: false }
    );
    return {
      runner,
      debugPort
    };
  }

  return {
    name: options.name,
    wxtBrowser: options.wxtBrowser,
    outputDir: resolve(PROJECT_ROOT, "build", outputDirName),
    outDirTemplate: outputDirName,
    setupProfile: () => setupChromiumProfile({
      profileDir,
      sourceUserData: options.sourceUserData,
      sourceProfileName: options.sourceProfileName
    }),
    launch,
    reloadYoutubeTabs: reloadYoutubeTabsOverCdp
  };
}

// ── Chrome ───────────────────────────────────────────────────────────────────

// 9222 is often already taken by the user's own debuggable browser
const CHROME_DEBUG_PORT = 9333;
const { LOCALAPPDATA = "" } = process.env;

export const chromeTarget = createChromiumTarget({
  name: "Chrome",
  wxtBrowser: "chrome",
  profileSubdir: "chrome",
  debugPort: CHROME_DEBUG_PORT,
  sourceProfileName: process.env.DEV_CHROME_SOURCE_PROFILE,
  sourceUserData: {
    win32: join(LOCALAPPDATA, "Google", "Chrome", "User Data"),
    darwin: join(homedir(), "Library", "Application Support", "Google", "Chrome"),
    linux: join(homedir(), ".config", "google-chrome")
  }
});
