// "Build" for a static site: there is nothing to compile, so prove the page is shippable instead.
// Fails when index.html points at a local file that does not exist, or a script has a syntax error.
import { readFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";

const html = readFileSync("index.html", "utf8");
const problems = [];

const localRefs = [...html.matchAll(/\b(?:src|href)="([^"#]+)"/g)]
  .map((match) => match[1])
  .filter((ref) => !/^(https?:|mailto:|data:)/.test(ref));

for (const ref of localRefs) {
  if (!existsSync(ref)) problems.push(`index.html points at missing file: ${ref}`);
}

const scripts = [...html.matchAll(/<script src="([^"]+)"/g)].map((match) => match[1]);
for (const script of scripts) {
  try {
    execFileSync(process.execPath, ["--check", script], { stdio: "pipe" });
  } catch (error) {
    problems.push(`syntax error in ${script}:\n${error.stderr}`);
  }
}

if (problems.length > 0) {
  console.error(problems.join("\n"));
  process.exit(1);
}
console.log(`check-site: ${localRefs.length} local files found, ${scripts.length} scripts parse.`);
