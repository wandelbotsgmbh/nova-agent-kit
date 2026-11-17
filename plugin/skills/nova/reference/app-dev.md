<!-- Generated from skill/reference/app-dev.md by scripts/build.mjs. Edit the source, then run `npm run build`. -->
# App development

Apps are containers that run on a NOVA instance and appear on its home screen: create from a
template, develop locally, install on the instance. Flags are in `nova app <command> --help`;
this page holds what the help does not say.

## Create

`nova app create <name> -g python_app` (or `nextjs_app`, `golang_app`, `rust_app`) creates `<name>/` with:

- `.nova` - what the instance uses: `name`, `port`, `appIcon`, optional `environment`,
  `imageRegistry`, `registryAuth`, `storage`, `resources`. The app name the instance knows is
  `name` here, not the project name in `pyproject.toml` or `package.json`; use it with
  `nova app delete` and when matching `nova app list`.
- `.env` (`.env.local` for Next.js) - instance URL, cell and an access token. Never print or
  commit it. `nova app update-env` refreshes it after a 401 or when the app should talk to
  another instance (`--reset`); on a portal instance it may start a login, which the user
  runs.
- `Dockerfile`, `skaffold.yaml`, `k8s/app.yaml`.

For Next.js, Go and Rust, follow the generated `README.md`. Custom NOVA Flow actions are created
with `nova flow action create` ([flow.md](flow.md)).

## Python apps

They use the NOVA Python SDK, `wandelbots-nova` on PyPI (`import nova`). Read the example
closest to the task in <https://github.com/wandelbotsgmbh/wandelbots-nova> before writing
motion code. The SDK ships an agent skill, `nova-app-review`, for safety, motion, I/O and
async problems: suggest `uv run nova-skills install` in the app project.

Needs [uv](https://docs.astral.sh/uv/). `uv run app` starts the server locally against the
instance in `.env` (<http://localhost:3000>, API docs at `/docs`).

- Every `async` function decorated with `@nova.program` in `app/programs/` is registered on
  startup. Keyword arguments with defaults become API parameters.
- `preconditions` with `virtual_controller(...)` creates the virtual robot if it is missing -
  the right choice while developing. Programs for a physical robot are started by a person
  from the instance UI ([safety.md](safety.md)).
- `motion_group.plan(...)` computes and checks the trajectory; `execute(...)` runs it. Leave
  `execute` out to only inspect a plan ([visualize.md](visualize.md)).
- The app may be served under a path prefix (`BASE_PATH`, for example `/cell/<app-name>`):
  build links relative to it.

## Poses for a real robot: datasets

Poses found on a virtual robot rarely fit the physical cell. Poses for real hardware are
taught or corrected by a person at the cell - never jog or move the physical robot to find
one. Keep them in a *dataset* on the cell, not in code: taught poses, the frames they are
expressed in, and command routines, with a numbered revision per change. Datasets need
NOVA 26.7 and `wandelbots-nova` 6.1.0 or newer; the API is experimental.

```python
from nova import datasets as ds
# in nova.ProgramPreconditions(...):
dataset=ds.remote_dataset("pick-and-place", revision=1),  # or ds.local_dataset("poses.json")
# in the program:
pick = ctx.dataset.poses["pick"].as_world()
```

- Always move to `.as_world()`; `.pose` is relative to the pose's frame.
- The identifier is not the display name; ask the user for it. A fixed `revision` keeps the
  program on known poses; without one it loads the latest.
- Tell the user which poses and frames the program expects, under which names and for which
  TCP. Deleting a revision needs the user's go-ahead.

The **Teaching app** (catalog entry `teaching`, NOVA 26.7 or newer) is where a person jogs
the robot, teaches and corrects poses and publishes a new dataset revision - typically when a
program moves from the virtual to the physical cell. Suggest it for that; install it with
`nova catalog install teaching` when the user wants it. After the person publishes
corrections, that revision is the source of truth: do not overwrite it with simulated values.
For help using it, point to <https://docs.wandelbots.com/developer/datasets.md> rather than
describing buttons you cannot see.

## Hot reload on the instance (Skaffold)

Needs `kubectl` access (an IPC or `k8srun` cluster, not a cloud instance),
[Skaffold](https://skaffold.dev/docs/install/) and a registry login for
`SKAFFOLD_DEFAULT_REPO` in `skaffold.env`.

```sh
eval "$(nova instance env <name>)"
kubectl config view --minify -o jsonpath='{.clusters[0].cluster.server}'   # the right host?
skaffold dev
```

Skaffold deploys `k8s/app.yaml`, the operator creates the deployment and tile, and changed
files under `app/` sync into the pod; no `nova app install` needed.

## UI design system

Ask the user which design system to use. Without a preference, use the Wandelbots NOVA design
system on npm: `@wandelbots/design-tokens`, `@wandelbots/fonts`, `@wandelbots/icons`, and one
UI layer - `@wandelbots/mui` (already used by `nextjs_app`) or `@wandelbots/hui`. Docs and
`llms.txt`: <https://wandelbotsgmbh.github.io/nova-design-system/>. Use tokens instead of
hard-coded colors and sizes.

## Install and update

`nova app install [dir]` builds the image (Docker, else Podman), pushes it to the registry
from `nova config set image-registry` (the user logs in with `docker login`), and installs
the app - or updates it, restarting its pod, when the name exists (ask first on a shared
cell, [safety.md](safety.md)).

- `--platform linux/arm64` for arm64 devices such as a Jetson; the default is `linux/amd64`.
- `--copy-image --ssh-user <user>` for instances that cannot pull from the registry: the
  image goes over SSH and is imported on the host. The one-time `--setup-ssh-key` asks for
  passwords, so the user runs it.
- `nova app install <manifest.json|yaml>` installs an existing image from an app manifest
  without building - also the way to update an app on an instance without a kubeconfig.
  Prefer it to sending the manifest with `curl` or `nova api`.

`nova app list` shows installed apps. `nova app delete <name>` has no prompt: confirm the
exact `.nova` name first.
