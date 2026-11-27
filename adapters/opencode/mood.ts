import { idleMood, type Mood } from "../../nova-bot/mood.ts";

export function toolMood(name: string, command: unknown) {
  const novaTool = /^(?:mcp__)?nova(?:[-_]mcp)?(?:__|_)/i.test(name);
  const novaCommand = name.toLowerCase() === "bash" && typeof command === "string" && /\bnova\b/.test(command);
  return novaTool || novaCommand ? "nova" : "working";
}

export function moodAt(
  activity: "idle" | "thinking" | "working" | "nova",
  reaction: { mood: "happy" | "oops"; until: number } | undefined,
  lastActivity: number,
  now: number,
): Mood {
  if (reaction && now < reaction.until) return reaction.mood;
  return activity === "idle" ? idleMood(now - lastActivity) : activity;
}
