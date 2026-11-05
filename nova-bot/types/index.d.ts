export type Mood = 'idle' | 'thinking' | 'working' | 'nova' | 'happy' | 'oops' | 'sleeping'

declare module 'claude-code' {
  interface PluginState {
    nova: { mood: Shaped<Mood>; tick: number; isHidden: boolean; canDrawImages: boolean }
  }
}
