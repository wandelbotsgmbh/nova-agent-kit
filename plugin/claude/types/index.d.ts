// Generated from nova-bot/types/index.d.ts by scripts/build.mjs. Edit the source, then run `pnpm build`.
export type Mood = 'idle' | 'thinking' | 'working' | 'nova' | 'happy' | 'oops' | 'sleeping'

// Which drawing: the detailed image, the block sprite, or the image where the terminal draws it.
export type BotStyle = 'auto' | 'hd' | 'blocks'

declare module 'claude-code' {
  interface PluginState {
    nova: { mood: Shaped<Mood>; tick: number; isHidden: boolean; canDrawImages: boolean; style: BotStyle }
  }
}
