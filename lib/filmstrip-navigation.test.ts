import assert from "node:assert/strict"
import test from "node:test"

import { navigateFilmstripGrid, navigateFilmstrips } from "./filmstrip-navigation"

function createLinks(count: number) {
  let active: object | null = null
  let clicked = -1
  const links = Array.from({ length: count }, (_, index) => ({
    focus() {
      active = links[index]
    },
    click() {
      clicked = index
    },
  }))
  return { links, getActive: () => active, getClicked: () => clicked }
}

test("rotation selects filmstrips in either direction and respects steps and bounds", () => {
  const { links, getActive } = createLinks(4)
  navigateFilmstrips({ event: "rotate", dir: "CW", steps: 1 }, links, null)
  assert.equal(getActive(), links[0])
  navigateFilmstrips({ event: "rotate", dir: "CW", steps: 2 }, links, getActive())
  assert.equal(getActive(), links[2])
  navigateFilmstrips({ event: "rotate", dir: "CW", steps: 5 }, links, getActive())
  assert.equal(getActive(), links[3])
  navigateFilmstrips({ event: "rotate", dir: "CCW", steps: 2 }, links, getActive())
  assert.equal(getActive(), links[1])
  navigateFilmstrips({ event: "rotate", dir: "CCW", steps: 5 }, links, getActive())
  assert.equal(getActive(), links[0])
  navigateFilmstrips({ event: "rotate", dir: "CCW", steps: 1 }, links, null)
  assert.equal(getActive(), links[3])
})

test("click opens the focused filmstrip or the first when none is focused", () => {
  const { links, getActive, getClicked } = createLinks(3)
  navigateFilmstrips({ event: "click" }, links, null)
  assert.equal(getActive(), links[0])
  assert.equal(getClicked(), 0)
  navigateFilmstrips({ event: "click" }, links, links[2])
  assert.equal(getActive(), links[2])
  assert.equal(getClicked(), 2)
})

test("empty lists and invalid steps do not change focus or open a filmstrip", () => {
  const { links, getActive, getClicked } = createLinks(1)
  navigateFilmstrips({ event: "click" }, [], null)
  navigateFilmstrips({ event: "rotate", dir: "CW", steps: 0 }, links, null)
  navigateFilmstrips({ event: "rotate", dir: "CW", steps: NaN }, links, null)
  assert.equal(getActive(), null)
  assert.equal(getClicked(), -1)
})

test("arrow navigation follows the visible grid and stops at horizontal edges", () => {
  let active: object | null = null
  const positions = [[1, 0], [2, 0], [3, 0], [0, 1], [1, 1], [2, 1], [3, 1], [0, 2], [1, 2]]
  const links = positions.map(([x, y], index) => ({
    focus() {
      active = links[index]
    },
    getBoundingClientRect() {
      return { left: x * 120, right: x * 120 + 100, top: y * 100, bottom: y * 100 + 80 }
    },
  }))

  assert.equal(navigateFilmstripGrid("right", links, null), true)
  assert.equal(active, links[0])
  navigateFilmstripGrid("right", links, active)
  assert.equal(active, links[1])
  navigateFilmstripGrid("down", links, active)
  assert.equal(active, links[5])
  navigateFilmstripGrid("down", links, active)
  assert.equal(active, links[8])
  navigateFilmstripGrid("up", links, active)
  assert.equal(active, links[4])
  navigateFilmstripGrid("left", links, active)
  assert.equal(active, links[3])
  navigateFilmstripGrid("left", links, active)
  assert.equal(active, links[3])
  navigateFilmstripGrid("up", links, active)
  assert.equal(active, links[0])
  navigateFilmstripGrid("right", links, links[2])
  assert.equal(active, links[0])
  assert.equal(navigateFilmstripGrid("down", [], null), false)
})
