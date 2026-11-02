#!/bin/sh
# SessionStart hook: tell the agent when the nova CLI is missing.
if command -v nova >/dev/null 2>&1; then
  exit 0
fi
printf '%s\n' \
  'The nova CLI is not installed or not on PATH. The nova skill needs it for every command.' \
  'Install the latest release from https://github.com/wandelbotsgmbh/nova-cli/releases (unpack the archive and put the nova binary on PATH), then start a new session.' \
  'Until then, do not run nova commands; tell the user the CLI is missing.'
exit 0
