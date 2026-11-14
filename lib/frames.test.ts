import assert from "node:assert/strict"
import test from "node:test"

import { buildFrameUrl, getDisplayImageUrl } from "./frames"

test("HTTP frames are served by the image optimizer with their full source URL", () => {
  const first = "http://example.com/slides/frame009.jpg?token=a%2Bb&size=1"
  const frame = buildFrameUrl(first, 1)
  assert.equal(frame, "http://example.com/slides/frame010.jpg?token=a%2Bb&size=1")

  const result = new URL(getDisplayImageUrl(frame), "https://asteria.example")
  assert.equal(result.pathname, "/_next/image")
  assert.equal(result.searchParams.get("url"), frame)
  assert.equal(result.searchParams.get("w"), "3840")
  assert.equal(result.searchParams.get("q"), "75")
})

test("the first HTTP image is proxied even without a numbered filename", () => {
  const first = "http://example.com/cover.jpg"
  assert.equal(buildFrameUrl(first, 0), null)
  assert.equal(
    new URL(getDisplayImageUrl(first), "https://asteria.example").searchParams.get("url"),
    first
  )
})

test("HTTPS images retain their original URLs", () => {
  const first = "https://example.com/slides/01.jpg?token=abc"
  assert.equal(getDisplayImageUrl(first), first)
  assert.equal(
    getDisplayImageUrl(buildFrameUrl(first, 1)!),
    "https://example.com/slides/02.jpg?token=abc"
  )
})
