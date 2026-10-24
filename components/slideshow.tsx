"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { XIcon } from "lucide-react"

import { useController } from "@/components/controller-provider"
import { buildFrameUrl } from "@/lib/frames"

const MAX_FRAMES = 1000
const BATCH_SIZE = 6
// Függőleges sáv (fekete) a képkockák között, a keret magasságának arányában
const GAP_RATIO = 0.04
const RENDER_RADIUS = 3
// Egy enkóder-lépés hány képkockányi mozgást jelent
const ROTATE_FRAMES_PER_STEP = 1 / 40

function probeImage(src: string): Promise<{ w: number; h: number } | null> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight })
    img.onerror = () => resolve(null)
    img.src = src
  })
}

export function Slideshow({
  title,
  firstImageUrl,
}: {
  title: string
  firstImageUrl: string
}) {
  const router = useRouter()
  const { subscribe } = useController()
  const [frames, setFrames] = useState<string[]>([])
  const [aspect, setAspect] = useState(4 / 3)
  const [active, setActive] = useState(0)
  const [failed, setFailed] = useState(false)
  const [needsGesture, setNeedsGesture] = useState(false)

  const windowRef = useRef<HTMLDivElement>(null)
  const stripRef = useRef<HTMLDivElement>(null)
  const targetRef = useRef(0)
  const currentRef = useRef(0)
  const lengthRef = useRef(0)

  const close = useCallback(() => router.push("/"), [router])

  // Képkockák felderítése: addig növeljük a sorszámot, amíg van kép
  useEffect(() => {
    let cancelled = false

    async function load() {
      const first = buildFrameUrl(firstImageUrl, 0) ?? firstImageUrl
      const firstSize = await probeImage(first)
      if (cancelled) return
      if (!firstSize) {
        setFailed(true)
        return
      }
      setAspect(firstSize.w / firstSize.h)
      lengthRef.current = 1
      setFrames([first])

      if (buildFrameUrl(firstImageUrl, 1) === null) return

      for (let i = 1; i < MAX_FRAMES; i += BATCH_SIZE) {
        const urls: string[] = []
        for (let j = i; j < Math.min(i + BATCH_SIZE, MAX_FRAMES); j++) {
          const url = buildFrameUrl(firstImageUrl, j)
          if (url) urls.push(url)
        }
        const results = await Promise.all(urls.map(probeImage))
        if (cancelled) return

        const found: string[] = []
        for (let k = 0; k < results.length; k++) {
          if (!results[k]) break
          found.push(urls[k])
        }
        if (found.length > 0) {
          lengthRef.current += found.length
          setFrames((prev) => [...prev, ...found])
        }
        if (found.length < urls.length) return
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [firstImageUrl])

  const move = useCallback((delta: number) => {
    const max = Math.max(lengthRef.current - 1, 0)
    targetRef.current = Math.min(Math.max(targetRef.current + delta, 0), max)
  }, [])

  const snapTo = useCallback((dir: 1 | -1) => {
    const max = Math.max(lengthRef.current - 1, 0)
    const t = targetRef.current
    const next = dir === 1 ? Math.floor(t + 1e-6) + 1 : Math.ceil(t - 1e-6) - 1
    targetRef.current = Math.min(Math.max(next, 0), max)
  }, [])

  // Animációs ciklus: a keret fix, a képsor mozog mögötte
  useEffect(() => {
    let raf = 0
    let lastActive = 0

    const tick = () => {
      const win = windowRef.current
      const strip = stripRef.current
      if (win && strip) {
        currentRef.current +=
          (targetRef.current - currentRef.current) * 0.14
        if (Math.abs(targetRef.current - currentRef.current) < 0.0005) {
          currentRef.current = targetRef.current
        }
        const step = win.clientHeight * (1 + GAP_RATIO)
        strip.style.transform = `translate3d(0, ${-currentRef.current * step}px, 0)`

        const rounded = Math.round(currentRef.current)
        if (rounded !== lastActive) {
          lastActive = rounded
          setActive(rounded)
        }
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  useEffect(() => {
    return subscribe((e) => {
      if (e.event === "rotate") {
        const steps = Math.abs(e.steps)
        move((e.dir === "CCW" ? -steps : steps) * ROTATE_FRAMES_PER_STEP)
      } else if (e.event === "click") {
        // A képernyőn legnagyobb részt elfoglaló kocka kerül középre
        const max = Math.max(lengthRef.current - 1, 0)
        const nearest = Math.round(currentRef.current)
        targetRef.current = Math.min(Math.max(nearest, 0), max)
      }
    })
  }, [subscribe, move])

  useEffect(() => {
    const onWheel = (e: WheelEvent) => {
      const px = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY
      move(px / 600)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close()
      else if (["ArrowDown", "ArrowRight", "PageDown", " "].includes(e.key)) {
        e.preventDefault()
        snapTo(1)
      } else if (["ArrowUp", "ArrowLeft", "PageUp"].includes(e.key)) {
        e.preventDefault()
        snapTo(-1)
      }
    }
    window.addEventListener("wheel", onWheel, { passive: true })
    window.addEventListener("keydown", onKey)
    return () => {
      window.removeEventListener("wheel", onWheel)
      window.removeEventListener("keydown", onKey)
    }
  }, [move, snapTo, close])

  // Teljes képernyő (böngésző engedélye esetén); kilépéskor vissza a főoldalra
  // Teljes képernyő: a böngésző csak felhasználói művelet után engedi, ezért
  // NFC-s (kézmozdulat nélküli) megnyitásnál az első kattintás/billentyű kéri el.
  useEffect(() => {
    let owned = false
    let entered = false

    const onChange = () => {
      if (document.fullscreenElement) entered = true
      else if (owned && entered) close()
    }

    const request = async () => {
      try {
        await document.documentElement.requestFullscreen()
        owned = true
        setNeedsGesture(false)
        return true
      } catch {
        return false
      }
    }

    const onGesture = () => {
      void request().then((ok) => {
        if (ok) removeGestureListeners()
      })
    }
    const removeGestureListeners = () => {
      window.removeEventListener("pointerdown", onGesture)
      window.removeEventListener("keydown", onGesture)
    }

    document.addEventListener("fullscreenchange", onChange)

    // Ha a főoldalról már teljes képernyőn jöttünk, azt nem vesszük át és nem zárjuk be
    if (!document.fullscreenElement) {
      void request().then((ok) => {
        if (ok) return
        setNeedsGesture(true)
        window.addEventListener("pointerdown", onGesture)
        window.addEventListener("keydown", onGesture)
      })
    }

    return () => {
      document.removeEventListener("fullscreenchange", onChange)
      removeGestureListeners()
      if (owned && document.fullscreenElement) {
        document.exitFullscreen().catch(() => {})
      }
    }
  }, [close])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-black">
      <div
        ref={windowRef}
        className="relative overflow-hidden bg-black"
        style={{ height: "94svh", aspectRatio: aspect, maxWidth: "100vw" }}
      >
        <div ref={stripRef} className="absolute inset-0 will-change-transform">
          {frames.map((src, i) =>
            Math.abs(i - active) <= RENDER_RADIUS ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={src}
                src={src}
                alt={`${title} – ${i + 1}. kép`}
                draggable={false}
                className="absolute inset-x-0 size-full object-cover select-none"
                style={{
                  top: `${i * (1 + GAP_RATIO) * 100}%`,
                  height: "100%",
                }}
              />
            ) : null
          )}
        </div>
      </div>

      {failed && (
        <p className="absolute text-sm text-white/70">
          A diafilm első képe nem tölthető be.
        </p>
      )}

      {needsGesture && (
        <p className="pointer-events-none absolute bottom-3 text-xs text-white/30">
          Koppints vagy nyomj meg egy billentyűt a teljes képernyőhöz
        </p>
      )}

      <button
        type="button"
        onClick={close}
        aria-label="Bezárás"
        className="absolute top-4 right-4 rounded-full p-2 text-white/25 transition-colors hover:text-white/70"
      >
        <XIcon className="size-6" />
      </button>
    </div>
  )
}
