import assert from "node:assert/strict";
import { existsSync, mkdtempSync, statSync, writeFileSync, chmodSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { botSourceDir, isDirectory, pluginDir, readJson, readText, root, walk } from "./helpers.mjs";

const pkg = readJson(join(root, "package.json"));
const plugin = readJson(join(pluginDir, ".claude-plugin", "plugin.json"));
const opencodeDir = join(root, "plugin", "opencode");
const opencode = readJson(join(opencodeDir, "package.json"));
const marketplace = readJson(join(root, ".claude-plugin", "marketplace.json"));
const mcp = readJson(join(pluginDir, ".mcp.json"));
const hooks = readJson(join(pluginDir, "hooks", "hooks.json"));

const reservedPrefix = /^(claude|anthropic|anthropics|cc-plugin)[-_]/i;
const reservedNames = /^(claude|anthropic|anthropics|claude-code|claude-mods)$/i;
const secretLike = /(token|secret|password|credential|api[-_]?key)/i;

function assertAllowedName(name, what) {
  assert.match(name, /^[a-z][a-z0-9-]*$/, `${what} must be kebab-case`);
  assert.doesNotMatch(name, reservedPrefix, `${what} uses a reserved prefix`);
  assert.doesNotMatch(name, reservedNames, `${what} is a reserved name`);
  assert.doesNotMatch(name, /\b(claude|anthropic|anthropics)\b/i, `${what} must not contain a vendor name`);
}

// Versions live in git tags only: without a manifest version Claude Code versions the
// plugin by commit SHA, so every commit on the tracked branch reaches users.
test("no manifest pins a version", () => {
  assert.equal(pkg.version, undefined, "package.json must not carry a version (tags do)");
  assert.equal(plugin.version, undefined, "plugin.json must not pin a version");
  assert.equal(opencode.version, undefined, "OpenCode package must not pin a version");
  assert.equal(marketplace.plugins[0].version, undefined, "the marketplace entry must not pin a version");
});

test("OpenCode package exposes its NOVA skill plugin", () => {
  assert.equal(opencode.name, "nova-agent-kit-opencode");
  assert.equal(opencode.type, "module");
  assert.equal(opencode.license, pkg.license);
  assert.equal(opencode.exports["."], "./index.ts");

  const entrypointPath = join(opencodeDir, opencode.exports["."]);
  assert.ok(existsSync(entrypointPath), "OpenCode package entrypoint must exist");
  const entrypoint = readText(entrypointPath);
  assert.match(entrypoint, /Plugin\.define\(\{/);
  assert.match(entrypoint, /ctx\.skill\.transform/);
  assert.match(entrypoint, /editor\.get\("nova"\)/, "do not replace an existing NOVA skill");
  assert.match(entrypoint, /Skill\.ID\.make\("nova"\)/);
  assert.match(entrypoint, /content: content\.trim\(\)/);
});

test("plugin.json has the required fields", () => {
  assertAllowedName(plugin.name, "plugin name");
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

test("marketplace.json points at ./plugin/claude with matching metadata", () => {
  assertAllowedName(marketplace.name, "marketplace name");
  assert.ok(marketplace.owner?.name);
  assert.equal(marketplace.plugins.length, 1);
  const [entry] = marketplace.plugins;
  assert.equal(entry.name, plugin.name);
  assert.equal(entry.source, "./plugin/claude");
});

test(".mcp.json launches nova mcp without credentials", () => {
  assert.deepEqual(Object.keys(mcp.mcpServers), ["nova"]);
  const server = mcp.mcpServers.nova;
  assert.equal(server.command, "nova");
  assert.deepEqual(server.args, ["mcp", "--toolsets", "default,planning,motion"]);
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

test("hooks.json loads the NOVA bot as its only hooks module, with its state contract", () => {
  assert.deepEqual(hooks.modules, ["./register.tsx"]);
  assert.ok(existsSync(join(pluginDir, "hooks", "register.tsx")));
  assert.equal(plugin.types, "./types/index.d.ts");
  assert.ok(existsSync(join(pluginDir, "types", "index.d.ts")));
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
  assert.ok(!isDirectory(join(pluginDir, "bin")), "plugin/claude/bin is not allowed");
  for (const dir of [pluginDir, opencodeDir]) {
    for (const rel of walk(dir)) {
      assert.doesNotMatch(rel, /(^|\/)bin\//, `${dir}/${rel} is inside a bin/ directory`);
    }
  }
  assert.ok(!existsSync(join(pluginDir, "CLAUDE.md")));
});

test("plugin contains exactly the generated skill, the NOVA bot and manifests", () => {
  const files = walk(pluginDir);
  const skillFiles = walk(join(root, "skill")).map((f) => `skills/nova/${f}`);
  const expected = [
    ".claude-plugin/plugin.json",
    ".mcp.json",
    "hooks/check-nova.sh",
    "hooks/hooks.json",
    ...skillFiles,
    ...walk(botSourceDir),
  ].sort();
  assert.deepEqual(files, expected);
});
