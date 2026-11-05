// Generated from nova-bot/hooks/register.tsx by scripts/build.mjs. Edit the source, then run `pnpm build`.
import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Mood } from '../types'
import { ROWS, WIDTH, cells, frame } from './sprite'
import { hdImage } from './sprite-hd'

const FRAME_MS = 250
const SLEEP_AFTER_MS = 90_000

const mood = atom({ plugin: 'nova', key: 'mood' } as const, 'idle' as Mood, {
  shape: 'mood-1',
})
const tick = atom({ plugin: 'nova', key: 'tick' } as const, 0)
const isHidden = atom({ plugin: 'nova', key: 'isHidden' } as const, false)
// Real pixels (an Image) where the terminal draws images; block characters elsewhere.
const canDrawImages = atom({ plugin: 'nova', key: 'canDrawImages' } as const, true)

// The image's box: twice as many columns as rows makes it square on screen.
const IMAGE_COLUMNS = 8
const IMAGE_ROWS = 4
let hasProbed = false

// Once per load: a blit the terminal refuses because it draws the alt text
// instead of the picture means no images here; fall back to block characters.
async function probeImages($: EngineInterface, requestId: string): Promise<void> {
  const result = await $.ui.blit({
    requestId,
    key: 'bot-hd',
    source: hdImage('idle', 1),
    columns: IMAGE_COLUMNS,
    rows: IMAGE_ROWS,
  })
  if (result.deny && /alt/i.test(result.deny)) await update($, canDrawImages, () => false)
}

const QUIPS: Record<Mood, string[]> = {
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
  nova: [
    'talking to NOVA!',
    'moving joints (hopefully virtual ones)',
    'wandelbots, assemble!',
  ],
  happy: ['robots 💜 people', 'task complete! *happy whirr*', 'nailed the trajectory!', 'zero collisions today!'],
  oops: ['collision detected! ...in a tool', 'E-STOP! no wait, just an error', 'my servos feel funny'],
  sleeping: ['zzz... dreaming of trajectories', 'zzz... counting robot sheep', 'low power mode zzz'],
}

const COLOR: Record<Mood, string> = {
  idle: 'claude',
  thinking: 'suggestion',
  working: 'warning',
  nova: 'permission',
  happy: 'success',
  oops: 'error',
  sleeping: 'inactive',
}

function quip(m: Mood, t: number): string {
  const list = QUIPS[m]
  return list[Math.floor(t / 32) % list.length] ?? ''
}

let lastActivity = 0
let calm: { cancel: () => void } | undefined

// Set a mood; `holdMs` makes it fall back to idle after a while.
async function feel($: EngineInterface, m: Mood, holdMs?: number): Promise<void> {
  lastActivity = await $.clock.now()
  calm?.cancel()
  calm = undefined
  await update($, mood, () => m)
  if (holdMs) {
    calm = $.clock.after(holdMs, () => {
      void update($, mood, () => 'idle' as Mood)
    })
  }
}

export const register: Register = on => {

  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'nova-bot',
      description: 'Show or hide the NOVA robot above the prompt',
    })

    // The person's /nova-bot choice outlives the session.
    const stored = await $.store.get('nova-bot.isHidden')
    await update($, isHidden, () => stored === true)

    lastActivity = await $.clock.now()
    $.clock.every(FRAME_MS, () => {
      void (async () => {
        await update($, tick, n => n + 1)
        const now = await $.clock.now()
        if ((await read($, mood)) === 'idle' && now - lastActivity > SLEEP_AFTER_MS) {
          await update($, mood, () => 'sleeping' as Mood)
        }
      })()
    })

    return next(e)
  })

  on('command.run', { command: 'nova-bot' }, async $ => {
    const hidden = !(await read($, isHidden))
    await update($, isHidden, () => hidden)
    await $.store.set('nova-bot.isHidden', hidden)
    if (hidden) return { text: 'The NOVA bot powers down, in this and later sessions. /nova-bot brings it back.' }
    await feel($, 'happy', 3000)
    return { text: 'beep boop, the NOVA bot says hi.' }
  })

  on('turn.start', async ($, e, next) => {
    await feel($, 'thinking')
    return next(e)
  })

  on('tool.call', async ($, e, next) => {
    const isNova = e.tool === 'Bash' && /\bnova\b/.test(String((e as { command?: unknown }).command ?? ''))
    const isNovaMcp = e.tool.startsWith('mcp__') && e.tool.includes('nova')
    await feel($, isNova || isNovaMcp ? 'nova' : 'working')
    const result = await next(e)
    if (result.isError) await feel($, 'oops', 3000)
    else await feel($, 'thinking')
    return result
  })

  on('turn.complete', async ($, e, next) => {
    const result = await next(e)
    await feel($, e.reason === 'answer' ? 'happy' : 'oops', 4000)
    return result
  })

  // Bottom right: the band right above the prompt, the robot at its right end.
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.surface !== 'terminal' || e.props.hasSurvey || (await read($, isHidden))) return next(e)
    if (e.props.maxRows < Math.max(ROWS, IMAGE_ROWS)) return next(e)

    const m = await read($, mood)
    const t = await read($, tick)
    const { Box, Text, Raster, Image } = $.ui.resolve({ ...e, surface: 'terminal' as const })
    const isImage = await read($, canDrawImages)
    if (isImage && !hasProbed) {
      hasProbed = true
      const requestId = e.requestId
      $.clock.after(500, () => void probeImages($, requestId))
    }

    return (
      <Box width={e.props.bodyColumns} justifyContent="flex-end" alignItems="flex-end">
        <Text color={COLOR[m]} dimColor>
          {quip(m, t)}{' '}
        </Text>
        {isImage ? (
          <Image key="bot-hd" source={hdImage(m, t)} columns={IMAGE_COLUMNS} rows={IMAGE_ROWS} alt=" " />
        ) : (
          <Raster key="bot" columns={WIDTH} rows={ROWS} cells={cells(frame(m, t))} />
        )}
      </Box>
    )
  })
}
