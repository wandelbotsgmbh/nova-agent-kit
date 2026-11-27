/** @jsxImportSource @opentui/solid */
import { Plugin } from "@opencode/plugin/tui";
import { createMemo, createSignal, Index, onCleanup, Show } from "solid-js";
import { FRAME_MS, quip, type BotStyle, type Mood } from "../../nova-bot/mood.ts";
import { frame } from "../../nova-bot/sprite.ts";
import { pixels } from "../../nova-bot/sprite-hd.ts";
import { moodAt, toolMood } from "./mood.ts";

type Glyph = { ch: string; fg: number } | null;

const colors: Record<Mood, string> = {
  idle: "#c2b7f8", thinking: "#8c9eff", working: "#ffab40", nova: "#64ffda",
  happy: "#81c784", oops: "#ef5350", sleeping: "#a6a6b4",
};

const hex = (color: number | null | undefined) =>
  color == null ? undefined : `#${color.toString(16).padStart(6, "0")}`;

function halfBlocks(rows: (number | null)[][], glyphs?: Glyph[][]) {
  return rows.flatMap((top, y) => y % 2 ? [] : [top.map((upper, x) => {
    const lower = rows[y + 1]?.[x];
    const glyph = glyphs?.[y / 2]?.[x];
    if (glyph) return { ch: glyph.ch, fg: hex(glyph.fg), bg: hex(lower ?? upper) };
    return {
      ch: upper != null ? "▀" : lower != null ? "▄" : " ",
      fg: hex(upper ?? lower),
      bg: upper != null ? hex(lower) : undefined,
    };
  })]);
}

function artwork(mood: Mood, tick: number, detailed: boolean) {
  if (!detailed) {
    const compact = frame(mood, tick);
    return halfBlocks(compact.pixels, compact.glyphs);
  }
  // shortcut: Downsample the shared artwork until the TUI slot supports native images.
  const image = pixels(mood, tick);
  const rows = Array.from({ length: 18 }, (_, y) =>
    Array.from({ length: 15 }, (_, x) =>
      image[Math.round(y * 33 / 17)]?.[Math.round(x * 27 / 14)] ?? null,
    ),
  );
  return halfBlocks(rows);
}

export default Plugin.define({
  id: "nova-agent-kit.tui",
  setup(ctx) {
    if (ctx.options.mascot === false) return;
    const [settings, update] = ctx.storage.store("mascot", {
      initial: { hidden: false, style: "auto" as BotStyle },
    });

    ctx.keymap.layer(() => ({
      mode: "global",
      commands: [{
        id: "nova-agent-kit.mascot",
        title: "Toggle or style the NOVA bot",
        slash: { name: "nova-bot", arguments: true },
        palette: true,
        run: async (input) => {
          const arg = input?.trim().toLowerCase();
          const style = arg === "pixels" ? "hd" : arg;
          if (style === "hd" || style === "blocks" || style === "auto") {
            await update((draft) => { draft.style = style; });
            ctx.ui.toast.show({ message: `NOVA bot: ${style}` });
          } else if (!arg) {
            await update((draft) => { draft.hidden = !draft.hidden; });
          } else {
            ctx.ui.toast.show({ message: "Usage: /nova-bot [hd | blocks | auto]" });
          }
        },
      }],
    }));

    function Mascot(props: { sessionID: string }) {
      const [now, setNow] = createSignal(Date.now());
      const [tick, setTick] = createSignal(0);
      const [width, setWidth] = createSignal(ctx.renderer.width);
      const resize = (columns: number) => setWidth(columns);
      ctx.renderer.on("resize", resize);
      const [lastActivity, setLastActivity] = createSignal(Date.now());
      const [reaction, react] = createSignal<{ mood: "happy" | "oops"; until: number }>();
      const [tools, setTools] = createSignal(new Map<string, { name: string; mood: "working" | "nova" }>());
      const [running, setRunning] = createSignal((ctx.data.session.status(props.sessionID)?.type ?? "idle") !== "idle");

      function state(active: boolean) {
        setLastActivity(Date.now());
        setRunning(active);
        if (!active) setTools(new Map());
      }

      function tool(id: string, name?: string, command?: unknown) {
        setLastActivity(Date.now());
        setTools((previous) => {
          const next = new Map(previous);
          if (name) next.set(id, { name, mood: toolMood(name, command) });
          else next.delete(id);
          return next;
        });
      }

      const handle = <T extends { data: { sessionID: string } }>(fn: (data: T["data"]) => void) =>
        (event: T) => {
          if (event.data.sessionID === props.sessionID) fn(event.data);
        };

      const stop = [
        ctx.data.on("session.execution.started", handle(() => { state(true); react(undefined); })),
        ctx.data.on("session.execution.succeeded", handle(() => {
          state(false);
          react({ mood: "happy", until: Date.now() + 4000 });
        })),
        ctx.data.on("session.execution.failed", handle(() => {
          state(false);
          react({ mood: "oops", until: Date.now() + 4000 });
        })),
        ctx.data.on("session.execution.interrupted", handle(() => { state(false); react(undefined); })),
        ctx.data.on("session.status", handle(({ status }) => state(status.type !== "idle"))),
        ctx.data.on("session.tool.input.started", handle(({ id, name }) => tool(id, name))),
        ctx.data.on("session.tool.called", handle(({ id, input }) => tool(id, tools().get(id)?.name ?? "tool", input.command))),
        ctx.data.on("session.tool.success", handle(({ id }) => tool(id))),
        ctx.data.on("session.tool.failed", handle(({ id }) => {
          tool(id);
          react({ mood: "oops", until: Date.now() + 3000 });
        })),
      ];
      const timer = setInterval(() => {
        setNow(Date.now());
        setTick((n) => n + 1);
      }, FRAME_MS);
      onCleanup(() => {
        clearInterval(timer);
        ctx.renderer.off("resize", resize);
        stop.forEach((unsubscribe) => unsubscribe());
      });

      const mood = createMemo(() => {
        const active = tools();
        const activity = [...active.values()].some((tool) => tool.mood === "nova") ? "nova" :
          active.size ? "working" : running() ? "thinking" : "idle";
        return moodAt(activity, reaction(), lastActivity(), now());
      });
      const rows = createMemo(() => artwork(mood(), tick(),
        settings.style === "hd" || (settings.style === "auto" && width() >= 80),
      ));

      return (
        <box flexDirection="row" justifyContent="flex-end" alignItems="flex-end" flexShrink={0}>
          <text fg={colors[mood()]} wrapMode="none">{quip(mood(), tick())} </text>
          <box flexDirection="column" flexShrink={0}>
            <Index each={rows()}>{(row) => (
              <box flexDirection="row" height={1}>
                <Index each={row()}>{(cell) => (
                  <text width={1} fg={cell().fg} bg={cell().bg}>{cell().ch}</text>
                )}</Index>
              </box>
            )}</Index>
          </box>
        </box>
      );
    }

    return ctx.ui.slot({
      append: "session.composer.top",
      render: ({ sessionID }) => (
        <Show when={!settings.hidden && sessionID} keyed>
          {(id) => <Mascot sessionID={id} />}
        </Show>
      ),
    });
  },
});
