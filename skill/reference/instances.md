# Instances

The CLI keeps a local list of named instances and works against the selected one. Settings
such as `host` and `cellname` are stored per instance.

| Kind | What it is | Managed with |
| --- | --- | --- |
| `cloud` | a hosted instance on portal.wandelbots.io | `nova instance create`, `start`, `stop`, `delete` |
| `host` | any reachable NOVA host, for example an on-premise IPC | `nova instance add`, `remove` |
| `k8srun` | a Wandelbots-internal Kubernetes cluster with NOVA OS | `nova k8srun` (Wandelbots network only) |

## Choose the target

```sh
nova instance list                 # '*' marks the selected instance
nova instance select <name>        # change the default for all later commands
nova instance info [name]          # kind, host, cell; secrets are redacted
nova --instance <name> app list    # one invocation only; NOVA_INSTANCE=<name> does the same
```

Prefer `--instance <name>` (or `NOVA_INSTANCE`) over `nova instance select` when the user
did not ask to change the default: the selection is shared with the user's other terminals and
agent sessions. Never pass `--show-secrets` to `nova instance info`.

Register an on-premise IPC or another reachable host once:

```sh
nova instance add <name> --host <ip-or-url> --cell <cell>   # nothing changes on the host
nova instance remove <name>                                 # forgets the entry, touches nothing
```

`nova config set host <url>` and `nova config set cellname <name>` change the selected
instance's entry.

## Cloud instances

```sh
nova instance create --name <name>    # creates and selects it; --no-select keeps the selection
nova instance stop <name>
nova instance start <name>
nova instance extend [name]           # push the expiry out once
nova instance keep-alive [name]       # extend automatically until interrupted
nova instance delete <name>           # deletes the instance - ask first
```

`nova instance keep-alive [name] -- <command>` keeps the instance alive while the command
runs. Cloud instances have no kubeconfig and their NATS is not reachable from outside;
workflows that need either run against an IPC or a `k8srun` cluster.

## Kubeconfig of an instance

`nova instance kubeconfig` and `nova instance env` give access to the instance's Kubernetes
cluster, for `kubectl`, Skaffold or Helm. Read [cluster.md](cluster.md) before using it.

```sh
nova instance kubeconfig [name]          # prints the path of the kubeconfig, never its content
eval "$(nova instance env [name])"       # sets KUBECONFIG and NOVA_INSTANCE for this shell
eval "$(nova instance env --unset)"      # undo
```

- `host` instances: fetched once over SSH from k3s (needs `sudo` on the host) and stored
  under `~/.nova/instances/<name>/`. If the user already has the file, for example a copy of
  `/etc/rancher/k3s/k3s.yaml`, pass it with `--kubeconfig <file>` instead; no SSH is needed.
  `--refresh` fetches it again.
- Without a terminal, `sudo` cannot ask for a password. The one-time setup
  `nova instance kubeconfig <name> --ssh-user <user> --setup-ssh-key` prompts for the SSH and
  `sudo` passwords: ask the user to run it in their own terminal.
- `k8srun` clusters: the kubeconfig stored when the cluster was created.
- `cloud` instances: not available.

## k8srun clusters (Wandelbots staff only)

Clusters from a Wandelbots-internal service, reachable only from the Wandelbots network,
with a kubeconfig and a 12-hour lifetime. Use them when a workflow needs Kubernetes and no
device is at hand. Outside Wandelbots, use a cloud instance or `nova instance add`.

```sh
nova k8srun create --name <name>     # adds and selects it; fails if the name is taken
nova k8srun list
nova k8srun destroy <name>           # destroys the cluster - ask first
```

`nova k8srun create` without `--name`, and `--replace`, destroy an existing cluster first:
ask before running them. `nova virtual` is a deprecated alias of `nova k8srun`.

## Bootstrap NOVA on an IPC

`nova bootstrap all` installs NOVA OS into the Kubernetes cluster that `kubectl` currently
points to: namespace, pull secrets, the service manager and the system-owner secret, applied
with `kubectl apply`. It needs `nova login` first. Run it only when the user asks to install
NOVA on a device, after confirming the `kubectl` context with them (see
[cluster.md](cluster.md)). `--dry-run` prints the manifests without applying them. Behind a
TLS-inspecting proxy, `--use-k3s-proxy-env` and `--ca-certificates <pem>` carry the proxy
settings into the cluster; see `nova bootstrap all --help`.

## Licenses

```sh
nova license get         # license of the selected instance
nova license activate    # fetches the license with the user's portal login
```

`nova license activate` needs a current `nova login`; if it fails with an authentication
error, ask the user to run `nova login` in their own terminal.
