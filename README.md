# nova-agent-kit

Skills and plugins for building on [Wandelbots NOVA](https://www.wandelbots.com) with AI
coding agents. One shared skill teaches an agent the `nova` CLI - app development, the
catalog, Nucleus files, troubleshooting - together with the safety rules for working next to
robots. Adapters for each agent are generated from that skill.

| Agent | Adapter | Status |
| --- | --- | --- |
| Claude Code | `plugin/` (plugin + marketplace) | supported |
| Any agent that reads `.agents/skills/` | `.agents/skills/nova/` | supported |
| OpenCode, pi | `.agents/skills/nova/` (read directly) | documented, see [HARNESSES.md](HARNESSES.md) |
| Cursor, Codex | - | planned, see [HARNESSES.md](HARNESSES.md) |

## Prerequisites

- The `nova` CLI, installed from
  [its releases](https://github.com/wandelbotsgmbh/nova-cli/releases). The kit documents the
  CLI; it does not install it.
- An instance to work against: `nova instance select <name>` for a hosted instance, or
  `nova config set host <url>` for any other reachable one.

## Install

### Claude Code

```text
/plugin install nova --marketplace wandelbotsgmbh/nova-agent-kit
```

Older Claude Code versions use two steps: `/plugin marketplace add wandelbotsgmbh/nova-agent-kit`,
then `/plugin install nova@nova-agent-kit`. The repository is private for now, so your `gh`
or git credentials need access to it; from a local checkout, use
`/plugin marketplace add /path/to/nova-agent-kit` instead.

The plugin adds:

- the `nova` skill (`/nova:nova`), loaded automatically when a task mentions NOVA;
- a session-start hook that tells the agent when `nova` is missing from `PATH`;
- the MCP server `nova`, started as `nova mcp`. It is experimental; the skill prefers the CLI.

#### Optional: the NOVA bot

A second plugin in the same marketplace adds a small pixel-art robot above the prompt. It
reacts to what the agent is doing: it thinks, puts on a hard hat while `nova` commands run,
cheers when a turn is done and falls asleep when nothing happens. It is just for fun and
changes nothing about how the agent works.

```text
/plugin install nova-bot --marketplace wandelbotsgmbh/nova-agent-kit
```

`/nova-bot` hides the robot and shows it again; the choice is remembered across sessions.
`/plugin disable nova-bot` turns the plugin off. Terminals that can show images (for example
Ghostty, kitty or WezTerm) draw the robot in real pixels; other terminals draw it with block
characters. The plugin is built on Claude Code's hooks-module API, which is in early access
and may change between Claude Code releases.

### Agents that read `.agents/skills/`

Copy `.agents/skills/nova/` into your project's `.agents/skills/` directory (or wherever your
agent looks for skills). Without hooks and MCP the skill runs in degraded mode: it tells the
agent to check `nova version` itself before doing anything else.

OpenCode and pi discover `.agents/skills/` on their own, in the project and in the home
directory (`~/.agents/skills/`). To add the MCP server as well:

```jsonc
// OpenCode: opencode.json
{ "mcp": { "nova": { "type": "local", "command": ["nova", "mcp"] } } }
```

```sh
# pi
pi mcp add nova -- nova mcp
```

### Offline and air-gapped use

The skill is static Markdown and needs no network access. Copy this repository to the target
machine and install from the local path as described above. The `nova` CLI has to be present
as well; `nova app install --copy-image` (documented in the skill) installs apps on instances
that cannot pull from a registry. `nova mcp` runs locally and only talks to the configured
instance.

## Repository layout

```text
skill/                    the skill: SKILL.md + reference/*.md - the only hand-edited content
nova-bot/                 the NOVA bot: hooks module, state types and icon - hand-edited
scripts/build.mjs         generates the adapters below from skill/ and nova-bot/
plugin/                   generated Claude Code plugin
plugin-nova-bot/          generated Claude Code plugin for the NOVA bot
.claude-plugin/           generated marketplace manifest pointing at both plugins
.agents/skills/nova/      generated plain skill tree
test/                     node:test suite
evals/                    eval cases for `claude plugin eval` (not run in CI)
```

See [AGENTS.md](AGENTS.md) for how to change the skill and run the checks, and
[HARNESSES.md](HARNESSES.md) for what each agent supports.

## Versioning

The version in `package.json` is the kit version; the build writes it into the plugin and
marketplace manifests. Release tagging is a follow-up.

## License

[Apache-2.0](LICENSE)
