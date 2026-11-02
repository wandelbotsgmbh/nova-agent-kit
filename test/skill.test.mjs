import assert from "node:assert/strict";
import { existsSync, readdirSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { test } from "node:test";

import { isDirectory, parseFrontmatter, readText, root, skillDir, walk } from "./helpers.mjs";

const skillMd = readText(join(skillDir, "SKILL.md"));
const { fields, body } = parseFrontmatter(skillMd);

test("SKILL.md has the required frontmatter", () => {
  assert.ok(fields, "SKILL.md must start with a frontmatter block");
  assert.equal(fields.name, "nova");
  assert.ok(fields.description, "description is required");
  assert.ok(fields.description.length <= 1024, "description must be at most 1024 characters");
  assert.match(fields.description, /Use when/i, "description should say when to use the skill");
});

test("skill name matches the generated directories", () => {
  for (const dir of ["plugin/skills", ".agents/skills"]) {
    const entries = readdirSync(join(root, dir));
    assert.deepEqual(entries, [fields.name], `${dir} must contain exactly ${fields.name}/`);
  }
});

test("SKILL.md stays short", () => {
  const lines = skillMd.split("\n").length;
  assert.ok(lines < 500, `SKILL.md has ${lines} lines, limit is 500`);
});

test("references are one level deep", () => {
  const top = readdirSync(skillDir).sort();
  assert.deepEqual(top, ["SKILL.md", "reference"]);
  for (const entry of readdirSync(join(skillDir, "reference"))) {
    assert.ok(!isDirectory(join(skillDir, "reference", entry)), `reference/${entry} must be a file`);
    assert.match(entry, /\.md$/, `reference/${entry} must be markdown`);
  }
});

test("every reference file is linked from SKILL.md and every link resolves", () => {
  const linked = new Set(
    [...body.matchAll(/\]\((reference\/[^)#]+)\)/g)].map((m) => basename(m[1])),
  );
  const files = readdirSync(join(skillDir, "reference")).sort();
  assert.deepEqual([...linked].sort(), files, "SKILL.md must link each reference file exactly");
});

test("relative links in skill files resolve", () => {
  for (const rel of walk(skillDir)) {
    const file = join(skillDir, rel);
    const text = readText(file);
    for (const match of text.matchAll(/\]\(([^)]+)\)/g)) {
      const target = match[1].split("#")[0];
      if (!target || /^[a-z]+:/.test(target)) continue;
      const resolved = resolve(dirname(file), target);
      assert.ok(existsSync(resolved), `${rel}: link target ${target} does not exist`);
      assert.ok(resolved.startsWith(skillDir), `${rel}: link ${target} leaves the skill directory`);
    }
  }
});

test("skill content is agent neutral and avoids unavailable commands", () => {
  const plannedCommand = /nova\s+(api|agent|status)\b|-o json/;
  let plannedMentions = 0;
  for (const rel of walk(skillDir)) {
    const text = readText(join(skillDir, rel));
    assert.doesNotMatch(text, /\bBash tool\b/i, `${rel} must not reference a specific agent tool`);
    for (const paragraph of text.split(/\n\s*\n/)) {
      if (!plannedCommand.test(paragraph)) continue;
      assert.match(paragraph, /\bplanned\b/, `${rel} uses a planned command as if it existed`);
      plannedMentions += 1;
    }
  }
  assert.ok(plannedMentions <= 1, "planned commands are mentioned in at most one place");
});
