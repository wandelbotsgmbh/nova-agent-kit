import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { moodAt, toolMood } from "../adapters/opencode/mood.ts";
import { idleMood, quip, SLEEP_AFTER_MS } from "../nova-bot/mood.ts";
import { pluginDir, readJson, root, walk } from "./helpers.mjs";

test("both plugins package the shared mascot and only Claude packages its hooks", () => {
  const opencodeDir = join(root, "plugin", "opencode");
  const opencode = readJson(join(opencodeDir, "package.json"));
  assert.equal(opencode.exports["./tui"], "./tui.tsx");
  assert.ok(existsSync(join(opencodeDir, opencode.exports["./tui"])));
  const shared = walk(join(root, "nova-bot")).filter((f) => f !== "assets/icon.png");
  for (const dir of [pluginDir, opencodeDir]) {
    assert.deepEqual(walk(join(dir, "nova-bot")), shared);
  }
  assert.ok(!existsSync(join(opencodeDir, "hooks")));
  assert.ok(!existsSync(join(opencodeDir, "types")));
});

test("shared mascot sleeps at the idle threshold and rotates quips", () => {
  assert.equal(idleMood(SLEEP_AFTER_MS - 1), "idle");
  assert.equal(idleMood(SLEEP_AFTER_MS), "sleeping");
  assert.equal(quip("idle", 31), quip("idle", 0));
  assert.notEqual(quip("idle", 32), quip("idle", 0));
  assert.equal(quip("idle", 5 * 32), quip("idle", 0));
});

test("OpenCode mascot sleeps only when idle and shows temporary outcomes", () => {
  assert.equal(moodAt("idle", undefined, 0, SLEEP_AFTER_MS), "sleeping");
  assert.equal(moodAt("thinking", undefined, 0, SLEEP_AFTER_MS), "thinking");
  assert.equal(moodAt("idle", { mood: "happy", until: 4000 }, 0, 3999), "happy");
  assert.equal(moodAt("idle", { mood: "happy", until: 4000 }, 0, 4000), "idle");
  assert.equal(moodAt("working", { mood: "oops", until: 3000 }, 0, 2999), "oops");
});

test("mascot distinguishes NOVA CLI and MCP calls from unrelated tools", () => {
  assert.equal(toolMood("nova_list_cells"), "nova");
  assert.equal(toolMood("mcp__nova__list_cells"), "nova");
  assert.equal(toolMood("bash", "nova version"), "nova");
  assert.equal(toolMood("write", "nova version"), "working");
  assert.equal(toolMood("other_nova_tool"), "working");
});
