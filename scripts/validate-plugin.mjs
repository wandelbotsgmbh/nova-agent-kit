// `claude plugin validate --strict`, except for one warning we cause on purpose:
// the manifests carry no `version`, so Claude Code versions the plugin by commit
// SHA (see .releaserc.json and README "Versioning"). Any other warning, and every
// error, still fails.
import { spawnSync } from "node:child_process";

// From the marketplace root the same warning is prefixed "plugins[0] plugin.json → ".
const allowed = [/^(plugins\[\d+\] plugin\.json → )?version: No version specified\b/];

let failed = false;
for (const target of process.argv.slice(2)) {
  const run = spawnSync("claude", ["plugin", "validate", target], { encoding: "utf8" });
  if (run.error) throw run.error;
  const output = `${run.stdout}${run.stderr}`;
  process.stdout.write(output);
  if (run.status !== 0) {
    failed = true;
    continue;
  }
  const count = Number(output.match(/Found (\d+) warnings?/)?.[1] ?? 0);
  // The warnings are the first `❯` lines after the "Found N warning(s)" line.
  const block = output.split(/Found \d+ warnings?:?/)[1] ?? "";
  const warnings = [...block.matchAll(/❯ (.+)/g)].slice(0, count).map((m) => m[1].trim());
  const unexpected = warnings.filter((w) => !allowed.some((re) => re.test(w)));
  if (warnings.length !== count || unexpected.length > 0) {
    console.error(`\n${target}: unexpected warnings:\n${(unexpected.length ? unexpected : warnings).join("\n")}`);
    failed = true;
  }
}
process.exit(failed ? 1 : 0);
