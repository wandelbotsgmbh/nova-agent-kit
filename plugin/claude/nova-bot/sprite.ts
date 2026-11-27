// Generated from nova-bot/sprite.ts by scripts/build.mjs. Edit the source, then run `pnpm build`.
// Tiny pixel-art NOVA robot for a Raster. Two layers:
// - pixels: half blocks, one terminal cell = two square pixels (top as the
//   foreground of '▀', bottom as its background);
// - glyphs: a character in a cell (eyes, the heart, Zs), which stays crisp where
//   a few pixels would not read. A glyph cell takes its background from the pixels.
// Colours are NOVA design tokens (zero-gravity theme) unless noted.

import type { Mood } from './mood'

export const WIDTH = 9 // terminal columns: 7 robot + 2 for effects
export const ROWS = 4 // terminal rows
const HEIGHT = ROWS * 2 // pixels

const DEFAULT = 0x01000000

const PALETTE: Record<string, number> = {
  W: 0xece4cf, // body, warm cream (own: the hedgehog look)
  S: 0xb5aa8f, // body shade (own)
  M: 0x8d8a86, // metal: arms, legs (own)
  V: 0x141623, // visor: background-paper-elevation-1
  H: 0xffab40, // hard hat: warning-main
}

const HEART = 0x8e56fc // primary-main (nova-violet5)
const HEART_GLOW = 0xc2b7f8 // nova-violet7
const HEART_ASLEEP = 0x5e13b9 // nova-violet2

// No outline: at one character per two pixels an outline only eats room.
// Pixel rows come in pairs; each pair is one terminal row.
const ROBOT = [
  '.......', // row 0: antenna or hard hat on top
  '.WWWWW.',
  'WVVVVVS', // row 1: the visor; eyes are characters at columns 2 and 4
  'WVVVVVS',
  '.WWWWS.', // row 2: the chest; the heart is a character at column 3
  '.WWWWS.',
  '.SSSSS.', // row 3: hips and legs
  '.MM.MM.',
]

// Eyes per mood: [left, right] characters on the visor row.
const EYES: Record<string, [string, string]> = {
  open: ['o', 'o'],
  blink: ['-', '-'],
  happy: ['^', '^'],
  focus: ['>', '<'],
  oops: ['x', 'x'],
  asleep: ['-', '-'],
}

type Glyph = { ch: string; fg: number }

function stamp(c: (number | null)[][], part: string[], x: number, y: number, colors: Record<string, number>) {
  part.forEach((row, dy) => {
    ;[...row].forEach((ch, dx) => {
      if (ch === '.') return
      const color = colors[ch] ?? PALETTE[ch]
      const line = c[y + dy]
      if (color === undefined || !line || x + dx < 0 || x + dx >= WIDTH) return
      line[x + dx] = color
    })
  })
}

const pick = <T>(list: T[], t: number): T => list[t % list.length] as T

export type Frame = { pixels: (number | null)[][]; glyphs: (Glyph | null)[][] }

