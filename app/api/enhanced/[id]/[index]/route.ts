import { readEnhancedFrame } from "@/lib/enhance"
import { enhancedPlayback } from "@/lib/enhanced-playback"
import prisma from "@/lib/prisma"

export const dynamic = "force-dynamic"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; index: string }> }
) {
  const { id, index } = await params
  const filmId = Number(id)
  const frame = Number(index)
  if (!Number.isInteger(filmId) || !Number.isInteger(frame) || frame < 0) {
    return new Response("Not found", { status: 404 })
  }

  const film = await prisma.filmstrip.findUnique({ where: { id: filmId } })
  const playback = film ? enhancedPlayback(film) : null
  if (!playback || frame >= playback.count) {
    return new Response("Not found", { status: 404 })
  }

  const data = await readEnhancedFrame(filmId, frame)
  if (!data) return new Response("Not found", { status: 404 })

  return new Response(new Uint8Array(data), {
    headers: {
      "Content-Type": "image/jpeg",
      "Cache-Control": "private, max-age=86400",
    },
  })
}
