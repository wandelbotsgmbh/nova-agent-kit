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
        continue;
      }
      // For an unknown subcommand of a known group, the CLI prints the group's help and
      // exits 0. The usage lines name the command that answered: it must be the full path,
      // or a command without subcommands whose arguments are the rest (`config set host`).
      const usage = (result.stdout.split(/^Usage:\n/m)[1]?.split(/\n\s*\n/)[0] ?? "")
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);
      const answered = [];
      for (const token of usage[0]?.split(/\s+/) ?? []) {
        if (!/^[a-z][a-z0-9-]*$/.test(token)) break;
        answered.push(token);
      }
      const isGroup = usage.some((line) => line.includes("[command]"));
      const words = ["nova", ...path.split(" ")];
      const prefix = answered.every((t, i) => words[i] === t);
      const ok = prefix && (answered.length === words.length || !isGroup);
      if (!ok) unknown.push(`nova ${path}: --help shows the usage of "${answered.join(" ")}"`);
    }
    assert.deepEqual(unknown, [], "subcommands the installed nova CLI does not know");
  },
);
