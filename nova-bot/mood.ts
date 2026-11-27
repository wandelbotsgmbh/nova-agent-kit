export const FRAME_MS = 250
export const SLEEP_AFTER_MS = 90_000

const QUIPS = {
  idle: [
    'beep boop. awaiting orders.',
    'polishing my end effector...',
    'all joints within limits.',
    'did someone say pick and place?',
    'robots 💜 people',
  ],
  thinking: [
    'solving inverse kinematics...',
    'planning a collision-free path...',
    'consulting the motion group...',
  ],
  working: ['helping out with tools...', 'clank clank clank', 'busy busy busy'],
  nova: ['talking to NOVA!', 'moving joints (hopefully virtual ones)', 'wandelbots, assemble!'],
  happy: ['robots 💜 people', 'task complete! *happy whirr*', 'nailed the trajectory!', 'zero collisions today!'],
  oops: ['collision detected! ...in a tool', 'E-STOP! no wait, just an error', 'my servos feel funny'],
  sleeping: ['zzz... dreaming of trajectories', 'zzz... counting robot sheep', 'low power mode zzz'],
}

export type Mood = keyof typeof QUIPS
export type BotStyle = 'auto' | 'hd' | 'blocks'

export function quip(mood: Mood, tick: number): string {
  const list = QUIPS[mood]
  return list[Math.floor(tick / 32) % list.length] ?? ''
}

export function idleMood(elapsed: number): 'idle' | 'sleeping' {
  return elapsed >= SLEEP_AFTER_MS ? 'sleeping' : 'idle'
}
