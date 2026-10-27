import {
  access,
  mkdir,
  readFile,
  rename,
  rm,
  writeFile,
} from "node:fs/promises"
import path from "node:path"

import sharp from "sharp"

import {
  deskewDegrees,
  type CircleMark,
  type FrameMarks,
  type FrameMarkSet,
} from "@/lib/enhance-marks"
import { buildFrameUrl } from "@/lib/frames"

export {
  enhancedFrameUrl,
  enhancedPlayback,
  type EnhancedFilm,
} from "@/lib/enhanced-playback"

const MAX_FRAMES = 1000
/** Régi készlet (hibás joinChannel) ne legyen újrafelhasználva. */
const PIPELINE_VERSION = "3"
const MAX_BYTES = 30 * 1024 * 1024
const FETCH_TIMEOUT_MS = 30_000

export function slideDataDir(): string {
  return process.env.SLIDE_DATA_DIR ?? path.join(process.cwd(), "data")
}

export function enhancedDir(filmId: number): string {
  return path.join(slideDataDir(), "enhanced", String(filmId))
}

export function enhancedFramePath(filmId: number, index: number): string {
  return path.join(enhancedDir(filmId), `${index}.jpg`)
}

export async function readEnhancedFrame(
  filmId: number,
  index: number
): Promise<Buffer | null> {
  if (!Number.isInteger(filmId) || filmId < 1) return null
  if (!Number.isInteger(index) || index < 0) return null
  try {
    return await readFile(enhancedFramePath(filmId, index))
  } catch {
    return null
  }
}

export async function deleteEnhancedFrames(filmId: number): Promise<void> {
  await rm(enhancedDir(filmId), { recursive: true, force: true })
}

/**
 * Jelölés nélkül: csatornánkénti normalize.
 * Fehér/fekete kör: a minta lesz a fehér- és feketepont.
 * Vonal: a közeli vízszintes vagy függőleges élhez igazítja a dőlést.
 * Utána 2× lanczos3 és diafilmes élesítés. Csak a JPEG marad meg.
 */
export async function enhanceBuffer(
  input: Buffer,
  marks?: FrameMarks | null
): Promise<Buffer> {
  const prepared = sharp(input, { failOn: "none" }).rotate().removeAlpha()
  const meta = await prepared.metadata()
  const width = meta.width
  const height = meta.height
  if (!width || !height) throw new Error("A kép mérete nem olvasható.")

  const rgb = await prepared.toColorspace("srgb").raw().toBuffer()
  const corrected = await correctColors(Buffer.from(rgb), width, height, marks)
  const deskewed = await deskew(corrected, width, height, marks?.line)

  return sharp(deskewed.data, {
    raw: { width: deskewed.width, height: deskewed.height, channels: 3 },
  })
    .toColorspace("srgb")
    .resize(deskewed.width * 2, deskewed.height * 2, { kernel: "lanczos3" })
    .sharpen({
      sigma: 1.2,
      m1: 0.4,
      m2: 2.5,
      x1: 2,
      y2: 10,
      y3: 20,
    })
    .jpeg({ quality: 90, chromaSubsampling: "4:4:4", mozjpeg: true })
    .toBuffer()
}

async function correctColors(
  rgb: Buffer,
  width: number,
  height: number,
  marks?: FrameMarks | null
): Promise<Buffer> {
  const white = marks?.white
    ? sampleCircle(rgb, width, height, marks.white, 90)
    : null
  const black = marks?.black
    ? sampleCircle(rgb, width, height, marks.black, 10)
    : null
  if (white || black) {
    applyLevels(rgb, black, white)
    return rgb
  }

  const raw = { width, height, channels: 3 as const }
  const [r, g, b] = await Promise.all([
    sharp(rgb, { raw }).extractChannel(0).normalize().raw().toBuffer(),
    sharp(rgb, { raw }).extractChannel(1).normalize().raw().toBuffer(),
    sharp(rgb, { raw }).extractChannel(2).normalize().raw().toBuffer(),
  ])
  return mergeRgbPlanes(r, g, b, width, height)
}

function sampleCircle(
  rgb: Buffer,
  width: number,
  height: number,
  mark: CircleMark,
  percentileRank: number
): [number, number, number] | null {
  const cx = mark.x * width
  const cy = mark.y * height
  const radius = mark.r * Math.min(width, height)
  if (radius < 1) return null

  const samples: [number[], number[], number[]] = [[], [], []]
  const x0 = Math.max(0, Math.floor(cx - radius))
  const x1 = Math.min(width - 1, Math.ceil(cx + radius))
  const y0 = Math.max(0, Math.floor(cy - radius))
  const y1 = Math.min(height - 1, Math.ceil(cy + radius))
  const radiusSq = radius * radius

  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const dx = x + 0.5 - cx
      const dy = y + 0.5 - cy
      if (dx * dx + dy * dy > radiusSq) continue
      const offset = (y * width + x) * 3
      samples[0].push(rgb[offset]!)
      samples[1].push(rgb[offset + 1]!)
      samples[2].push(rgb[offset + 2]!)
    }
  }
  if (samples[0].length < 8) return null
  return [
    percentile(samples[0], percentileRank),
    percentile(samples[1], percentileRank),
    percentile(samples[2], percentileRank),
  ]
}

