// The detailed NOVA robot as real pixels, for an Image element: terminals with
// kitty graphics draw it at any size; the others fall back to sprite.ts.
// Colours are NOVA design tokens (zero-gravity theme) unless noted.

import type { Mood } from './mood'

const SPRITE_W = 28
const SPRITE_H = 34
export const CANVAS = 34 // square, the sprite centred; matches a box twice as many columns as rows
const SCALE = 4 // integer upscale, so the terminal's own scaling keeps pixels sharp

const PALETTE: Record<string, number> = {
  K: 0x2b2622, // outline (own)
  W: 0xece4cf, // body, warm cream (own: the hedgehog look)
  S: 0xb5aa8f, // body shade (own)
  M: 0x8d8a86, // metal (own)
  V: 0x141623, // visor: background-paper-elevation-1
  P: 0xf2a7a0, // cheeks (own)
  D: 0x202233, // chest window: background-paper-elevation-5
  H: 0xffab40, // hard hat: warning-main
  h: 0xd9862a, // hard hat shade
  Z: 0x8c9eff, // sleepy Zs: info-light
  T: 0xd0d0d0, // thought dots
  R: 0x8e56fc, // heart: primary-main (nova-violet5)
  r: 0xc2b7f8, // heart highlight: nova-violet7
}

const ANTENNA = ['LL', 'LL', 'MM', 'MM']

const HEAD = [
  '..KKKKKKKKKKKK..',
  '.KWWWWWWWWWWWWK.',
  'KWWWWWWWWWWWWWSK',
  'KWKKKKKKKKKKKKSK',
  'KWKVVVVVVVVVVKSK',
  'KWKVVVVVVVVVVKSK',
  'KWKVVVVVVVVVVKSK',
  'KWKVVVVVVVVVVKSK',
  'KWKKKKKKKKKKKKSK',
  'KWWPWWWWWWWPWSSK',
  '.KSSSSSSSSSSSSK.',
  '..KKKKKKKKKKKK..',
]

const FACES: Record<string, string[]> = {
  open: ['VVVVVVVVVV', 'VEEVVVVEEV', 'VEEVVVVEEV', 'VVVVVVVVVV'],
  blink: ['VVVVVVVVVV', 'VVVVVVVVVV', 'VEEVVVVEEV', 'VVVVVVVVVV'],
  happy: ['VVVVVVVVVV', 'VVEVVVVEVV', 'VEVEVVEVEV', 'VVVVEEVVVV'],
  look: ['VVEEVVVEEV', 'VVEEVVVEEV', 'VVVVVVVVVV', 'VVVVVVVVVV'],
  focus: ['VEVVVVVVEV', 'VVEVVVVEVV', 'VEVVVVVVEV', 'VVVVVVVVVV'],
  oops: ['VEVEVVEVEV', 'VVEVVVVEVV', 'VEVEVVEVEV', 'VVVVEEVVVV'],
  asleep: ['VVVVVVVVVV', 'VVVVVVVVVV', 'VEEVVVVEEV', 'VVVVVVVVVV'],
}

const NECK = ['MMMM', 'MMMM']

const BODY = [
  '.KKKKKKKKKKKK.',
  'KWWWWWWWWWWWSK',
  'KWKKKKKKKKKWSK',
  'KWKDDDDDDDKWSK',
  'KWKDDDDDDDKWSK',
  'KWKDDDDDDDKWSK',
  'KWKDDDDDDDKWSK',
  'KWKKKKKKKKKWSK',
  'KSSSSSSSSSSSSK',
  '.KKKKKKKKKKKK.',
]

const LEGS = ['...KMK..KMK...', '...KMK..KMK...', '..KKKK..KKKK..']
const ARM_DOWN = ['.KK', 'KMK', 'KMK', 'KMK', 'K.K']
const ARM_UP = ['K.K', 'KMK', 'KMK', 'KMK', 'KMK', '.KK']
const HARD_HAT = [
  '....KKKKKKKKKK....',
  '...KHHHHHHHHHHK...',
  '..KHHHHHHHHHHHhK..',
  'KHHHHHHHHHHHHHHHhK',
  'KKKKKKKKKKKKKKKKKK',
]
const HEART = ['RR.RR', 'rRRRR', '.RRR.', '..R..']
const ZED = ['ZZZZ', '..Z.', '.Z..', 'ZZZZ']

const mirror = (part: string[]) => part.map(row => [...row].reverse().join(''))
const pick = <T>(list: T[], t: number): T => list[t % list.length] as T

type Canvas = (number | null)[][]

function stamp(c: Canvas, part: string[], x: number, y: number, colors: Record<string, number>) {
  part.forEach((row, dy) => {
    ;[...row].forEach((ch, dx) => {
      if (ch === '.') return
      const color = colors[ch] ?? PALETTE[ch]
      const line = c[y + dy]
      if (color === undefined || !line || x + dx < 0 || x + dx >= SPRITE_W) return
      line[x + dx] = color
    })
  })
}

