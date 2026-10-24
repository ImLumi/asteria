"use client"

import { useEffect, useState } from "react"
import { MaximizeIcon, MinimizeIcon } from "lucide-react"

import { Button } from "@/components/ui/button"

export function FullscreenToggle() {
  const [active, setActive] = useState(false)

  useEffect(() => {
    const sync = () => setActive(Boolean(document.fullscreenElement))
    sync()
    document.addEventListener("fullscreenchange", sync)
    return () => document.removeEventListener("fullscreenchange", sync)
  }, [])

  return (
    <Button
      variant="ghost"
      size="icon-lg"
      aria-label={active ? "Kilépés a teljes képernyőből" : "Teljes képernyő"}
      onClick={() => {
        if (document.fullscreenElement) void document.exitFullscreen()
        else void document.documentElement.requestFullscreen().catch(() => {})
      }}
    >
      {active ? <MinimizeIcon /> : <MaximizeIcon />}
    </Button>
  )
}
