export type CircleMark = { x: number; y: number; r: number }

export type LineMark = { x1: number; y1: number; x2: number; y2: number }

export type FrameMarks = {
  white?: CircleMark
  black?: CircleMark
  line?: LineMark
}

export type FrameMarkSet = { index: number; marks: FrameMarks }

const MIN_LINE = 0.08
const MAX_DESKEW = 20

function unit(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null
  if (value < 0 || value > 1) return null
  return value
}

function sanitizeCircle(value: unknown): CircleMark | null {
  if (!value || typeof value !== "object") return null
  const mark = value as Partial<CircleMark>
  const x = unit(mark.x)
  const y = unit(mark.y)
  const r = unit(mark.r)
  if (x === null || y === null || r === null || r < 0.005 || r > 0.15) {
    return null
  }
  return { x, y, r }
}

function sanitizeLine(value: unknown): LineMark | null {
  if (!value || typeof value !== "object") return null
  const mark = value as Partial<LineMark>
  const x1 = unit(mark.x1)
  const y1 = unit(mark.y1)
  const x2 = unit(mark.x2)
  const y2 = unit(mark.y2)
  if (x1 === null || y1 === null || x2 === null || y2 === null) return null
  return { x1, y1, x2, y2 }
}

export function sanitizeFrameMarks(value: unknown): FrameMarks | null {
  if (!value || typeof value !== "object") return null
  const raw = value as Partial<FrameMarks>
  const marks: FrameMarks = {}
  const white = sanitizeCircle(raw.white)
  const black = sanitizeCircle(raw.black)
  const line = sanitizeLine(raw.line)
  if (white) marks.white = white
  if (black) marks.black = black
  if (line) marks.line = line
  return white || black || line ? marks : null
}

export function sanitizeMarkList(value: unknown): FrameMarkSet[] {
  if (!Array.isArray(value)) return []
  const marks: FrameMarkSet[] = []
  for (const item of value) {
    if (!item || typeof item !== "object") continue
    const index = (item as { index?: unknown }).index
    if (
      !Number.isInteger(index) ||
      (index as number) < 0 ||
      (index as number) > 999
    ) {
      continue
    }
    const frame = sanitizeFrameMarks((item as { marks?: unknown }).marks)
    if (frame) marks.push({ index: index as number, marks: frame })
  }
  return marks
}

/** Sharp pozitív szöge óramutató járásával egyezik. Y lefelé nő. */
export function deskewDegrees(line: LineMark): number | null {
  const dx = line.x2 - line.x1
  const dy = line.y2 - line.y1
  if (dx * dx + dy * dy < MIN_LINE * MIN_LINE) return null

  let deviation = (Math.atan2(dy, dx) * 180) / Math.PI
  while (deviation > 90) deviation -= 180
  while (deviation <= -90) deviation += 180

  const correction =
    Math.abs(deviation) <= 45
      ? -deviation
      : -(deviation - Math.sign(deviation || 1) * 90)

  if (Math.abs(correction) > MAX_DESKEW) return null
  if (Math.abs(correction) < 0.15) return 0
  return correction
}
