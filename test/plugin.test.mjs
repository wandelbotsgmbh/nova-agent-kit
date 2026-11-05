import assert from "node:assert/strict";
import { existsSync, mkdtempSync, statSync, writeFileSync, chmodSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { botPluginDir, botSourceDir, isDirectory, pluginDir, readJson, root, walk } from "./helpers.mjs";

const pkg = readJson(join(root, "package.json"));
const plugin = readJson(join(pluginDir, ".claude-plugin", "plugin.json"));
const marketplace = readJson(join(root, ".claude-plugin", "marketplace.json"));
const mcp = readJson(join(pluginDir, ".mcp.json"));
const hooks = readJson(join(pluginDir, "hooks", "hooks.json"));
const bot = readJson(join(botPluginDir, ".claude-plugin", "plugin.json"));
const botHooks = readJson(join(botPluginDir, "hooks", "hooks.json"));

const reservedPrefix = /^(claude|anthropic|anthropics|cc-plugin)[-_]/i;
const reservedNames = /^(claude|anthropic|anthropics|claude-code|claude-mods)$/i;
const secretLike = /(token|secret|password|credential|api[-_]?key)/i;

function assertAllowedName(name, what) {
  assert.match(name, /^[a-z][a-z0-9-]*$/, `${what} must be kebab-case`);
  assert.doesNotMatch(name, reservedPrefix, `${what} uses a reserved prefix`);
  assert.doesNotMatch(name, reservedNames, `${what} is a reserved name`);
  assert.doesNotMatch(name, /\b(claude|anthropic|anthropics)\b/i, `${what} must not contain a vendor name`);
}

test("plugin.json has the required fields and the kit version", () => {
  assertAllowedName(plugin.name, "plugin name");
  assert.equal(plugin.version, pkg.version, "plugin version must come from package.json");
  assert.ok(plugin.description);
  assert.ok(plugin.author?.name);
  assert.equal(plugin.license, pkg.license);
});

test("plugin userConfig holds at most the host", () => {
  const keys = Object.keys(plugin.userConfig ?? {});
  for (const key of keys) {
    assert.equal(key, "host", `unexpected userConfig option ${key}`);
    assert.doesNotMatch(key, secretLike);
  }
});

test("marketplace.json lists ./plugin and ./plugin-nova-bot with matching metadata", () => {
  assertAllowedName(marketplace.name, "marketplace name");
  assert.ok(marketplace.owner?.name);
  assert.deepEqual(
    marketplace.plugins.map((entry) => [entry.name, entry.source, entry.version]),
    [
      [plugin.name, "./plugin", pkg.version],
      [bot.name, "./plugin-nova-bot", pkg.version],
    ],
  );
});

test(".mcp.json launches nova mcp without credentials", () => {
  assert.deepEqual(Object.keys(mcp.mcpServers), ["nova"]);
  const server = mcp.mcpServers.nova;
  assert.equal(server.command, "nova");
  assert.deepEqual(server.args, ["mcp"]);
  for (const key of Object.keys(server.env ?? {})) {
    assert.doesNotMatch(key, secretLike, `env ${key} looks like a credential`);
  }
});

test("hooks.json registers an executable SessionStart check", () => {
  const sessionStart = hooks.hooks.SessionStart;
  assert.ok(Array.isArray(sessionStart) && sessionStart.length > 0);
  const commands = sessionStart.flatMap((group) => group.hooks).filter((h) => h.type === "command");
  assert.ok(commands.length > 0);
  for (const hook of commands) {
    assert.match(hook.command, /\$\{CLAUDE_PLUGIN_ROOT\}\/hooks\/check-nova\.sh/);
  }
  const script = join(pluginDir, "hooks", "check-nova.sh");
  assert.ok(existsSync(script));
  assert.ok(statSync(script).mode & 0o111, "check-nova.sh must be executable");
});

test("SessionStart hook reports a missing nova CLI and stays quiet otherwise", () => {
  const script = join(pluginDir, "hooks", "check-nova.sh");
  const emptyPath = mkdtempSync(join(tmpdir(), "nova-kit-nopath-"));
  const missing = execFileSync("/bin/sh", [script], { env: { PATH: emptyPath }, encoding: "utf8" });
  assert.match(missing, /nova CLI is not installed/);
  assert.match(missing, /github\.com\/wandelbotsgmbh\/nova-cli\/releases/);

  const fakeBin = mkdtempSync(join(tmpdir(), "nova-kit-fakebin-"));
  writeFileSync(join(fakeBin, "nova"), "#!/bin/sh\nexit 0\n");
  chmodSync(join(fakeBin, "nova"), 0o755);
  const present = execFileSync("/bin/sh", [script], { env: { PATH: fakeBin }, encoding: "utf8" });
  assert.equal(present, "");
});

test("plugin has no bin/ directory and no CLAUDE.md", () => {
  assert.ok(!isDirectory(join(pluginDir, "bin")), "plugin/bin is not allowed");
  for (const rel of walk(pluginDir)) {
    assert.doesNotMatch(rel, /(^|\/)bin\//, `${rel} is inside a bin/ directory`);
  }
  assert.ok(!existsSync(join(pluginDir, "CLAUDE.md")));
});

test("plugin contains exactly the generated skill plus manifests", () => {
  const files = walk(pluginDir);
  const skillFiles = walk(join(root, "skill")).map((f) => `skills/nova/${f}`);
  const expected = [
    ".claude-plugin/plugin.json",
    ".mcp.json",
    "hooks/check-nova.sh",
    "hooks/hooks.json",
    ...skillFiles,
  ].sort();
  assert.deepEqual(files, expected);
});

test("nova-bot plugin.json has the required fields and the kit version", () => {
  assertAllowedName(bot.name, "nova-bot plugin name");
  assert.equal(bot.version, pkg.version, "nova-bot version must come from package.json");
  assert.ok(bot.description);
  assert.ok(bot.author?.name);
  assert.equal(bot.license, pkg.license);
  assert.equal(bot.userConfig, undefined, "nova-bot takes no configuration");
  assert.equal(bot.types, "./types/index.d.ts");
});

test("nova-bot hooks.json loads only its hooks module, no shell hooks, MCP servers or bin/", () => {
  assert.deepEqual(botHooks, { modules: ["./register.tsx"] });
  assert.ok(!existsSync(join(botPluginDir, ".mcp.json")));
  assert.ok(!isDirectory(join(botPluginDir, "bin")), "plugin-nova-bot/bin is not allowed");
});

test("nova-bot plugin contains exactly its source plus manifests", () => {
  const expected = [
    ".claude-plugin/plugin.json",
    "hooks/hooks.json",
    ...walk(botSourceDir),
  ].sort();
  assert.deepEqual(walk(botPluginDir), expected);
});
