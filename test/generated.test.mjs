import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { test } from "node:test";

import { root } from "./helpers.mjs";

const generatedPaths = ["plugin", ".agents", ".claude-plugin"];

test("generated adapters are up to date with skill/", () => {
  execFileSync("node", [join(root, "scripts", "build.mjs")], { cwd: root, stdio: "pipe" });
  const status = execFileSync("git", ["status", "--porcelain", "--", ...generatedPaths], {
    cwd: root,
    encoding: "utf8",
  });
  assert.equal(
    status,
    "",
    `generated output differs from the committed files; run \`pnpm build\` and commit:\n${status}`,
  );
});
