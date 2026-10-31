import assert from "node:assert/strict";
import { join } from "node:path";
import { test } from "node:test";

import { readText, root, walk } from "./helpers.mjs";

const patterns = [
  { name: "JWT", regex: /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{5,}/ },
  { name: "AWS access key", regex: /\bAKIA[0-9A-Z]{16}\b/ },
  { name: "GitHub token", regex: /\bgh[pousr]_[A-Za-z0-9]{30,}\b/ },
  { name: "private key", regex: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
  {
    name: "credential assignment",
    regex: /(token|secret|password|api[_-]?key)["']?\s*[:=]\s*["']?[A-Za-z0-9_\-/+=]{20,}/i,
  },
  // Instance hostnames identify customer or internal deployments.
  { name: "instance hostname", regex: /\b[a-z0-9-]+\.instance\.wandelbots\.io\b/i },
  { name: "cluster hostname", regex: /\b[a-z0-9.-]+\.(azurecr\.io|wabo\.run)\b/i },
];

const textFile = /\.(md|json|jsonc|mjs|js|yaml|yml|sh|txt)$/;

test("no secrets or internal hostnames in the repository", () => {
  const findings = [];
  for (const rel of walk(root, { ignore: [".git", "node_modules", "pnpm-lock.yaml"] })) {
    if (!textFile.test(rel)) continue;
    const text = readText(join(root, rel));
    for (const { name, regex } of patterns) {
      const match = text.match(regex);
      if (match) findings.push(`${rel}: ${name} (${match[0].slice(0, 40)})`);
    }
  }
  assert.deepEqual(findings, []);
});
