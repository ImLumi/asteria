import type { ControllerEvent } from "@/components/controller-provider"

type FilmstripLink = Pick<HTMLAnchorElement, "focus" | "click">
type SpatialFilmstripLink = {
  focus: () => void
  getBoundingClientRect: () => Pick<DOMRect, "left" | "right" | "top" | "bottom">
}
export type ArrowDirection = "left" | "right" | "up" | "down"

export function navigateFilmstripGrid(
  direction: ArrowDirection,
  links: readonly SpatialFilmstripLink[],
  activeElement: object | null
): boolean {
  if (links.length === 0) return false

  const current = links.find((link) => link === activeElement)
  if (!current) {
    links[0].focus()
    return true
  }

  const rect = current.getBoundingClientRect()
  const x = (rect.left + rect.right) / 2
  const y = (rect.top + rect.bottom) / 2
  const horizontal = direction === "left" || direction === "right"
  const sign = direction === "left" || direction === "up" ? -1 : 1
  let best: SpatialFilmstripLink | null = null
  let bestPrimary = Infinity
  let bestSecondary = Infinity

  for (const link of links) {
    if (link === current) continue
    const candidate = link.getBoundingClientRect()
    const dx = (candidate.left + candidate.right) / 2 - x
    const dy = (candidate.top + candidate.bottom) / 2 - y
    const primary = horizontal ? dx * sign : dy * sign
    const secondary = Math.abs(horizontal ? dy : dx)
    if (primary <= 0) continue
    if (horizontal && (candidate.bottom <= rect.top || candidate.top >= rect.bottom)) {
      continue
    }
    if (primary < bestPrimary || (primary === bestPrimary && secondary < bestSecondary)) {
      best = link
      bestPrimary = primary
      bestSecondary = secondary
    }
  }

  best?.focus()
  return true
}

export function navigateFilmstrips(
  event: ControllerEvent,
  links: readonly FilmstripLink[],
  activeElement: object | null
) {
  if (links.length === 0) return

  const current = links.findIndex((link) => link === activeElement)
  if (event.event === "click") {
    const link = links[current === -1 ? 0 : current]
    link.focus()
    link.click()
    return
  }

  if (
    (event.dir !== "CW" && event.dir !== "CCW") ||
    !Number.isSafeInteger(event.steps) ||
    event.steps === 0
  ) {
    return
  }

  const direction = event.dir === "CW" ? 1 : -1
  const start = current === -1 ? (direction === 1 ? -1 : links.length) : current
  const next = Math.min(
    Math.max(start + direction * Math.abs(event.steps), 0),
    links.length - 1
  )
  links[next].focus()
}
