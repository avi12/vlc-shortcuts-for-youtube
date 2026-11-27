/** Type-aware oxlint, run by tsrs-lint. Arguments go to oxlint, so `--fix` and file paths work */

import { PROJECT_ROOT } from "./project-root";
import { createTypeAwareEnvironment } from "./type-aware-environment";
import { spawnSync } from "node:child_process";
import { join } from "node:path";

const OXLINT_SCRIPT = join(PROJECT_ROOT, "node_modules", "oxlint", "bin", "oxlint");
const FAILURE_STATUS = 1;

const result = spawnSync(process.execPath, [OXLINT_SCRIPT, "--type-aware", ...process.argv.slice(2)], {
  cwd: PROJECT_ROOT,
  env: createTypeAwareEnvironment(),
  stdio: "inherit"
});
process.exitCode = result.status ?? FAILURE_STATUS;
