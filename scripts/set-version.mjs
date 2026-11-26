// Sets the product version everywhere it is written down: the root package.json and the
// root entries of package-lock.json. Used by the release workflows.
//
//   node scripts/set-version.mjs 1.2.3
//   node scripts/set-version.mjs 1.2.4-57
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const version = process.argv[2];
if (!/^\d+\.\d+\.\d+(-\d+)?$/.test(version ?? "")) {
  console.error(`Not a version this project uses: "${version ?? ""}" (expected 1.2.3 or 1.2.3-45)`);
  process.exit(1);
}

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const pkgPath = join(root, "package.json");
const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
pkg.version = version;
writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);

// npm records the root package's version twice in the lockfile; keep both in step.
const lockPath = join(root, "package-lock.json");
const lock = JSON.parse(readFileSync(lockPath, "utf8"));
lock.version = version;
if (lock.packages?.[""]) lock.packages[""].version = version;
writeFileSync(lockPath, `${JSON.stringify(lock, null, 2)}\n`);
console.log(`version ${version}`);
