// Packs the package exactly as `npm publish` would, installs the tarball
// into a throwaway project, and imports it the way a user does. Catches
// broken "exports", missing build output, and files that should not ship.
// Run after `npm run build`: npm run check:package
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Run npm's own CLI through the current Node binary (npm sets
// npm_execpath for `npm run`), so no shell is involved and paths with
// spaces work on Windows too.
const npmCli = process.env.npm_execpath;
const run = (args, cwd) =>
  npmCli
    ? execFileSync(process.execPath, [npmCli, ...args], { cwd, encoding: "utf8" })
    : execFileSync("npm", args, { cwd, encoding: "utf8" });

const work = mkdtempSync(join(tmpdir(), "parmana-sign-pack-"));

try {
  const [packed] = JSON.parse(run(["pack", "--json", "--pack-destination", work]));
  const files = packed.files.map((file) => file.path);

  const required = ["package.json", "README.md", "LICENSE", "dist/index.js", "dist/index.d.ts"];
  const missing = required.filter((file) => !files.includes(file));
  if (missing.length > 0) {
    throw new Error(`tarball is missing: ${missing.join(", ")}`);
  }

  const unexpected = files.filter((file) => /^(src|tests|scripts|examples|docs|\.github)\//.test(file));
  if (unexpected.length > 0) {
    throw new Error(`tarball contains files that should not ship: ${unexpected.join(", ")}`);
  }

  const consumer = join(work, "consumer");
  mkdirSync(consumer);
  writeFileSync(join(consumer, "package.json"), JSON.stringify({ name: "consumer", private: true, type: "module" }));
  run(["install", "--no-audit", "--no-fund", "--ignore-scripts", join(work, packed.filename)], consumer);

  writeFileSync(
    join(consumer, "smoke.mjs"),
    `
import * as sign from "@parmana/sign";
import pkg from "@parmana/sign/package.json" with { type: "json" };
const expected = [
  "CanonicalSerializer", "ArtifactHasher", "SignatureVerifier",
  "Ed25519SignatureProvider", "Dilithium3SignatureProvider", "Sha256HashProvider",
  "verifyExecutionTrustRecordOffline", "verifyExecutionIntentOffline",
  "isMlDsa65Supported", "CryptoError",
];
const missing = expected.filter((name) => !(name in sign));
if (missing.length) { console.error("missing exports:", missing); process.exit(1); }
const bytes = new sign.CanonicalSerializer().serialize({ b: 1, a: 2 });
if (new TextDecoder().decode(bytes) !== '{"a":2,"b":1}') { console.error("canonical output wrong"); process.exit(1); }
console.log("imported " + pkg.name + "@" + pkg.version + " from the packed tarball");
`,
  );

  console.log(execFileSync(process.execPath, ["smoke.mjs"], { cwd: consumer, encoding: "utf8" }).trim());
  console.log(`${packed.filename}: ${files.length} files, ${packed.size} bytes packed`);
} finally {
  rmSync(work, { recursive: true, force: true });
}
