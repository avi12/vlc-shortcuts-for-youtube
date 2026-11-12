import { base } from "eslint-config-avi12/base";

export default [
  ...base({
    formatter: "eslint",
    sourceFiles: [],
    ignores: ["user-profiles/", ".output/", ".wxt/", ".dev-logs/", ".tmp/"]
  })
];
