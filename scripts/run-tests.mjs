// CI calls `npm test -- --run` (a Vitest flag). Run node's own test runner and ignore extra flags.
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const testFiles = readdirSync("tests")
  .filter((name) => name.endsWith(".test.mjs"))
  .map((name) => join("tests", name));
if (testFiles.length === 0) {
  console.error("run-tests: no tests/*.test.mjs files found");
  process.exit(1);
}
const result = spawnSync(process.execPath, ["--test", ...testFiles], { stdio: "inherit" });
process.exit(result.status ?? 1);
