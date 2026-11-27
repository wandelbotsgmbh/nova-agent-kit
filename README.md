# nova-agent-kit

Skills and plugins for building on [Wandelbots NOVA](https://www.wandelbots.com) with AI
coding agents. One shared skill teaches an agent the `nova` CLI - app development, the
catalog, Nucleus files, Isaac Sim streaming sessions, troubleshooting - together with the safety rules for working next to
robots. Adapters for each agent are generated from that skill.

| Agent | Adapter | Status |
| --- | --- | --- |
| Claude Code | `plugin/claude/` (via marketplace) | supported |
| Any agent that reads `.agents/skills/` | `.agents/skills/nova/` | supported |
| OpenCode V2 | `plugin/opencode/` or `.agents/skills/nova/` | see [HARNESSES.md](HARNESSES.md) |
| pi | `.agents/skills/nova/` (read directly) | documented, see [HARNESSES.md](HARNESSES.md) |
| Cursor, Codex | - | planned, see [HARNESSES.md](HARNESSES.md) |

## Prerequisites

- The `nova` CLI, installed from
  [its releases](https://github.com/wandelbotsgmbh/nova-cli/releases). The kit documents the
  CLI; it does not install it.
- An instance to work against: `nova instance select <name>` for a hosted instance, or
  `nova config set host <url>` for any other reachable one.

## Install

### Claude Code

Pick a channel when you add the marketplace, then install the plugin:

```text
/plugin marketplace add wandelbotsgmbh/nova-agent-kit#release
/plugin install nova@nova-agent-kit
```

`#release` is the stable channel. Leave it out to follow `main`, which gets every merged
change first (the `-rc` releases). Both channels use the marketplace name `nova-agent-kit`,
so add only one of them. To switch channels, remove the marketplace and add the other one:

```text
/plugin marketplace remove nova-agent-kit
/plugin marketplace add wandelbotsgmbh/nova-agent-kit
/plugin install nova@nova-agent-kit
```

Claude Code does not auto-update plugins from third-party marketplaces by default. Turn it on
in `/plugin` > Marketplaces, or run `claude plugin update nova@nova-agent-kit` yourself.

The repository is private for now, so your `gh` or git credentials need access to it. From a
local checkout, use `/plugin marketplace add /path/to/nova-agent-kit` instead; that follows
whatever is checked out there, not a channel.

To offer the plugin to everyone working in a project, declare the marketplace and its channel
in the project's `.claude/settings.json`. Claude Code then asks each user to install it when
they trust the project folder:

```json
{
  "extraKnownMarketplaces": {
    "nova-agent-kit": {
      "source": { "source": "github", "repo": "wandelbotsgmbh/nova-agent-kit", "ref": "release" }
    }
  },
  "enabledPlugins": { "nova@nova-agent-kit": true }
}
```

The plugin adds:

- the `nova` skill (`/nova:nova`), loaded automatically when a task mentions NOVA;
- a session-start hook that tells the agent when `nova` is missing from `PATH`;
- the MCP server `nova`, started as `nova mcp --toolsets default,planning,motion`: reads
  instance state, and plans and runs motion on virtual controllers only (physical ones answer
  `APPROVAL_REQUIRED`);
- the NOVA bot: a small pixel-art robot above the prompt that reacts to what the agent is
  doing. It thinks, puts on a hard hat while `nova` commands run, cheers when a turn is done
  and falls asleep when nothing happens. It is just for fun and changes nothing about how the
  agent works. `/nova-bot` hides it and shows it again; the choice is remembered across
  sessions. Terminals that can show images (for example Ghostty, kitty or WezTerm) draw it in
  real pixels; other terminals use block characters. `/nova-bot hd` or `/nova-bot blocks`
  forces one of the two, `/nova-bot auto` goes back to asking the terminal; that choice is
  remembered too. It is built on Claude Code's
  hooks-module API, which is in early access and may change between Claude Code releases.

### OpenCode V2

Install the NOVA plugin from the stable `release` branch with OpenCode's plugin manager:

```sh
opencode plugin add 'github:wandelbotsgmbh/nova-agent-kit#release::path:plugin/opencode'
```

Use `#main` instead to follow the preview channel. The repository is private; your Git
credentials need access. The plugin registers the NOVA skill and its references without a
manual copy. In the terminal, an animated pixel-art robot reacts to the current chat
and tool activity. Its quips are decoration, not robot status. Use `/nova-bot` to
show or hide it, or `/nova-bot hd`, `/nova-bot blocks`, or `/nova-bot auto` to pick
its style. OpenCode draws both styles with terminal characters.
Mention `@nova` in a prompt to load the skill explicitly. The `nova` CLI remains a
prerequisite, and MCP is configured separately.

For local development, use the absolute path to the generated `plugin/opencode/` directory
in the `plugins` array of `opencode.json(c)`. To hide just the robot, use a plugin entry with
`"options": { "mascot": false }`.

### Agents that read `.agents/skills/`

Copy `.agents/skills/nova/` into your project's `.agents/skills/` directory (or wherever your
agent looks for skills). Without hooks and MCP the skill runs in degraded mode: it tells the
agent to check `nova version` itself before doing anything else.

OpenCode and pi discover `.agents/skills/` on their own, in the project and in the home
directory (`~/.agents/skills/`). To add the MCP server as well:

```jsonc
// OpenCode: opencode.json
{ "mcp": { "nova": { "type": "local", "command": ["nova", "mcp", "--toolsets", "default,planning,motion"] } } }
```

```sh
# pi
pi mcp add nova -- nova mcp --toolsets default,planning,motion
```

### Offline and air-gapped use

The skill is static Markdown and needs no network access. Copy this repository to the target
machine and install from the local path as described above. The `nova` CLI has to be present
as well; `nova app install --copy-image` (documented in the skill) installs apps on instances
that cannot pull from a registry. `nova mcp` runs locally and only talks to the configured
instance.

## Repository layout

```text
skill/                    the shared skill: SKILL.md + reference/*.md
nova-bot/                 shared NOVA bot logic and artwork - hand-edited
adapters/claude/          Claude Code bot hook and state types - hand-edited
adapters/opencode/        OpenCode server and terminal plugin sources
scripts/build.mjs         generates the adapters below from the sources above
plugin/claude/            generated Claude Code plugin, including the NOVA bot
plugin/opencode/          generated OpenCode V2 plugin, including the NOVA bot
.claude-plugin/           generated marketplace manifest pointing at ./plugin/claude
.agents/skills/nova/      generated plain skill tree
test/                     node:test suite
evals/                    eval cases for `claude plugin eval` (not run in CI)
```

See [CONTRIBUTING.md](CONTRIBUTING.md) to get started, [AGENTS.md](AGENTS.md) for how to
change the skill and run the checks, and [HARNESSES.md](HARNESSES.md) for what each agent
supports. Report vulnerabilities as described in [SECURITY.md](SECURITY.md).

## Versioning

Releases work as in the nova-cli repository: every merge to `main` with a `feat` or `fix`
commit gets an `x.y.z-rc.N` prerelease, and promoting a verified rc to the `release` branch
cuts the stable `x.y.z`. The version lives in git tags only; the manifests carry no
`version`, so Claude Code versions the plugin by commit SHA and every commit on a channel is
an update. [RELEASING.md](RELEASING.md) explains the steps and the reasons.

## License

[Apache-2.0](LICENSE)
