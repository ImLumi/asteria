import assert from "node:assert/strict"
import test from "node:test"

import { createControllerDoubleClickDetector } from "./controller-double-click"

test("two clicks within 400 ms form one double click", () => {
  const detector = createControllerDoubleClickDetector(400)
  assert.equal(detector.click(0), false)
  assert.equal(detector.click(400), true)
  assert.equal(detector.click(401), false)
  assert.equal(detector.click(500), true)
})

test("slow clicks start a new pair", () => {
  const detector = createControllerDoubleClickDetector(400)
  assert.equal(detector.click(100), false)
  assert.equal(detector.click(501), false)
  assert.equal(detector.click(700), true)
})

test("reset interrupts a click sequence", () => {
  const detector = createControllerDoubleClickDetector(400)
  assert.equal(detector.click(100), false)
  detector.reset()
  assert.equal(detector.click(200), false)
  assert.equal(detector.click(300), true)
})
