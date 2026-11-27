import { join } from "node:path";
import { PROJECT_ROOT } from "./project-root";

const LAUNCHER_FILE = process.platform === "win32" ? "tsrs-lint.exe" : "tsrs-lint";

// Type-aware oxlint runs the linter named by OXLINT_TSGOLINT_PATH, and tsrs's `tsrs-lint` answers that protocol
// with its Rust port of the type-aware rules. Every run of `oxlint --type-aware` takes its environment from here
export function createTypeAwareEnvironment() {
  return {
    ...process.env,
    OXLINT_TSGOLINT_PATH: join(PROJECT_ROOT, "node_modules", ".bin", LAUNCHER_FILE)
  };
}
