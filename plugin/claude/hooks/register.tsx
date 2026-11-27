// Generated from adapters/claude/hooks/register.tsx by scripts/build.mjs. Edit the source, then run `pnpm build`.
import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { BotStyle, Mood } from '../nova-bot/mood'
import { FRAME_MS, idleMood, quip } from '../nova-bot/mood'
import { ROWS, WIDTH, cells, frame } from '../nova-bot/sprite'
import { hdImage } from '../nova-bot/sprite-hd'

const mood = atom({ plugin: 'nova', key: 'mood' } as const, 'idle' as Mood, {
  shape: 'mood-1',
})
const tick = atom({ plugin: 'nova', key: 'tick' } as const, 0)
const isHidden = atom({ plugin: 'nova', key: 'isHidden' } as const, false)
// Real pixels (an Image) where the terminal draws images; block characters elsewhere.
const canDrawImages = atom({ plugin: 'nova', key: 'canDrawImages' } as const, true)
// The person's /nova-bot hd|blocks|auto choice; `auto` asks the terminal.
const style = atom({ plugin: 'nova', key: 'style' } as const, 'auto' as BotStyle)
const STYLES: readonly BotStyle[] = ['auto', 'hd', 'blocks']

// The image's box: twice as many columns as rows makes it square on screen.
const IMAGE_COLUMNS = 8
const IMAGE_ROWS = 4
let hasProbed = false

// Once per load, while the style is `auto`: a blit the terminal refuses because it
// draws the alt text instead of the picture means no images here, and we fall back
// to block characters. The terminal may not have answered Claude Code's image
// query yet when the first try runs, so only three refusals in a row count.
const PROBE_DELAYS_MS = [500, 2000, 5000]

function probeImages($: EngineInterface, requestId: string, attempt = 0): void {
  $.clock.after(PROBE_DELAYS_MS[attempt] ?? 0, () => {
    void (async () => {
      if ((await read($, style)) !== 'auto') return
      const result = await $.ui.blit({
        requestId,
        key: 'bot-hd',
        source: hdImage('idle', 1),
        columns: IMAGE_COLUMNS,
        rows: IMAGE_ROWS,
      })
      if (!result.deny || !/alt/i.test(result.deny)) return
      if (attempt + 1 < PROBE_DELAYS_MS.length) probeImages($, requestId, attempt + 1)
      else await update($, canDrawImages, () => false)
    })()
  })
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
      description: 'Show or hide the NOVA robot above the prompt; hd, blocks or auto picks its drawing',
    })

    // The person's /nova-bot choices outlive the session.
    const stored = await $.store.get('nova-bot.isHidden')
    await update($, isHidden, () => stored === true)
    const storedStyle = await $.store.get('nova-bot.style')
    if (STYLES.includes(storedStyle as BotStyle)) await update($, style, () => storedStyle as BotStyle)

    lastActivity = await $.clock.now()
    $.clock.every(FRAME_MS, () => {
      void (async () => {
        await update($, tick, n => n + 1)
        const now = await $.clock.now()
        if ((await read($, mood)) === 'idle' && idleMood(now - lastActivity) === 'sleeping') {
          await update($, mood, () => 'sleeping' as Mood)
        }
      })()
    })

    return next(e)
  })

  on('command.run', { command: 'nova-bot' }, async ($, e) => {
    const arg = e.args.trim().toLowerCase()
    if (arg) {
      const next = (arg === 'pixels' ? 'hd' : arg) as BotStyle
      if (!STYLES.includes(next)) return { text: 'Usage: /nova-bot [hd | blocks | auto]. Without an argument it hides or shows the robot.' }
      await update($, style, () => next)
      await $.store.set('nova-bot.style', next)
      if (next === 'auto') {
        // Ask the terminal again on the next drawing.
        await update($, canDrawImages, () => true)
        hasProbed = false
      }
      await feel($, 'happy', 3000)
      const what = { hd: 'the detailed image', blocks: 'block characters', auto: 'the image where the terminal can draw it' }[next]
      return { text: `The NOVA bot now draws itself with ${what}, in this and later sessions.` }
    }
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
    const chosen = await read($, style)
    const isImage = chosen === 'hd' || (chosen === 'auto' && (await read($, canDrawImages)))
    if (chosen === 'auto' && isImage && !hasProbed) {
      hasProbed = true
      probeImages($, e.requestId)
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
