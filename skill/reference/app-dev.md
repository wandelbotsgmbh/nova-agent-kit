# App development

Apps are containers that run on a NOVA instance and appear on its home screen. The loop is:
create from a template, develop locally, install on the instance, then list or delete.

## Create an app

```sh
nova app create <name> -g python_app   # or nextjs_app, golang_app
```

`-g`/`--generator` selects the template; `python_app` is the default. The command creates a
`<name>/` directory containing at least:

- `.nova` - the app configuration the instance uses: `name`, `port`, `appIcon`, and optional
  `environment`, `imageRegistry`, `registryAuth`, `storage` and `resources` blocks.
- `.env` - `NOVA_API`, `NOVA_ACCESS_TOKEN`, `CELL_NAME`, `LOG_LEVEL`, pre-filled for the
  configured instance. It holds a secret: do not print or commit it.
- `Dockerfile`, `skaffold.yaml`, `k8s/app.yaml` - build and in-cluster development files.

The app name the instance knows is the `name` field in `.nova`, not the project name in
`pyproject.toml` or `package.json`. Use the `.nova` name with `nova app delete` and when
matching `nova app list` output.

## Python app loop

Python apps are built on the NOVA Python SDK, the `wandelbots-nova` package on PyPI
(`import nova`). Its source, examples (planning and executing, collision setups, several
robots, custom TCPs) and docs are at <https://github.com/wandelbotsgmbh/wandelbots-nova>; read
the example closest to the task before writing motion code. For a local 3D view, add the
`nova-rerun-bridge` extra: `uv add wandelbots-nova --extra nova-rerun-bridge`.

The SDK ships an agent skill, `nova-app-review`, that reviews an app for safety, motion, I/O
and async problems. Suggest installing it into the app project with `uv run nova-skills
install`, and re-run that after upgrading the SDK.

