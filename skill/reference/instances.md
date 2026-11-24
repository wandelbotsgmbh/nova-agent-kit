# Instances

The CLI keeps a local list of named instances: `cloud` (hosted on portal.wandelbots.io),
`host` (any reachable NOVA host, for example an on-premise IPC) and `k8srun` (a
Wandelbots-internal cluster, reachable only from the Wandelbots network). Flags and examples
are in `nova instance --help`; this page holds what the help does not say.

## Targeting

- Target an instance for one command with `nova --instance <name> ...` (or
  `NOVA_INSTANCE=<name>`). Run `nova instance select <name>` only when the user asks to change
  the default: the selection is shared with their other terminals and agent sessions.
- `nova instance create` and `nova k8srun create` select the new instance as well, which
  switches the user's other sessions. Pass `--no-select` and target it with `--instance`,
  unless the user asked for the switch.
- Register an IPC once with `nova instance add <name> --host <url>`; nothing changes on the
  host. `nova instance remove <name>` only forgets the entry.
- Check the target with `nova instance info`. Never add `--show-secrets`.

## Lifetime

A new instance needs a few minutes before NOVA answers: a `k8srun` cluster's Kubernetes
API works within seconds, but NOVA's API answers 404 or 503 until its services run. That is
not a network or VPN problem. `nova instance create` and `nova k8srun create` wait for it
(older CLI versions return at once from `k8srun create`); with `--no-wait`, check
`nova version` every 30 seconds instead of debugging the connection.

Cloud instances expire (7 days on prod), `k8srun` clusters after 12 hours. When the work
can outlast that, start `nova instance keep-alive <name>` as a background task and stop it
when the work is done, or run `nova instance keep-alive <name> -- <command>`. It extends
only shortly before the expiry. `nova instance extend [name]` extends once. Don't recreate
an expired instance without asking: its apps and data are gone. `nova instance delete` and
`nova k8srun destroy` are destructive ([safety.md](safety.md)).

`nova k8srun prune` forgets entries whose cluster is gone; it never releases a cluster.
Without a terminal it removes nothing unless `-y` is given: run it with `--dry-run` first and
pass `-y` only for entries the user agreed to drop.

An entry kept with `its kubeconfig ... has N contexts` holds credentials of other clusters
(kubectl or kind added them after `nova instance env`). `nova instance remove <name>` deletes
that file with them: ask the user first, so they can save the other contexts.

## Kubeconfig

`nova instance kubeconfig [name]` prints the path of the instance's kubeconfig, and
`eval "$(nova instance env [name])"` points the shell to it. Cloud instances have none.

- For a `host` instance the CLI fetches it over SSH with `sudo`. Without a terminal `sudo`
  cannot prompt, so the one-time `--setup-ssh-key` run is for the user to do in their own
  terminal. If the user already has a copy of the file, pass it with `--kubeconfig <file>`.
- Use it as described in [cluster.md](cluster.md).

## Bootstrap and licenses

- `nova bootstrap all` installs NOVA OS into whatever cluster `kubectl` points to. Run it
  only when the user asks to install NOVA on a device, after confirming the context with them
  (see [cluster.md](cluster.md)); `--dry-run` shows the manifests first.
- `nova license activate` uses the user's portal login. On an authentication error, ask the
  user to run `nova login` in their own terminal.
