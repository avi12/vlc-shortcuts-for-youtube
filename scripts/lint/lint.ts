/**
 * `bun run lint`: every check, whether or not another failed, so a single run lists everything to fix. The steps run
 * side by side, and each one's output is printed whole when it ends, so the lines of two never interleave
 */

import { PROJECT_ROOT } from "./project-root";
import { spawn } from "node:child_process";

const STEPS = ["lint:oxlint", "lint:stylelint", "typecheck", "fallow"];
const MILLISECONDS_PER_SECOND = 1000;

function runStep(name: string) {
  const child = spawn("bun", ["run", name], { cwd: PROJECT_ROOT });
  const chunks: Buffer[] = [];
  child.stdout.on("data", (chunk: Buffer) => chunks.push(chunk));
  child.stderr.on("data", (chunk: Buffer) => chunks.push(chunk));
  return new Promise<{
    isPassing: boolean;
    output: string;
  }>(fulfill => {
    child.on("close", code => fulfill({
      isPassing: code === 0,
      output: Buffer.concat(chunks).toString("utf8")
    }));
  });
}

async function reportStep(name: string) {
  const startedAt = performance.now();
  const { isPassing, output } = await runStep(name);
  const seconds = Math.round((performance.now() - startedAt) / MILLISECONDS_PER_SECOND);
  process.stdout.write(`\n==> ${name}: ${isPassing ? "passed" : "FAILED"} in ${seconds} s\n${output}`);
  return isPassing ? [] : [name];
}

const failedSteps = await Promise.all(STEPS.map(reportStep));
const failedNames = failedSteps.flat().join(", ");
console.log(failedNames ? `\nlint: failed steps: ${failedNames}` : "\nlint: every step passed");
process.exitCode = failedNames ? 1 : 0;
