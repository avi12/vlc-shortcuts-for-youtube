import packageJson from "./package.json" with { type: "json" };
import { strToU8, unzipSync, zipSync } from "fflate";
import { readFile, writeFile } from "node:fs/promises";
import { defineConfig } from "wxt";

const EXTENSION_NAME = "VLC Controls for YouTube";
const FALLBACK_GECKO_ID = "vlc-controls-in-youtube@avi12";
// MAIN-world content scripts landed in Firefox 128 and Chromium 111
const FIREFOX_MIN_VERSION = "128.0";
const CHROMIUM_MIN_VERSION = "111";

const url = packageJson.repository;
const [, author, email] = packageJson.author.match(/(.+) <(.+)>/)!;

// Firefox and Opera reviewers rebuild from the source zip, so it ships build (not install) instructions
function renderBuildInstructions(browser: string) {
  return `# Build instructions

${EXTENSION_NAME} is built with the WXT framework (https://wxt.dev).

## Requirements
- Node.js 22 or newer
- pnpm (the exact version is pinned in package.json "packageManager"; run \`corepack enable\` to use it)

## Steps
1. Extract this source archive
2. From the archive root, install dependencies: \`pnpm install\`
3. Build the ${browser} extension: \`pnpm build:${browser}\`

The unpacked build is written to build/${browser}-mv3-production/
`;
}

const BROWSERS_REQUIRING_SOURCES = new Set(["firefox", "opera"]);

async function addReadmeToSourcesZip({ zipPath, instructions }: {
  zipPath: string;
  instructions: string;
}) {
  const entries = unzipSync(await readFile(zipPath));
  entries["README.md"] = strToU8(instructions);
  await writeFile(zipPath, zipSync(entries));
}

// The dev browser's cloned profile lives in user-profiles/ (see scripts/clone-chrome-profile.ts); Vite's
// watcher would otherwise crawl it and hit EBUSY on files the running browser holds. WXT replaces
// server.watch wholesale, so a plugin config hook (deep-merged) is the only way to extend the ignore list
const ignoreDevProfilesInWatcher = {
  name: "wxt:ignore-dev-profiles-watch",
  config: () => ({
    server: {
      watch: {
        ignored: [(watchedPath: string) => /[\\/]user-profiles([\\/]|$)/.test(watchedPath)]
      }
    }
  })
};

// See https://wxt.dev/api/config.html
export default defineConfig({
  srcDir: "src",
  publicDir: "src/public",
  modules: ["@wxt-dev/auto-icons"],
  autoIcons: {
    baseIconPath: "assets/icon.svg"
  },
  manifest({ browser }) {
    return {
      name: EXTENSION_NAME,
      description: "VLC's keyboard shortcuts for YouTube's player - click the toolbar icon to toggle",
      homepage_url: url,
      // No popup: the toolbar click toggles the extension (see background.ts)
      action: {},
      permissions: ["storage"],
      host_permissions: ["https://www.youtube.com/*", "https://www.youtube-nocookie.com/*"],
      // Chrome's manifest takes author as { email }; Opera and Firefox take the "Name <email>" string
      author: browser === "opera" || browser === "firefox" ? packageJson.author : { email },
      ...(browser === "firefox" && {
        browser_specific_settings: {
          gecko: {
            id: process.env.GECKO_ID ?? FALLBACK_GECKO_ID,
            strict_min_version: FIREFOX_MIN_VERSION,
            data_collection_permissions: {
              required: ["none"]
            }
          }
        },
        developer: {
          name: author,
          url
        }
      }),
      ...(browser !== "firefox" && {
        minimum_chrome_version: CHROMIUM_MIN_VERSION
      })
    };
  },
  outDir: "build",
  outDirTemplate: "{{browser}}-mv{{manifestVersion}}-{{mode}}",
  zip: {
    excludeSources: ["build/**", ".output/**", "*.env", ".env*", ".idea/**", ".claude/**"],
    artifactTemplate: "{{name}}-{{version}}-{{browser}}-{{mode}}.zip",
    sourcesTemplate: "{{name}}-{{version}}-{{browser}}-source.zip"
  },
  vite: () => ({
    plugins: [ignoreDevProfilesInWatcher]
  }),
  hooks: {
    "build:manifestGenerated"(wxt, manifest) {
      // `use_dynamic_url` is a Chrome MV3 web_accessible_resources privacy feature WXT auto-adds
      // to the content-script WAR entry; Firefox doesn't recognize it and logs an "unexpected
      // property" warning on sideload. Strip it on Firefox only - Chromium keeps it.
      const isFirefox = wxt.config.browser === "firefox";
      if (!isFirefox || !Array.isArray(manifest.web_accessible_resources)) {
        return;
      }

      for (const resource of manifest.web_accessible_resources) {
        if (typeof resource === "object") {
          delete resource.use_dynamic_url;
        }
      }
    },
    "zip:start"(wxt) {
      // Only a production build ships to stores, so only then is a reviewable source zip worth making
      const isStoreBuild = wxt.config.mode === "production" && BROWSERS_REQUIRING_SOURCES.has(wxt.config.browser);
      if (!isStoreBuild) {
        wxt.config.zip.zipSources = false;
      }
    },
    async "zip:sources:done"(wxt, sourcesZipPath) {
      await addReadmeToSourcesZip({
        zipPath: sourcesZipPath,
        instructions: renderBuildInstructions(wxt.config.browser)
      });
    }
  }
});
