import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { readText, root, walk } from "./helpers.mjs";

const generatedPaths = ["plugin", ".agents", ".claude-plugin"];

// Builds into a scratch directory so the test never touches the working tree while other
// test files read the committed output.
test("committed adapters match a fresh build of their sources", () => {
  const out = mkdtempSync(join(tmpdir(), "nova-kit-build-"));
  execFileSync("node", [join(root, "scripts", "build.mjs"), out], { cwd: root, stdio: "pipe" });

  const files = (base) => generatedPaths.flatMap((p) => walk(join(base, p)).map((f) => `${p}/${f}`)).sort();
  assert.deepEqual(files(root), files(out), "generated file list differs; run `pnpm build` and commit");

  for (const rel of files(out)) {
    assert.equal(readText(join(root, rel)), readText(join(out, rel)), `${rel} is stale; run \`pnpm build\` and commit`);
    assert.equal(
      statSync(join(root, rel)).mode & 0o111,
      statSync(join(out, rel)).mode & 0o111,
      `${rel} has a different executable bit`,
    );
  }
});