export function frame(m: Mood, t: number): Frame {
  const pixels = Array.from({ length: HEIGHT }, () => Array<number | null>(WIDTH).fill(null))
  const glyphs = Array.from({ length: ROWS }, () => Array<Glyph | null>(WIDTH).fill(null))
  const put = (row: number, x: number, ch: string, fg: number) => {
    const line = glyphs[row]
    if (line && x >= 0 && x < WIDTH) line[x] = { ch, fg }
  }

  const light =
    m === 'thinking' ? pick([0x8e56fc, 0x64ffda, 0x8c9eff, 0xffab40], t) :
    m === 'oops' ? pick([0xef5350, 0x5a1a1a], t) :
    m === 'sleeping' ? 0x5a4a4a :
    m === 'nova' ? pick([0x64ffda, 0x26a69a], t) :
    t % 6 < 3 ? 0x8e56fc : 0xc2b7f8

  stamp(pixels, ROBOT, 0, 0, {})
  // Top: a blinking antenna light, or a hard hat while working.
  if (m === 'nova' || m === 'working') stamp(pixels, ['.HHHHH.', 'HHHHHHH'], 0, 0, {})
  else stamp(pixels, ['...L...'], 0, 0, { L: light })

  // Arms beside the chest; they pump while working and wave when happy.
  const lift = (side: number) =>
    m === 'happy' ? (t + side) % 2 :
    m === 'working' || m === 'nova' ? (t % 2 === side ? 1 : 0) :
    0
  stamp(pixels, ['M'], 0, 5 - lift(0), {})
  stamp(pixels, ['M'], 6, 5 - lift(1), {})

  // Eyes on the visor row; they glance aside while thinking.
  const eye =
    m === 'oops' ? 0xef5350 : m === 'sleeping' ? 0x26a69a : m === 'nova' ? 0xa7ffeb : 0x64ffda
  const face =
    m === 'happy' ? 'happy' :
    m === 'nova' || m === 'working' ? 'focus' :
    m === 'oops' ? 'oops' :
    m === 'sleeping' ? 'asleep' :
    t % 20 === 0 ? 'blink' : 'open'
  const [left, right] = EYES[face] ?? ['o', 'o']
  const glance = m === 'thinking' && t % 8 < 4 ? 1 : 0
  put(1, 2 + glance, left, eye)
  put(1, 4 + glance, right, eye)

  // The heart beats: brighter on the beat, faster while busy, dim while asleep.
  const beat =
    m === 'thinking' || m === 'nova' || m === 'working' || m === 'happy' ? t % 2 === 1 :
    t % 8 === 1 || t % 8 === 3
  const heart =
    m === 'sleeping' ? HEART_ASLEEP :
    m === 'oops' ? (t % 2 ? HEART : HEART_ASLEEP) :
    beat ? HEART_GLOW : HEART
  put(2, 3, '♥', heart)

  // Effects in the two columns to the right: a rising heart, Zs, thought dots.
  if (m === 'happy') {
    const rise = t % 4
    if (rise < 3) put(2 - rise, 7 + (rise % 2), '♥', HEART)
  }
  if (m === 'sleeping') {
    const rise = Math.floor(t / 3) % 3
    if (rise < 2) put(1 - rise, 7 + rise, rise ? 'Z' : 'z', 0x8c9eff)
  }
  if (m === 'thinking') {
    const dots = (t % 6) >> 1
    if (dots > 0) put(1, 7, '.', 0xd0d0d0)
    if (dots > 1) put(0, 8, 'o', 0xd0d0d0)
  }

  return { pixels, glyphs }
}

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

function base64(bytes: Uint8Array): string {
  let out = ''
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i] ?? 0
    const b = bytes[i + 1] ?? 0
    const c = bytes[i + 2] ?? 0
    const n = (a << 16) | (b << 8) | c
    out += B64[(n >> 18) & 63]! + B64[(n >> 12) & 63]!
    out += i + 1 < bytes.length ? B64[(n >> 6) & 63]! : '='
    out += i + 2 < bytes.length ? B64[n & 63]! : '='
  }
  return out
}

// The Raster's `cells`: [codePoint, fg, bg] per cell, little-endian u32s, base64.
export function cells({ pixels, glyphs }: Frame): string {
  const words = new Uint32Array(WIDTH * ROWS * 3)
  for (let r = 0; r < ROWS; r++) {
    for (let x = 0; x < WIDTH; x++) {
      const top = pixels[2 * r]?.[x] ?? null
      const bottom = pixels[2 * r + 1]?.[x] ?? null
      const glyph = glyphs[r]?.[x]
      const i = (r * WIDTH + x) * 3
      if (glyph) words.set([glyph.ch.codePointAt(0) ?? 0x20, glyph.fg, bottom ?? top ?? DEFAULT], i)
      else if (top === null && bottom === null) words.set([0x20, DEFAULT, DEFAULT], i)
      else if (top === null) words.set([0x2584, bottom ?? DEFAULT, DEFAULT], i) // ▄
      else words.set([0x2580, top, bottom ?? DEFAULT], i) // ▀
    }
  }
  // Uint32Array is little-endian on every host the engine runs on.
  return base64(new Uint8Array(words.buffer))
}
