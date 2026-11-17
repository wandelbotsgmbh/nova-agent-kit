# Troubleshooting

Work through these in order; most problems are a missing CLI, the wrong target, or a version
mismatch.

## 1. CLI missing

Tell the user to install the latest release and leave the install to them:
`brew install wandelbotsgmbh/wandelbots/nova` (macOS, Linux), the archive from
<https://github.com/wandelbotsgmbh/nova-cli/releases>, or the container
`ghcr.io/wandelbotsgmbh/nova-cli:latest`. The binaries are not signed yet, so macOS blocks the
first run until the user allows it.

## 2. Instance not reachable

`nova version` prints the CLI version, then fails on the instance; `nova version -v` adds the
configured host.

- Wrong target: check `nova instance info` and whether `NOVA_INSTANCE` is set. Fix with
  `nova --instance <name> ...` or, if the user wants to change the default,
  `nova instance select <name>`.
- A hosted instance may be stopped: `nova instance list`, then `nova instance start <name>`.
  An expired one is gone ([instances.md](instances.md)).
- Authentication error: the user runs `nova login` in their own terminal.
- An IPC that answers but misbehaves (apps not starting, controller not connecting): read its
  pods and logs, see [cluster.md](cluster.md).

## 3. Sandboxed agents

In a sandbox that routes network traffic through a proxy (Claude Code's sandbox among them),
requests to an IPC or `k8srun` address can fail with `Operation not permitted` while the same
command works in the user's terminal. Ask the user to allow the host in the sandbox's network
settings. If the host is already allowed and it still fails, the address may be listed in
`NO_PROXY`, which makes the request bypass the proxy that allows it: retry with
`NO_PROXY= nova ...`. Do not disable the sandbox to get around it.

## 4. Version mismatch

CLI and instance should be on matching release lines. A missing feature on an old instance
needs an instance update, `nova version set <version>`, which needs the user's go-ahead
([safety.md](safety.md)). Updating the CLI means installing a newer release.

When an endpoint or field seems missing, look at what the instance itself serves:
`nova api search <words>` and `nova api schema <operationId>` read its own API spec, which
can be ahead of or behind the SDK.

## 5. TLS errors

An on-premise instance may use a self-signed certificate. `nova --insecure-skip-tls-verify
<command>` disables the check for that invocation. Tell the user, use it only for the
instance they named, and never for hosted instances.

`x509: certificate signed by unknown authority` from `kubectl` with a saved kubeconfig
usually means the instance was recreated: fetch the kubeconfig again with
`nova instance kubeconfig <name>`.

## 6. Diagnostics

`nova diagnosis download` saves a diagnostic bundle - the way to get logs from a cloud
instance, which has no kubeconfig. It holds logs and configuration: pass it on as a file, do
not paste its contents.

## MCP server

The plugin starts `nova mcp` for the targeted instance. When a tool is missing, it is
probably in a toolset that is not enabled (`nova mcp --help` lists them). When a tool fails,
the same operation is available through `nova api`; run `nova version` to check the target
and login first. Do not edit the MCP configuration without asking the user.

## Reporting a problem

Give the user the exact command, its output with `token`, `password` and `secret` values
removed, the output of `nova version`, and whether the instance is hosted, on-premise or
virtual.
