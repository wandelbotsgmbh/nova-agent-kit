<!-- Generated from skill/reference/flow.md by scripts/build.mjs. Edit the source, then run `npm run build`. -->
# NOVA Flow

NOVA Flow composes robot behavior as flows (behavior trees) that a control plane runs on a
cell. The `nova flow` commands act on the configured cell (`nova config set cellname <name>`);
they install NOVA Flow, read and write flows, and back them up. They do not run flows: a person
starts a flow from the editor on the instance.

## Check and install

```sh
nova flow status      # is NOVA Flow installed on the cell, which version, why not
nova flow install     # install it, or switch versions with --version <chart-version>
nova flow open        # open the editor in the user's browser
```

- `nova flow install` without `--version` installs the version that ships with the NOVA
  version and waits until NOVA Flow answers (`--no-wait` returns at once; check with
  `nova flow status`). `--version default` goes back to the shipped version after a failed
  switch. It needs NOVA 26.4 or newer; `--version` needs 26.8.
- On instances without the feature-flag API (cloud instances, NOVA before 26.4) it installs
  the `novaflow-installer` app from the preview catalog instead.
- `open`, `push` and `backup restore` offer to install NOVA Flow when it is missing. Do not
  answer that with `--yes` unless the user asked for the installation.

## Edit a flow

```sh
nova flow list
nova flow get <id> -o <id>.json          # flow with tree, layout, metadata and revision
nova flow push <id>.json --validate      # check on the instance, save only if valid
```

- Edit the file from `nova flow get`, then push it. The push fails if the flow changed on the
  instance in the meantime; run `nova flow get` again and reapply the change rather than
  pushing with `--force`, which overwrites the other change.
- Always push with `--validate`: the instance checks the schema, the available actions and the
  globals, and saves nothing if the tree is invalid.
- A bare tree (`{"version": ..., "root": ...}`) needs `--id <id>` and optionally `--name`.
- After a push, the file still carries the old revision: `nova flow get` before the next edit.
- `nova flow get <id> | jq .tree` prints only the tree.

Pushing a flow changes what the cell runs next time a person starts it. Pushing a flow that
the user did not ask you to change, or one used on a cell with a physical robot, needs the
user's go-ahead first.

## Back up and restore

```sh
nova flow backup download [file]                  # flows and globals, default novaflow-backup.tar.gz
nova flow backup restore <file> --dry-run         # what would be created, replaced or kept
nova flow backup restore <file>                   # restore what is missing, keep what exists
```

- `--include-objects` adds the cell object store. It is shared by all apps of the cell and can
  contain other apps' data; narrow it with `--object-prefix <prefix>` and do not upload or
  share the archive.
- `restore --overwrite` replaces existing flows, globals and objects; `--only <ids>` and
  `--skip-globals` narrow it. Run `--dry-run` first and show the user what would be replaced.
- Take a backup before `nova flow delete`, `nova flow uninstall`, or deleting a cell.

## Delete and uninstall

```sh
nova flow delete <id>     # asks; without a terminal it needs --yes
nova flow uninstall       # removes NOVA Flow from the cell; flows stay in the object store
```

Both ask for confirmation in a terminal. From an agent session they need `--yes`: pass it only
after the user confirmed that exact flow id or the uninstall.

## Custom actions

Flows call actions provided by Python action services. Create one with:

```sh
nova flow action create <name> --action <Name> --action <Name>:condition
```

`--action` makes the creation non-interactive (kinds: `action`, `condition`,
`state_provider`; up to 5). It needs `uv` and `git`, and read access to the action template,
which is not public yet; if the command cannot fetch it, tell the user. Develop it in the
generated project:

```sh
uv sync            # also writes uv.lock, which the Dockerfile needs
uv run pytest
uv run run.py      # actions show up in the flow editor within seconds
```

`uv run run.py` needs the instance's NATS, which on-premise and LAN instances allow and cloud
instances do not. Deploy it like any app with `nova app install .`, see
[app-dev.md](app-dev.md). The project's `.env` holds an access token: do not print or commit
it.
