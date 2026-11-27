import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Plugin, Skill } from "@opencode/plugin";

export default Plugin.define({
  id: "nova-agent-kit",
  async setup(ctx) {
    const path = fileURLToPath(new URL("./skills/nova/SKILL.md", import.meta.url));
    const [, frontmatter, content] =
      /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/.exec(readFileSync(path, "utf8")) ?? [];
    const description = frontmatter?.match(/^description: (.+)$/m)?.[1];
    if (!description || !content?.trim()) throw new Error(`Invalid NOVA skill: ${path}`);

    await ctx.skill.transform((editor) => {
      if (editor.get("nova")) return;
      editor.add({
        id: Skill.ID.make("nova"),
        name: Skill.Name.make("nova"),
        description,
        path: Skill.Info.fields.path.make(path),
        content: content.trim(),
      });
    });
  },
});
