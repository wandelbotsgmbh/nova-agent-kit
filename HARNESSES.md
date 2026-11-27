# Harness support

Which agent harness supports which part of the kit. "Verified" means the adapter was
installed and a session confirmed the behaviour on that date; re-verify after harness updates
and update the date.

| Harness | Adapter | Skill frontmatter | `reference/` files | Session-start hook | MCP (`nova mcp`) | Status | Last verified |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Claude Code | `plugin/claude/` via `.claude-plugin/marketplace.json` | `name`, `description`, `license` | read on demand | yes (`hooks/hooks.json`) | yes (`.mcp.json`) | supported | 2026-10-31 |
| Agents reading `.agents/skills/` ([Agent Skills spec](https://agentskills.io)) | `.agents/skills/nova/` | `name`, `description`, `license` | read on demand | no - degraded mode | no - configure `nova mcp` in the agent if wanted | supported | 2026-10-31 |
| [OpenCode V2](https://opencode.ai/docs/skills/) | `plugin/opencode/` (skill + terminal bot), or `.agents/skills/nova/` (skill only) | `name`, `description`, `license` | read on demand | session creation, with first model request as fallback (plugin only) | configure separately | plugin smoke-tested on 2.3.0; full workflow not yet verified | 2026-11-27 |
| [pi](https://pi.dev) | `.agents/skills/nova/` (read directly; also `.pi/skills/`) | `name`, `description`, `license` | read on demand | no - degraded mode (extensions offer `session_start`) | yes, via `.pi/mcp.json` or `pi mcp add` (see README) | documented, not yet verified | - |
| Cursor | `cursor-plugin/` | - | - | - | - | planned | - |
| Codex | - | - | - | - | - | planned | - |

"Documented" means the harness documentation states the behaviour; move it to "supported" with a
date after running the verification steps below. A pi package (`package.json` with a `pi.skills`
entry) is a possible follow-up.

Subagent definitions (`skill/agents/`) are not part of the kit yet; the column will be added
when they are.

## Degraded mode

The skill does not depend on hooks or MCP. Its "Before you start" section tells the agent to
run `nova version` itself, pick the instance, and read configuration without printing
credentials. A harness that only loads `SKILL.md` and can run shell commands gets the full
workflow; the hook only saves the agent a step when `nova` is missing.

## How to verify a harness

1. Install the adapter the way a user would (see `README.md`).
2. Start a session in a directory without a NOVA app and ask for something the skill covers,
   for example "install the app in this directory on my NOVA instance". The agent should
   read `reference/app-dev.md` and propose `nova app install`.
3. Ask it to delete an app. It must ask for confirmation first.
4. Remove `nova` from the harness's `PATH`, start a new session and ask for a NOVA task.
   With hook support the agent gets the missing CLI notice before it calls `nova`;
   without the hook it finds out when it tries `nova version`.
5. Record the result and the date in the table above.
