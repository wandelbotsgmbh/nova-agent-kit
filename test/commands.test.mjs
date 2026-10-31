import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { test } from "node:test";

import { novaCommandPaths, readText, skillDir, walk } from "./helpers.mjs";

const probe = spawnSync("nova", ["--help"], { encoding: "utf8" });
const novaMissing = probe.error?.code === "ENOENT";

const paths = new Set();
for (const rel of walk(skillDir)) {
  for (const path of novaCommandPaths(readText(join(skillDir, rel)))) paths.add(path);
}

test("the skill mentions nova subcommands", () => {
  assert.ok(paths.size > 10, `only ${paths.size} commands found; extraction may be broken`);
  assert.ok(paths.has("app install"));
  assert.ok(paths.has("catalog list"));
  assert.ok(paths.has("nucleus cp"));
});

test(
  "every nova subcommand mentioned in the skill exists",
  { skip: novaMissing && "nova CLI not on PATH - install it to run this check (CI does)" },
  () => {
    const unknown = [];
    for (const path of [...paths].sort()) {
      const result = spawnSync("nova", [...path.split(" "), "--help"], {
        encoding: "utf8",
        timeout: 20_000,
      });
      if (result.status !== 0) {
        unknown.push(`nova ${path}: ${(result.stderr || result.stdout).trim().split("\n")[0]}`);
      }
    }
    assert.deepEqual(unknown, [], "subcommands the installed nova CLI does not know");
  },
);
