"use client"

import { useEffect, useRef } from "react"

import { useController } from "@/components/controller-provider"
import {
  navigateFilmstripGrid,
  navigateFilmstrips,
  type ArrowDirection,
} from "@/lib/filmstrip-navigation"

const arrowKeys: Record<string, ArrowDirection> = {
  ArrowLeft: "left",
  ArrowRight: "right",
  ArrowUp: "up",
  ArrowDown: "down",
  Left: "left",
  Right: "right",
  Up: "up",
  Down: "down",
}

const arrowKeyCodes: Record<number, ArrowDirection> = {
  37: "left",
  38: "up",
  39: "right",
  40: "down",
}

export function FilmstripGrid({ children }: { children: React.ReactNode }) {
  const gridRef = useRef<HTMLDivElement>(null)
  const { subscribe, settingsOpen } = useController()

  useEffect(() => {
    return subscribe((event) => {
      if (settingsOpen || document.querySelector('[data-slot="dialog-content"]')) {
        return
      }

      const links = gridRef.current?.querySelectorAll<HTMLAnchorElement>(
        "a[data-filmstrip-link]"
      )
      if (links) navigateFilmstrips(event, Array.from(links), document.activeElement)
    })
  }, [settingsOpen, subscribe])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const direction = arrowKeys[event.key] ?? arrowKeyCodes[event.keyCode]
      if (
        !direction ||
        event.defaultPrevented ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey ||
        settingsOpen ||
        document.querySelector('[data-slot="dialog-content"]')
      ) {
        return
      }

      const grid = gridRef.current
      const active = document.activeElement
      if (
        !grid ||
        (active !== document.body &&
          active !== document.documentElement &&
          !grid.contains(active)) ||
        (active instanceof HTMLElement &&
          (active.isContentEditable || active.matches("input, textarea, select")))
      ) {
        return
      }

      const links = Array.from(
        grid.querySelectorAll<HTMLAnchorElement>("a[data-filmstrip-link]")
      )
      if (navigateFilmstripGrid(direction, links, active)) event.preventDefault()
    }

    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [settingsOpen])

  return (
    <div ref={gridRef} className="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-4">
      {children}
    </div>
  )
}