export function pixels(m: Mood, t: number): Canvas {
  const c: Canvas = Array.from({ length: SPRITE_H }, () => Array<number | null>(SPRITE_W).fill(null))

  const hop = m === 'happy' && t % 4 < 2
  const base = hop ? 0 : 2
  const breathe = (m === 'idle' || m === 'sleeping') && t % 8 >= 4 ? 1 : 0
  const headY = base + 4 + breathe
  const bodyY = base + 18

  const eye =
    m === 'oops' ? 0xef5350 : m === 'sleeping' ? 0x26a69a : m === 'nova' ? 0xa7ffeb : 0x64ffda
  const light =
    m === 'thinking' ? pick([0x8e56fc, 0x64ffda, 0x8c9eff, 0xffab40], t) :
    m === 'oops' ? pick([0xef5350, 0x5a1a1a], t) :
    m === 'sleeping' ? 0x5a4a4a :
    m === 'nova' ? pick([0x64ffda, 0x26a69a], t) :
    t % 6 < 3 ? 0x8e56fc : 0xc2b7f8
  const colors: Record<string, number> = { E: eye, L: light }
  if (m === 'sleeping') Object.assign(colors, { R: 0x5e13b9, r: 0x7427de })
  if (m === 'oops') Object.assign(colors, { R: t % 2 ? 0x8e56fc : 0x5e13b9, r: 0x7427de })

  stamp(c, LEGS, 4, base + 28, colors)
  stamp(c, BODY, 4, bodyY, colors)

  const beat =
    m === 'sleeping' ? false :
    m === 'thinking' || m === 'nova' || m === 'working' || m === 'happy' ? t % 2 === 1 :
    t % 8 === 1 || t % 8 === 3
  const glow: Record<string, number> = beat && m !== 'oops' ? { R: 0x9d83f6, r: 0xeceafd } : {}
  stamp(c, HEART, 8, bodyY + 3, { ...colors, ...glow })
  stamp(c, NECK, 9, base + 16, colors)

  const up = m === 'happy' || m === 'oops' ? [true, true] :
    m === 'working' || m === 'nova' ? (t % 2 ? [true, false] : [false, true]) :
    [false, false]
  stamp(c, up[0] ? ARM_UP : ARM_DOWN, 1, up[0] ? bodyY - 4 : bodyY + 1, colors)
  stamp(c, mirror(up[1] ? ARM_UP : ARM_DOWN), 18, up[1] ? bodyY - 4 : bodyY + 1, colors)

  stamp(c, HEAD, 3, headY, colors)
  const face =
    m === 'happy' ? 'happy' :
    m === 'thinking' ? 'look' :
    m === 'nova' || m === 'working' ? 'focus' :
    m === 'oops' ? 'oops' :
    m === 'sleeping' ? 'asleep' :
    t % 20 === 0 ? 'blink' : 'open'
  stamp(c, FACES[face] ?? [], 6, headY + 4, colors)

  if (m === 'nova' || m === 'working') stamp(c, HARD_HAT, 2, headY - 3, colors)
  else stamp(c, ANTENNA, 10, headY - 4, colors)

  if (m === 'happy') {
    for (const [x, phase] of [[22, 0], [0, 5]] as const) {
      const rise = (t + phase) % 10
      if (rise < 8) stamp(c, HEART, x + (rise % 4 < 2 ? 0 : 1), 16 - rise * 2, colors)
    }
  }
  if (m === 'sleeping') {
    const rise = t % 12
    stamp(c, ZED, 23 + (rise > 6 ? 1 : 0), 12 - rise, colors)
  }
  if (m === 'thinking') {
    const dots = (t % 8) >> 1
    for (let i = 0; i < Math.min(dots, 3); i++) stamp(c, ['TT', 'TT'], 21 + i * 2, 6 - i * 2, colors)
  }
  return c
}

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

function base64(bytes: Uint8Array): string {
  const out: string[] = []
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i] ?? 0
    const b = bytes[i + 1] ?? 0
    const c = bytes[i + 2] ?? 0
    const n = (a << 16) | (b << 8) | c
    out.push(
      B64[(n >> 18) & 63]! + B64[(n >> 12) & 63]! +
      (i + 1 < bytes.length ? B64[(n >> 6) & 63]! : '=') +
      (i + 2 < bytes.length ? B64[n & 63]! : '='),
    )
  }
  return out.join('')
}

export type HdImage = { rgba: string; width: number; height: number }

// The frame as an Image source: RGBA, transparent where nothing is drawn.
export function hdImage(m: Mood, t: number): HdImage {
  const c = pixels(m, t)
  const side = CANVAS * SCALE
  const bytes = new Uint8Array(side * side * 4)
  const ox = Math.floor((CANVAS - SPRITE_W) / 2)
  const oy = CANVAS - SPRITE_H
  for (let y = 0; y < SPRITE_H; y++) {
    for (let x = 0; x < SPRITE_W; x++) {
      const color = c[y]?.[x]
      if (color === null || color === undefined) continue
      for (let dy = 0; dy < SCALE; dy++) {
        for (let dx = 0; dx < SCALE; dx++) {
          const i = (((oy + y) * SCALE + dy) * side + (ox + x) * SCALE + dx) * 4
          bytes[i] = (color >> 16) & 255
          bytes[i + 1] = (color >> 8) & 255
          bytes[i + 2] = color & 255
          bytes[i + 3] = 255
        }
      }
    }
  }
  return { rgba: base64(bytes), width: side, height: side }
}
