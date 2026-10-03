// Runs every example in this directory and fails if any of them fails.
// Used by `npm run examples` and CI.
import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

const dir = fileURLToPath(new URL(".", import.meta.url));

const examples = readdirSync(dir)
  .filter((file) => file.endsWith(".mjs") && file !== "run-all.mjs")
  .sort();

for (const example of examples) {
  console.log(`\n> ${example}`);

  const { status } = spawnSync(process.execPath, [example], {
    cwd: dir,
    stdio: "inherit",
  });

  if (status !== 0) {
    console.error(`\n${example} failed with exit code ${status}`);
    process.exit(status ?? 1);
  }
}

console.log(`\nAll ${examples.length} examples passed.`);
