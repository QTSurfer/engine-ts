#!/usr/bin/env node
// Every published package carries the licence files of the repository, unchanged, in its tarball, and
// declares the same licence. npm puts LICENSE in a tarball by itself; the other two files are listed in
// `files`. Run by `pnpm test`; when it fails, copy the root files into the package again.
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const LICENSE = "AGPL-3.0-only OR LicenseRef-Wualabs-Commercial";
const COPIES = ["LICENSE", "LICENSING.md", "STRATEGY-EXCEPTION.md"];
const LISTED = ["LICENSING.md", "STRATEGY-EXCEPTION.md"];

const problems = [];
const rootPackage = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
if (rootPackage.license !== LICENSE) problems.push(`package.json: license is ${JSON.stringify(rootPackage.license)}`);

for (const name of readdirSync(join(root, "packages"))) {
  const dir = join(root, "packages", name);
  if (!existsSync(join(dir, "package.json"))) continue;
  const pkg = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
  if (pkg.license !== LICENSE) problems.push(`packages/${name}/package.json: license is ${JSON.stringify(pkg.license)}`);
  if (pkg.private === true) continue;
  for (const file of COPIES) {
    const copy = join(dir, file);
    if (!existsSync(copy)) problems.push(`packages/${name}/${file} is missing`);
    else if (!readFileSync(copy).equals(readFileSync(join(root, file)))) problems.push(`packages/${name}/${file} differs from the root one`);
  }
  for (const file of LISTED) {
    if (!(pkg.files ?? []).includes(file)) problems.push(`packages/${name}/package.json: "files" does not list ${file}`);
  }
}

if (problems.length > 0) {
  console.error("Licence files out of step:\n" + problems.map((p) => `  - ${p}`).join("\n"));
  process.exit(1);
}
console.log("licence files: every published package carries them");
