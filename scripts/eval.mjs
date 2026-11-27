// Runs the cases in evals/ against plugin/claude/ with `claude plugin eval`.
// The eval dir has to sit inside the plugin, and evals/ must not ship with it, so this
// copies both into a temporary directory, runs there and moves the results to
// evals/results/ (gitignored). Extra arguments go to `claude plugin eval`, e.g.
// `pnpm eval --case 'motion-*' --runs 1`.
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { root } from "../test/helpers.mjs";

const work = mkdtempSync(join(tmpdir(), "nova-eval-"));
const plugin = join(work, "plugin");
let status = 1;
try {
  cpSync(join(root, "plugin", "claude"), plugin, { recursive: true });
  cpSync(join(root, "evals"), join(plugin, "evals"), {
    recursive: true,
    filter: (src) => !src.startsWith(join(root, "evals", "results")),
  });
  const run = spawnSync(
    "claude",
    ["plugin", "eval", ".", "--eval-dir", "evals", "--trust-plugin", "--no-publish", ...process.argv.slice(2)],
    { cwd: plugin, stdio: "inherit" },
  );
  if (run.error) throw run.error;
  status = run.status ?? 1;
  const results = join(plugin, "evals", "results");
  if (existsSync(results)) {
    cpSync(results, join(root, "evals", "results"), { recursive: true });
    console.log(`Results and report.html copied to ${join(root, "evals", "results")} (the path above is temporary)`);
  }
} finally {
  rmSync(work, { recursive: true, force: true });
}
process.exit(status);
