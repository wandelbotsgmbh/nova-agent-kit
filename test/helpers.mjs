import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

export const root = dirname(dirname(fileURLToPath(import.meta.url)));
export const skillDir = join(root, "skill");
export const pluginDir = join(root, "plugin", "claude");
export const botSourceDir = join(root, "nova-bot");

export function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

export function readText(path) {
  return readFileSync(path, "utf8");
}

// Recursively lists files below dir as paths relative to dir, skipping ignored directories.
export function walk(dir, { ignore = [".git", "node_modules"] } = {}) {
  const out = [];
  const visit = (current) => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      if (ignore.includes(entry.name)) continue;
      const full = join(current, entry.name);
      if (entry.isDirectory()) visit(full);
      else out.push(relative(dir, full));
    }
  };
  visit(dir);
  return out.sort();
}

export function isDirectory(path) {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

// Parses the YAML-like `key: value` frontmatter block a SKILL.md starts with.
export function parseFrontmatter(markdown) {
  const match = markdown.match(/^---\n([\s\S]*?)\n---\n/);
  if (!match) return { fields: null, body: markdown };
  const fields = {};
  for (const line of match[1].split("\n")) {
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    fields[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
  }
  return { fields, body: markdown.slice(match[0].length) };
}

const shellLanguages = new Set(["", "sh", "bash", "shell", "console"]);

// Extracts every `nova …` invocation from shell code blocks and inline code spans and
// returns the unique subcommand paths, e.g. "app install". Flags, placeholders and shell
// syntax end a path. Paragraphs that talk about planned commands are skipped.
export function novaCommandPaths(markdown) {
  const snippets = [];
  for (const paragraph of markdown.split(/\n\s*\n/)) {
    if (/\bplanned\b/.test(paragraph)) continue;
    const block = paragraph.match(/^```([^\n]*)\n([\s\S]*?)\n```/);
    if (block) {
      if (shellLanguages.has(block[1].trim())) snippets.push(...block[2].split("\n"));
      continue;
    }
    for (const span of paragraph.matchAll(/`(nova(?:\s[^`\n]*)?)`/g)) snippets.push(span[1]);
  }

  const paths = new Set();
  for (const snippet of snippets) {
    for (const match of snippet.matchAll(/(?:^|[\s;&|(])nova((?:\s+[^\s;&|)]+)*)/g)) {
      const path = [];
      for (const token of match[1].trim().split(/\s+/).filter(Boolean)) {
        if (!/^[a-z][a-z0-9-]*$/.test(token)) break;
        path.push(token);
      }
      if (path.length) paths.add(path.join(" "));
    }
  }
  return [...paths].sort();
}
