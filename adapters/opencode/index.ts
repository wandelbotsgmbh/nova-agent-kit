import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Plugin, Skill } from "@opencode/plugin";
import { novaMcpCommand } from "./mcp-command.ts";

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

    if (Bun.which(novaMcpCommand[0])) {
      await ctx.mcp.transform((editor) => {
        if (editor.get("nova")) return;
        editor.set("nova", {
          type: "local",
          command: novaMcpCommand,
        });
      });
    }

    const hasNova = new Map<string, boolean>();
    const events = new AbortController();
    await ctx.session.hook("context", (event) => {
      // Existing sessions and prompts that beat session.created still get a check.
      if (!hasNova.has(event.sessionID)) hasNova.set(event.sessionID, !!Bun.which("nova"));
      if (hasNova.get(event.sessionID)) return;
      event.system.push({
        type: "text",
        text: "The nova CLI is not installed or not on PATH. For NOVA tasks, tell the user to install it from https://github.com/wandelbotsgmbh/nova-cli/releases before running nova commands.",
      });
    });
    void (async () => {
      for await (const event of ctx.event.subscribe({
        types: ["session.created", "session.deleted"],
        signal: events.signal,
      })) {
        const { sessionID } = event.data;
        if (event.type === "session.deleted") hasNova.delete(sessionID);
        else if (
          event.data.location.directory === ctx.location.directory &&
          event.data.location.workspaceID === ctx.location.workspaceID &&
          !hasNova.has(sessionID)
        ) {
          hasNova.set(sessionID, !!Bun.which("nova"));
        }
      }
    })().catch((error) => {
      if (!events.signal.aborted) console.warn("NOVA session event listener failed:", error);
    });
    return () => events.abort();
  },
});
