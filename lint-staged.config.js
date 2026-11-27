// The pre-commit hook (simple-git-hooks, installed by `bun install`): the fixers run on the staged files, then
// fallow audits what changed against HEAD
export default {
  "*.{ts,js,mjs}": [
    "tsx scripts/lint/oxlint.ts --fix --no-error-on-unmatched-pattern",
    () => "fallow audit --base HEAD"
  ],
  "*.css": "stylelint --fix"
};
