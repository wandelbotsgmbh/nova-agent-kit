// Generates the agent adapters from skill/, nova-bot/ and adapters/.
// Output is deterministic; run `pnpm build` after changing those sources
// and commit the result. An optional argument writes the
// output below another directory instead of the repository root (used by the tests).
import {
  chmodSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, posix, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const outRoot = process.argv[2] ? resolve(process.argv[2]) : root;
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));

const skillDir = join(root, "skill");
const pluginDir = join(outRoot, "plugin", "claude");
const opencodeDir = join(outRoot, "plugin", "opencode");
const agentsSkillDir = join(outRoot, ".agents", "skills", "nova");
const marketplaceFile = join(outRoot, ".claude-plugin", "marketplace.json");
const botSourceDir = join(root, "nova-bot");

const repoUrl = "https://github.com/wandelbotsgmbh/nova-agent-kit";
const pluginName = "nova";
const description =
  "Work with Wandelbots NOVA through the nova CLI: create and install apps, use the catalog, manage Nucleus files and troubleshoot instances.";

function listFiles(dir, base = dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) =>
    a.name.localeCompare(b.name, "en"),
  )) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listFiles(full, base));
    else out.push(relative(base, full).split(sep).join(posix.sep));
  }
  return out;
}

function withGeneratedMarker(rel, content) {
  if (!rel.endsWith(".md")) return content;
  const marker = `<!-- Generated from skill/${rel} by scripts/build.mjs. Edit the source, then run \`npm run build\`. -->\n`;
  if (content.startsWith("---\n")) {
    const end = content.indexOf("\n---\n", 4);
    if (end !== -1) {
      const cut = end + "\n---\n".length;
      return content.slice(0, cut) + marker + content.slice(cut);
    }
  }
  return marker + content;
}

// Hooks-module sources get a comment line; other files are copied byte for byte.
function withGeneratedComment(rel, content) {
  if (!/\.(ts|tsx)$/.test(rel)) return content;
  return `// Generated from ${rel} by scripts/build.mjs. Edit the source, then run \`pnpm build\`.\n${content}`;
}

function writeFile(path, content, mode) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
  if (mode !== undefined) chmodSync(path, mode);
}

function writeJson(path, value) {
  writeFile(path, `${JSON.stringify(value, null, 2)}\n`);
}

function copySkill(dest) {
  for (const rel of listFiles(skillDir)) {
    const content = readFileSync(join(skillDir, rel), "utf8");
    writeFile(join(dest, rel), withGeneratedMarker(rel, content));
  }
}

// Uses only shell builtins so it also works when the hook runs with a minimal PATH.
const checkNovaScript = `#!/bin/sh
# SessionStart hook: tell the agent when the nova CLI is missing.
if command -v nova >/dev/null 2>&1; then
  exit 0
fi
printf '%s\\n' \\
  'The nova CLI is not installed or not on PATH. The nova skill needs it for every command.' \\
  'Install the latest release from https://github.com/wandelbotsgmbh/nova-cli/releases (unpack the archive and put the nova binary on PATH), then start a new session.' \\
  'Until then, do not run nova commands; tell the user the CLI is missing.'
exit 0
`;

rmSync(pluginDir, { recursive: true, force: true });
rmSync(opencodeDir, { recursive: true, force: true });
rmSync(agentsSkillDir, { recursive: true, force: true });
rmSync(marketplaceFile, { force: true });

copySkill(join(pluginDir, "skills", "nova"));
copySkill(join(opencodeDir, "skills", "nova"));
copySkill(agentsSkillDir);

writeJson(join(opencodeDir, "package.json"), {
  name: "nova-agent-kit-opencode",
  type: "module",
  license: pkg.license,
  exports: { ".": "./index.ts", "./tui": "./tui.tsx" },
  peerDependencies: {
    "@opentui/core": ">=0.6.6",
    "@opentui/solid": ">=0.6.6",
    "solid-js": ">=1.9.0",
  },
});
for (const rel of listFiles(join(root, "adapters", "opencode"))) {
  const source = `adapters/opencode/${rel}`;
  const content = readFileSync(join(root, source), "utf8").replaceAll('"../../nova-bot/', '"./nova-bot/');
  writeFile(join(opencodeDir, rel), withGeneratedComment(source, content));
}
for (const rel of listFiles(botSourceDir)) {
  if (rel === "assets/icon.png") continue;
  const content = withGeneratedComment(`nova-bot/${rel}`, readFileSync(join(botSourceDir, rel), "utf8"));
  for (const dir of [pluginDir, opencodeDir]) writeFile(join(dir, "nova-bot", rel), content);
}
writeFile(join(pluginDir, "assets", "icon.png"), readFileSync(join(botSourceDir, "assets", "icon.png")));
writeJson(join(pluginDir, ".claude-plugin", "plugin.json"), {
  name: pluginName,
  // No version: Claude Code then versions the plugin by commit SHA, so every
  // commit on the branch a marketplace tracks (main or release) is an update.
  // Release numbers live in git tags only, see .releaserc.json.
  description,
  author: { name: "Wandelbots" },
  homepage: repoUrl,
  repository: repoUrl,
  license: pkg.license,
  keywords: ["nova", "wandelbots", "robotics", "cli"],
  types: "./types/index.d.ts",
});

writeJson(join(pluginDir, "hooks", "hooks.json"), {
  hooks: {
    SessionStart: [
      {
        hooks: [
          {
            type: "command",
            command: '"${CLAUDE_PLUGIN_ROOT}/hooks/check-nova.sh"',
            timeout: 10,
          },
        ],
      },
    ],
  },
  // The NOVA bot, a hooks module (Claude Code's plugin API for code that runs in the session).
  modules: ["./register.tsx"],
});
writeFile(join(pluginDir, "hooks", "check-nova.sh"), checkNovaScript, 0o755);

writeJson(join(pluginDir, ".mcp.json"), {
  mcpServers: {
    nova: { command: "nova", args: ["mcp", "--toolsets", "default,planning,motion"] },
  },
});

// Claude's NOVA bot hooks module and state contract, copied into the plugin.
for (const rel of listFiles(join(root, "adapters", "claude"))) {
  const source = `adapters/claude/${rel}`;
  if (/\.(ts|tsx)$/.test(rel)) {
    const content = readFileSync(join(root, source), "utf8").replaceAll("'../../../nova-bot/", "'../nova-bot/");
    writeFile(join(pluginDir, rel), withGeneratedComment(source, content));
  } else writeFile(join(pluginDir, rel), readFileSync(join(root, source)));
}

writeJson(marketplaceFile, {
  name: "nova-agent-kit",
  owner: { name: "Wandelbots" },
  description: "Skills and plugins for building on Wandelbots NOVA with AI coding agents.",
  plugins: [
    {
      name: pluginName,
      source: "./plugin/claude",
      description,
    },
  ],
});

console.log(
  `Generated plugin/claude/, plugin/opencode/, .agents/skills/nova/ and .claude-plugin/marketplace.json in ${outRoot}`,
);
