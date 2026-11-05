// Generated from nova-bot/types/index.d.ts by scripts/build.mjs. Edit the source, then run `pnpm build`.
export type Mood = 'idle' | 'thinking' | 'working' | 'nova' | 'happy' | 'oops' | 'sleeping'

declare module 'claude-code' {
  interface PluginState {
    'nova-bot': { mood: Shaped<Mood>; tick: number; isHidden: boolean; canDrawImages: boolean }
  }
}