function percentile(values: number[], rank: number): number {
  const sorted = values.slice().sort((a, b) => a - b)
  const index = Math.round((rank / 100) * (sorted.length - 1))
  return sorted[Math.min(sorted.length - 1, Math.max(0, index))]!
}

function applyLevels(
  rgb: Buffer,
  black: [number, number, number] | null,
  white: [number, number, number] | null
) {
  for (let channel = 0; channel < 3; channel++) {
    const low = black ? black[channel] : 0
    const high = white ? white[channel] : 255
    if (high - low < 8) continue
    const scale = 255 / (high - low)
    for (let i = channel; i < rgb.length; i += 3) {
      const value = ((rgb[i] ?? 0) - low) * scale
      rgb[i] = value < 0 ? 0 : value > 255 ? 255 : Math.round(value)
    }
  }
}

async function deskew(
  rgb: Buffer,
  width: number,
  height: number,
  line: FrameMarks["line"]
): Promise<{ data: Buffer; width: number; height: number }> {
  const angle = line ? deskewDegrees(line) : null
  if (!angle) return { data: rgb, width, height }
  const { data, info } = await sharp(rgb, {
    raw: { width, height, channels: 3 },
  })
    .rotate(angle, { background: { r: 0, g: 0, b: 0 } })
    .raw()
    .toBuffer({ resolveWithObject: true })
  return { data, width: info.width, height: info.height }
}

function mergeRgbPlanes(
  r: Buffer,
  g: Buffer,
  b: Buffer,
  width: number,
  height: number
): Buffer {
  const pixels = width * height
  if (r.length !== pixels || g.length !== pixels || b.length !== pixels) {
    throw new Error("A színcsatornák nem vonhatók össze.")
  }
  const merged = Buffer.allocUnsafe(pixels * 3)
  for (let i = 0; i < pixels; i++) {
    const offset = i * 3
    merged[offset] = r[i]!
    merged[offset + 1] = g[i]!
    merged[offset + 2] = b[i]!
  }
  return merged
}

async function downloadImage(url: string): Promise<Buffer | null> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: { Accept: "image/*" },
    })
    if (!res.ok) return null
    const type = (res.headers.get("content-type") ?? "").toLowerCase()
    if (type.startsWith("text/") || type.includes("html")) return null
    const declared = Number(res.headers.get("content-length") ?? "0")
    if (Number.isFinite(declared) && declared > MAX_BYTES) {
      throw new Error("A kép túl nagy a javításhoz.")
    }
    const buf = Buffer.from(await res.arrayBuffer())
    if (buf.byteLength === 0) return null
    if (buf.byteLength > MAX_BYTES) {
      throw new Error("A kép túl nagy a javításhoz.")
    }
    return buf
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("A kép túl nagy")) {
      throw error
    }
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("A kép letöltése időtúllépés miatt megszakadt.")
    }
    throw new Error("A kép letöltése nem sikerült.")
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Letölti a diafilm kockáit, feljavítja, és csak a JPEG-eket menti.
 * Sikertelen futás nem cseréli le a korábbi készletet.
 */
export async function enhanceFilmstrip(
  filmId: number,
  firstImageUrl: string,
  markSets: FrameMarkSet[] = []
): Promise<number> {
  const marksByIndex = new Map(markSets.map((set) => [set.index, set.marks]))
  const tmp = path.join(slideDataDir(), "enhanced", `${filmId}.tmp`)
  await rm(tmp, { recursive: true, force: true })
  await mkdir(tmp, { recursive: true })

  let count = 0
  try {
    for (let i = 0; i < MAX_FRAMES; i++) {
      const url =
        buildFrameUrl(firstImageUrl, i) ?? (i === 0 ? firstImageUrl : null)
      if (!url) break

      const buf = await downloadImage(url)
      if (!buf) {
        if (i === 0) throw new Error("A kezdő kép nem tölthető le.")
        break
      }

      let enhanced: Buffer
      try {
        enhanced = await enhanceBuffer(buf, marksByIndex.get(i))
      } catch (error) {
        if (i === 0) {
          console.error("Error enhancing first frame:", error)
          throw new Error("A kezdő kép nem dolgozható fel.")
        }
        break
      }

      await writeFile(path.join(tmp, `${i}.jpg`), enhanced)
      count++
    }

    await writeFile(path.join(tmp, "pipeline.txt"), PIPELINE_VERSION)

    if (count === 0) throw new Error("Nem található feljavítható kép.")

    const dest = enhancedDir(filmId)
    const backup = path.join(slideDataDir(), "enhanced", `${filmId}.bak`)
    await rm(backup, { recursive: true, force: true })
    await mkdir(path.dirname(dest), { recursive: true })
    let movedOld = false
    try {
      await access(dest)
      await rename(dest, backup)
      movedOld = true
    } catch {
      // nincs korábbi készlet
    }
    try {
      await rename(tmp, dest)
    } catch (error) {
      if (movedOld) {
        await rm(dest, { recursive: true, force: true })
        await rename(backup, dest).catch(() => {})
      }
      throw error
    }
    await rm(backup, { recursive: true, force: true })
    return count
  } catch (error) {
    await rm(tmp, { recursive: true, force: true })
    throw error
  }
}
