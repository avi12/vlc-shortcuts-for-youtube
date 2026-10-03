/**
 * Loads the development dotenv cascade into process.env before the dev-server modules initialise, so their
 * module-level reads (GECKO_ID) match what WXT builds with - WXT loads env for wxt.config.ts itself, tsx
 * does not. process.loadEnvFile never overwrites a set var, so the most specific file loads first
 */

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const PROJECT_ROOT = resolve(import.meta.dirname, "..");
const ENV_FILES_MOST_SPECIFIC_FIRST = [".env.development.local", ".env.development", ".env.local", ".env"];

for (const file of ENV_FILES_MOST_SPECIFIC_FIRST) {
  const path = resolve(PROJECT_ROOT, file);
  if (existsSync(path)) {
    process.loadEnvFile(path);
  }
}

function parseEnvFile(path: string) {
  const entries: Record<string, string> = {};
  for (const rawLine of readFileSync(path, "utf-8").split(/\r?\n/)) {
    const line = rawLine.trim();
    const iEquals = line.indexOf("=");
    const isEntry = line !== "" && !line.startsWith("#") && iEquals !== -1;
    if (!isEntry) {
      continue;
    }

    entries[line.slice(0, iEquals).trim()] = line.slice(iEquals + 1).trim();
  }
  return entries;
}

// An env edit mid-session must reach the next rebuild, so the cascade is re-read OVERWRITING process.env,
// least specific first so the most specific file still wins
export function reloadDevEnv() {
  for (const file of ENV_FILES_MOST_SPECIFIC_FIRST.toReversed()) {
    const path = resolve(PROJECT_ROOT, file);
    if (existsSync(path)) {
      Object.assign(process.env, parseEnvFile(path));
    }
  }
}