Requires [uv](https://docs.astral.sh/uv/getting-started/installation/). Layout of a generated
Python app:

```text
app/
  __main__.py            # `python -m app` -> register_programs.main()
  register_programs.py   # FastAPI app; Novax scans programs/ and registers every @nova.program
  programs/
    start_here.py        # example program
pyproject.toml           # [project.scripts] app = "app.register_programs:main"
```

Commands, run inside the app directory:

| Step | Command |
| --- | --- |
| Install dependencies (also implied by `uv run`) | `uv sync` |
| Start the server locally against the instance in `.env` | `uv run app` -> <http://localhost:3000>, API docs at `/docs` |
| Format and sort imports | `uv run ruff format` and `uv run ruff check --select I --fix` |

### Writing a program

Drop a module into `app/programs/`. Every `async` function decorated with `@nova.program` is
discovered on startup; no import or registration code is needed. A program receives
`ctx: nova.ProgramContext` and may take extra keyword arguments with defaults, which become
parameters in the API.

```python
import nova
from nova import api
from nova.actions import cartesian_ptp, joint_ptp, linear
from nova.cell import virtual_controller
from nova.types import MotionSettings, Pose


@nova.program(
    id="move_square",            # defaults to the function name
    name="Move square",
    preconditions=nova.ProgramPreconditions(
        controllers=[
            virtual_controller(
                name="kuka-kr16-r2010",
                manufacturer=api.models.Manufacturer.KUKA,
                type="kuka-kr16_r2010_2",
            )
        ],
        cleanup_controllers=False,
    ),
)
async def move_square(ctx: nova.ProgramContext, side_mm: int = 200):
    cell = ctx.cell
    controller = await cell.controller("kuka-kr16-r2010")
    cycle = ctx.cycle(extra={"program": "move_square"})

    motion_group = controller[0]
    home = await motion_group.joints()
    tcp = (await motion_group.tcp_names())[0]
    start = await motion_group.tcp_pose(tcp)

    actions = [
        joint_ptp(home, settings=MotionSettings(tcp_velocity_limit=50)),
        cartesian_ptp(start @ Pose((side_mm, 0, 0, 0, 0, 0))),
        linear(start @ Pose((side_mm, side_mm, 0, 0, 0, 0))),
        linear(start @ Pose((0, side_mm, 0, 0, 0, 0))),
        joint_ptp(home),
    ]

    await cycle.start()
    trajectory = await motion_group.plan(actions, tcp)
    await motion_group.execute(trajectory, tcp, actions=actions)
    await cycle.finish()
```

Notes:

- `preconditions` declares the controllers the program needs. `virtual_controller(...)`
  creates a virtual robot in the cell if it is missing - the right choice while developing.
  Programs meant for a physical robot are started by a person from the instance UI, where the
  planned path is previewed and approved; never trigger them yourself (see the motion rules in
  `SKILL.md`).
- `plan` computes the trajectory (collision and limit checks happen on the instance);
  `execute` runs it. Leave `execute` out to only inspect a plan.
- `nova.viewers.Rerun()` as a `viewer=` argument gives a local 3D view; keep it disabled for
  images that run in the cluster.
- The app may be served under a path prefix in production (for example `/cell/<app-name>`).
  `register_programs.py` reads `BASE_PATH` for this; build links relative to it and never
  hard-code `/`.

### Poses for a real robot

Poses computed or tried out on a virtual robot rarely fit the physical cell: fixtures, parts
and the tool sit somewhere slightly different. A program meant for real hardware needs its
poses taught or corrected on the real robot, and that is work for a person at the cell, not
for you.

- Keep poses as named, documented values (program parameters or configuration), not as
  coordinates scattered through the code, and list for the user which ones must be taught.
- The person teaches and adjusts them, jogs the robot and test-runs programs, with the
  Teaching app (below) or the robot's teach pendant.
- Never jog, teach or move the physical robot yourself to find a pose (see the motion rules
  in `SKILL.md`).

#### The Teaching app

The Teaching app brings robot teaching into the browser. It shows the robot in 3D, keeps the
cell's poses and frames in a tree, and lets a person jog the robot, teach new poses, edit
existing ones and run routines and programs. It also loads datasets. It works with physical
and virtual robots, including on hosted instances.

Suggest it when the user has to:

- teach or correct the poses a program needs on the real cell
- move the robot by hand to check reach or clearances
- test-run a program on the cell before handing it over
- try out poses on a virtual robot before hardware is available

It is a catalog entry (beta, NOVA 26.7 or newer). When the user wants it, check
`nova version`, then run `nova catalog install teaching` (see [catalog.md](catalog.md)). It
appears in `nova app list` and as a tile on the home screen (`nova homescreen` opens it).

If the user needs help with it, tell them which poses to teach, under which names, and with
which tool (TCP), because the program reads exactly those. Then let them do the jogging and
saving in the app. You cannot see or operate its UI, so describe the goal of each step
instead of guessing at buttons or menus.

### Hot reload on the instance (Skaffold)

Use this when a program must be registered on the instance while you iterate, instead of
only running locally. Requirements: `kubectl` access to the instance cluster, which cloud
instances do not give (use an on-premise IPC or a `k8srun` cluster, see
[instances.md](instances.md)), [Skaffold](https://skaffold.dev/docs/install/), and a login to
the image registry named in `skaffold.env` (`SKAFFOLD_DEFAULT_REPO`; override with
`--default-repo`).

```sh
eval "$(nova instance env <name>)"   # KUBECONFIG and NOVA_INSTANCE for this shell
kubectl config view --minify -o jsonpath='{.clusters[0].cluster.server}'   # the right host?
skaffold dev
```

Skaffold deploys the `App` resource from `k8s/app.yaml`; the in-cluster operator turns it
into a deployment and the home-screen tile, so no `nova app install` is needed in this mode.
The `App` sets `DEV_RELOAD=true`, the container runs `uvicorn --reload`, and Skaffold syncs
changed files under `app/` into the pod. Adjust namespace and environment in `k8s/app.yaml`
for the target cell.

## Other templates

Custom actions for NOVA Flow are created with `nova flow action create`; see
[flow.md](flow.md).

`nextjs_app` and `golang_app` generate the same `.nova` and container files around a Next.js
or Go project. The Next.js template keeps the instance URL, cell and access token in
`.env.local`, which is as secret as `.env`. Follow the generated `README.md` for their local
dev loop; installing works the same way as below.

## Design system for app UIs

Before building an app's UI, ask the user which design system to use. Without a preference,
use the Wandelbots NOVA design system, published on npm:

- `@wandelbots/design-tokens` (colors, spacing, typography as CSS variables and JS),
  `@wandelbots/fonts` and `@wandelbots/icons`.
- One UI layer, never both: `@wandelbots/mui` (a MUI theme and components) or
  `@wandelbots/hui` (headless components on Base UI). The `nextjs_app` template already uses
  MUI and `@wandelbots/wandelbots-js-react-components` (robot UI such as jogging and 3D
  views), so pick `@wandelbots/mui` there.
- Tokens, icons and live components: <https://wandelbotsgmbh.github.io/nova-design-system/>;
  `llms.txt` at the same address is the agent-readable version.

Use tokens instead of hard-coded colors and sizes, and do not copy components out of the
packages.

## Install on the instance

Run inside the app directory, or pass the directory as `source`:

```sh
nova app install
nova app install ./my-app
```

This builds the image with the local container runtime (Docker, falling back to Podman;
override with `nova config set container-runtime docker|podman`), pushes it to the configured
registry, and installs the app on the configured instance - or updates it when an app with
that name already exists. The registry must be set once with
`nova config set image-registry <registry>` (a `.nova` file can override it), and the user
must be logged in to it with `docker login <registry>` or `podman login <registry>`.
Credentials for pulling come from the local Docker configuration by default:

- `-o`, `--omit-credentials` - use the instance's default pull secrets instead.
- `-r`, `--registry-secret <name>` - use a named Kubernetes secret on the instance instead.

### Instances without registry access

For an instance that cannot pull from a registry (air-gapped, on-premise), copy the image over
SSH and import it on the host:

```sh
nova app install --setup-ssh-key --ssh-user <user>   # once per instance host
nova app install --copy-image --ssh-user <user>
```

- `--setup-ssh-key` installs your SSH public key and a passwordless sudo rule for the import
  on the instance host. It needs the user's password once; let the user run it if it prompts.
- `--copy-image` transfers the built image with `scp` and imports it with
  `k3s ctr images import` (change with `--import-command`), staging it in `/tmp`
  (`--remote-dir`).
- `--ssh-port <port>` when SSH is not on the default port; `--no-sudo` when connecting as
  root.

## List, edit, delete

```sh
nova app list            # apps installed on the configured instance
nova app edit <name>     # interactive: opens the app configuration in the user's editor
nova app delete <name>   # removes the app immediately - ask the user first
```

`nova app edit` needs a person at the editor; ask the user to run it, or describe the change
for them. `nova app delete` has no confirmation prompt; confirm the exact app name with the
user before running it.
