# NOVA Flow

NOVA Flow runs flows (behavior trees) on a cell. `nova flow` installs it on the configured
cell and reads, writes, backs up and deletes flows; it does not run them - a person starts a
flow from the editor (`nova flow open`). Flags and examples are in `nova flow --help`; this
page holds what the help does not say.

## Rules

- Start with `nova flow status`. `open`, `push` and `backup restore` offer to install NOVA Flow
  when it is missing; install it only when the user asked for that.
- Edit a flow as a file: `nova flow get <id> -o <id>.json`, change it, then
  `nova flow push <id>.json --validate`. If the push fails because the flow changed on the
  instance, get it again and reapply the change; do not use `--force`. `nova flow edit` does
  the same in the user's editor, so it is for the user to run.
- For authoring flows from an agent, `nova flow mcp` serves NOVA Flow's own MCP server over
  stdio (NOVA Flow 2026.9 or newer). Suggest it to the user; do not change their MCP
  configuration yourself.
- Ask before pushing a flow the user did not ask you to change, and before any push to a cell
  with a physical robot: the next start runs what you pushed.
- `nova flow backup download` before `nova flow delete`, `nova flow uninstall`, a restore with
  `--overwrite`, or deleting a cell. Run `nova flow backup restore <file> --dry-run` first and
  show the user what would be replaced.
- `--include-objects` adds the cell object store, which holds other apps' data too: keep such
  an archive local.
- The help suggests `--yes` for scripts and agents. Use it only to carry out a delete or
  uninstall the user has confirmed for that exact flow or cell ([safety.md](safety.md)).

## The flow file

A flow is a behavior tree in JSON: a `version` (currently `"3.0"`), a `root` node and
optional `inputs`.

- Flow-control nodes (sequences, selectors, decorators, conditions) run in NOVA Flow itself.
  Action nodes (`"kind": "action"`) name a `service` and an `operation`, for example
  `CoreService.MotionRoutine`, and pass their parameters in `data`.
- A tree is control flow, not a dataflow graph. A branch or gate is a `Condition` node that
  reads the blackboard, not an action that returns a boolean.
- NOVA Flow checks action nodes against the schemas their services registered, so
  `--validate` catches a wrong operation and most parameter errors before the push.
  References (`{"ref": ...}`) nested inside `data` are not checked and fail only when the flow
  runs; check them against the blackboard and inputs yourself. Leave nodes you were not asked
  to change as they are.

## Custom actions

Action services are built with the `wandelbots-novaflow` Python package (PyPI): an
`ActionService` with one `@service.action` per operation, each with Pydantic input and output
models. `nova flow action create <name> --action <Name>` creates such a service without
questions. It needs `uv`, `git` and read access to the action template, which is not public
yet; if the command cannot fetch it, tell the user. Running it locally (`uv run run.py`)
needs the instance's NATS, which IPCs allow and cloud instances do not. Deploy it like an app
([app-dev.md](app-dev.md)); its `.env` holds an access token.
