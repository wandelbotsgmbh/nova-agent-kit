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
- the MCP server `nova`, started as `nova mcp` (experimental; the skill prefers the CLI);
- the NOVA bot: a small pixel-art robot above the prompt that reacts to what the agent is
  doing. It thinks, puts on a hard hat while `nova` commands run, cheers when a turn is done
  and falls asleep when nothing happens. It is just for fun and changes nothing about how the
  agent works. `/nova-bot` hides it and shows it again; the choice is remembered across
  sessions. Terminals that can show images (for example Ghostty, kitty or WezTerm) draw it in
  real pixels; other terminals use block characters. It is built on Claude Code's
  hooks-module API, which is in early access and may change between Claude Code releases.

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
plugin/                   generated Claude Code plugin, including the NOVA bot
.claude-plugin/           generated marketplace manifest pointing at ./plugin
.agents/skills/nova/      generated plain skill tree
test/                     node:test suite
evals/                    eval cases for `claude plugin eval` (not run in CI)
```

See [AGENTS.md](AGENTS.md) for how to change the skill and run the checks, and
[HARNESSES.md](HARNESSES.md) for what each agent supports.

## Versioning

Releases work as in the nova-cli repository. The version number lives in git tags only:

- Every merge to `main` with a `feat` or `fix` commit (Conventional Commits) gets an
  `x.y.z-rc.N` prerelease on GitHub, with release notes.
- The **Promote** workflow (Actions > Promote > Run workflow, with a verified rc tag or
  commit) fast-forwards the `release` branch to that commit. The Release workflow then tags
  the stable `x.y.z`. By hand: `git push origin <sha>:release`.

The plugin and marketplace manifests carry no `version`, on purpose. Without one, Claude Code
versions the plugin by commit SHA (`/plugin` shows 12 hex digits), so every commit on the
branch a marketplace tracks counts as an update. A fixed version string would keep users on
their cached copy until someone changed it. `pnpm validate:plugin` therefore runs
`claude plugin validate` and fails on every warning except the missing version.

Publishing tags and releases is gated by the repository variable `RELEASE_ENABLED`; until it
is `true`, the Release workflow runs as a dry run.

## License

[Apache-2.0](LICENSE)
