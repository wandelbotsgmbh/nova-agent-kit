# Instances

The CLI keeps a local list of named instances: `cloud` (hosted on portal.wandelbots.io),
`host` (any reachable NOVA host, for example an on-premise IPC) and `k8srun` (a
Wandelbots-internal cluster, reachable only from the Wandelbots network). Flags and examples
are in `nova instance --help`; this page holds what the help does not say.

## Targeting

- Target an instance for one command with `nova --instance <name> ...` (or
  `NOVA_INSTANCE=<name>`). Run `nova instance select <name>` only when the user asks to change
  the default: the selection is shared with their other terminals and agent sessions.
- Register an IPC once with `nova instance add <name> --host <url>`; nothing changes on the
  host. `nova instance remove <name>` only forgets the entry.
- Check the target with `nova instance info`. Never add `--show-secrets`.

## Lifetime

Cloud instances and `k8srun` clusters expire. For long work, run
`nova instance keep-alive [name] -- <command>` or `nova instance extend [name]` instead of
recreating them. `nova instance delete` and `nova k8srun destroy` are destructive (see
`SKILL.md`).

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
