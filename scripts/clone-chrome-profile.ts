import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync
} from "node:fs";
import { basename, dirname, join } from "node:path";

// Seeds an isolated Chrome --user-data-dir from the real signed-in profile once, so the dev browser
// carries the YouTube session without ever touching (or being touched by) the real browser
const DEV_CHROME_PROFILE_DIR = join(import.meta.dirname, "..", "user-profiles", "chrome");

const DEV_PROFILE_NAME = "Default";
const SOURCE_PROFILE_NAME = process.env.DEV_CHROME_SOURCE_PROFILE ?? DEV_PROFILE_NAME;
const SOURCE_USER_DATA = join(process.env.LOCALAPPDATA ?? "", "Google", "Chrome", "User Data");
const SEEDED_SENTINEL = join(DEV_CHROME_PROFILE_DIR, DEV_PROFILE_NAME, ".seeded");

const USER_DATA_FILES = ["Local State"];
const PROFILE_FILES = ["Preferences", "Secure Preferences", "Bookmarks", "Login Data", "History", "Web Data"];
const PROFILE_NETWORK_FILES = ["Cookies", "Network Persistent State", "TransportSecurity"];

function cloneFile({ source, destination }: {
  source: string;
  destination: string;
}) {
  if (!existsSync(source)) {
    return;
  }

  mkdirSync(dirname(destination), { recursive: true });
  try {
    cpSync(source, destination);
  } catch (error) {
    // A running Chrome holds some files (Cookies, History) without share access - skip them
    const isLockError = /EBUSY|EPERM/.test(String(error));
    if (!isLockError) {
      throw error;
    }

    console.warn(`Skipped locked profile file (Chrome running?): ${basename(source)}`);
  }
}

// web-ext loads the unpacked build over CDP, which needs developer mode on in the cloned profile
function enableDeveloperMode() {
  const preferencesPath = join(DEV_CHROME_PROFILE_DIR, DEV_PROFILE_NAME, "Preferences");
  mkdirSync(dirname(preferencesPath), { recursive: true });
  const preferences = existsSync(preferencesPath) ? JSON.parse(readFileSync(preferencesPath, "utf-8")) : {};
  preferences.extensions = {
    ...preferences.extensions,
    ui: {
      ...preferences.extensions?.ui,
      developer_mode: true
    }
  };
  writeFileSync(preferencesPath, JSON.stringify(preferences));
}

function seedProfile() {
  const sourceProfile = join(SOURCE_USER_DATA, SOURCE_PROFILE_NAME);
  const destinationProfile = join(DEV_CHROME_PROFILE_DIR, DEV_PROFILE_NAME);
  console.log(`Cloning Chrome profile "${SOURCE_PROFILE_NAME}" into ${DEV_CHROME_PROFILE_DIR}`);
  for (const file of USER_DATA_FILES) {
    cloneFile({
      source: join(SOURCE_USER_DATA, file),
      destination: join(DEV_CHROME_PROFILE_DIR, file)
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
  writeFileSync(SEEDED_SENTINEL, "");
}

if (!existsSync(SEEDED_SENTINEL)) {
  seedProfile();
}

enableDeveloperMode();
