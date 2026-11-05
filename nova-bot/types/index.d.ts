export type Mood = 'idle' | 'thinking' | 'working' | 'nova' | 'happy' | 'oops' | 'sleeping'

declare module 'claude-code' {
  interface PluginState {
    'nova-bot': { mood: Shaped<Mood>; tick: number; isHidden: boolean; canDrawImages: boolean }
  }
}
