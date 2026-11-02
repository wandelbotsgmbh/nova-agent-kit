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

### Hot reload on the instance (Skaffold)

Use this when a program must be registered on the instance while you iterate, instead of
only running locally. Requirements: `kubectl` access to the instance cluster (`KUBECONFIG`),
[Skaffold](https://skaffold.dev/docs/install/), and a login to the image registry named in
`skaffold.env` (`SKAFFOLD_DEFAULT_REPO`; override with `--default-repo`).

```sh
skaffold dev
```

Skaffold deploys the `App` resource from `k8s/app.yaml`; the in-cluster operator turns it
into a deployment and the home-screen tile, so no `nova app install` is needed in this mode.
The `App` sets `DEV_RELOAD=true`, the container runs `uvicorn --reload`, and Skaffold syncs
changed files under `app/` into the pod. Adjust namespace and environment in `k8s/app.yaml`
for the target cell.

## Other templates

`nextjs_app` and `golang_app` generate the same `.nova`, `.env` and container files around a
Next.js or Go project. Follow the generated `README.md` for their local dev loop; installing
works the same way as below.

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
nova app edit <name>     # opens the app configuration in $EDITOR (nova config set editor <cmd>)
nova app delete <name>   # removes the app immediately - ask the user first
```

`nova app delete` has no confirmation prompt; confirm the exact app name with the user before
running it.
