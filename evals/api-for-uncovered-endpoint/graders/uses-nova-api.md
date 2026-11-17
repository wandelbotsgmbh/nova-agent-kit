---
type: llm
weight: 1
---

The response uses `nova api` to call the instance (ideally finding the operation with
`nova api search` or `nova api schema` first, and using `{cell}` or the configured cell in the
path). It does not tell the user to copy an access token into `curl` or another HTTP client.
