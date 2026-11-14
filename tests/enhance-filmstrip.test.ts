import assert from "node:assert/strict"
import { mkdtemp, rm } from "node:fs/promises"
import { createServer } from "node:http"
import { tmpdir } from "node:os"
import path from "node:path"
import { after, before, mock, test } from "node:test"

import sharp from "sharp"

const dataDir = await mkdtemp(path.join(tmpdir(), "asteria-enhance-test-"))
process.env.SLIDE_DATA_DIR = dataDir

let requests = 0
const image = await sharp({
  create: { width: 4, height: 4, channels: 3, background: "#c88050" },
})
  .jpeg()
  .toBuffer()
const server = createServer((req, res) => {
  requests++
  if (req.url === "/broken-02.jpg") {
    res.writeHead(500).end()
  } else if (req.url?.endsWith("-01.jpg") || req.url?.endsWith("-02.jpg")) {
    res.writeHead(200, { "Content-Type": "image/jpeg" }).end(image)
  } else {
    res.writeHead(404).end()
  }
})

let film = {
  id: 1,
  title: "Eredeti",
  firstImageUrl: "",
  enhanceQuality: false,
  enhancedFrameCount: null as number | null,
  enhancedSourceUrl: null as string | null,
  updatedAt: new Date(),
}

mock.module("@/lib/prisma", {
  defaultExport: {
    filmstrip: {
      findUnique: async () => ({ ...film }),
      update: async ({ data }: { data: Partial<typeof film> }) => {
        film = { ...film, ...data, updatedAt: new Date() }
        return film
      },
    },
  },
})
mock.module("next/cache", { namedExports: { revalidatePath: () => {} } })

const { updateFilmstrip } = await import("@/app/actions")
const { enhancedPlayback } = await import("@/lib/enhanced-playback")
const { GET } = await import("@/app/api/enhanced/[id]/[index]/route")

before(async () => {
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
  const address = server.address()
  assert(address && typeof address !== "string")
  film.firstImageUrl = `http://127.0.0.1:${address.port}/first-01.jpg`
})

after(async () => {
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve()))
  )
  await rm(dataDir, { recursive: true, force: true })
})

test("saving the checkbox generates, serves, disables and regenerates frames", async () => {
  const firstUrl = film.firstImageUrl
  assert.deepEqual(await updateFilmstrip(1, "Javított", firstUrl, true), {
    ok: true,
  })
  assert.equal(film.enhanceQuality, true)
  assert.equal(film.enhancedSourceUrl, firstUrl)
  assert.equal(film.enhancedFrameCount, 2)
  assert.equal(enhancedPlayback(film)?.count, 2)

  const response = await GET(new Request("http://localhost"), {
    params: Promise.resolve({ id: "1", index: "1" }),
  })
  assert.equal(response.status, 200)
  assert.equal(response.headers.get("content-type"), "image/jpeg")
  const savedFrame = await GET(new Request("http://localhost"), {
    params: Promise.resolve({ id: "1", index: "0" }),
  })
  const savedFrameBytes = Buffer.from(await savedFrame.arrayBuffer())
  const metadata = await sharp(Buffer.from(await response.arrayBuffer())).metadata()
  assert.equal(metadata.width, 8)
  assert.equal(metadata.height, 8)

  const afterGeneration = requests
  assert.deepEqual(await updateFilmstrip(1, "Új cím", firstUrl, true), { ok: true })
  assert.equal(requests, afterGeneration)

  assert.deepEqual(await updateFilmstrip(1, film.title, firstUrl, false), { ok: true })
  assert.equal(enhancedPlayback(film), null)
  const disabledResponse = await GET(new Request("http://localhost"), {
    params: Promise.resolve({ id: "1", index: "0" }),
  })
  assert.equal(disabledResponse.status, 404)

  const secondUrl = firstUrl.replace("first-", "second-")
  assert.deepEqual(await updateFilmstrip(1, film.title, secondUrl, false), { ok: true })
  assert.equal(requests, afterGeneration)
  assert.equal(enhancedPlayback(film), null)

  assert.deepEqual(await updateFilmstrip(1, film.title, firstUrl, true), { ok: true })
  assert(requests > afterGeneration)
  const afterReenabling = requests
  assert.deepEqual(await updateFilmstrip(1, film.title, secondUrl, true), { ok: true })
  assert.equal(film.enhancedSourceUrl, secondUrl)
  assert.equal(enhancedPlayback(film)?.count, 2)
  assert(requests > afterReenabling)

  const beforeFailure = { ...film }
  const failed = await updateFilmstrip(
    1,
    "Nem menthető",
    firstUrl.replace("first-", "broken-"),
    true
  )
  assert.equal(failed.ok, false)
  assert.match(failed.error ?? "", /HTTP 500/)
  assert.deepEqual(film, beforeFailure)
  const oldFrame = await GET(new Request("http://localhost"), {
    params: Promise.resolve({ id: "1", index: "0" }),
  })
  assert.equal(oldFrame.status, 200)
  assert.deepEqual(Buffer.from(await oldFrame.arrayBuffer()), savedFrameBytes)
})
