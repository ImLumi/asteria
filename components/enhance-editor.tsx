"use client"

import { useCallback, useEffect, useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  CircleIcon,
  EraserIcon,
  SlashIcon,
  XIcon,
} from "lucide-react"

import { enhanceSavedFilmstrip } from "@/app/actions"
import { Button } from "@/components/ui/button"
import {
  deskewDegrees,
  type CircleMark,
  type FrameMarks,
  type LineMark,
} from "@/lib/enhance-marks"
import { buildFrameUrl } from "@/lib/frames"

const MAX_FRAMES = 1000
const BATCH_SIZE = 6
const DEFAULT_RADIUS = 0.03

type Tool = "white" | "black" | "line"

function probeImage(src: string): Promise<boolean> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve(true)
    img.onerror = () => resolve(false)
    img.src = src
  })
}

function clampRadius(value: number): number {
  return Math.min(0.12, Math.max(0.012, value))
}

export function EnhanceEditor({
  id,
  title,
  firstImageUrl,
}: {
  id: number
  title: string
  firstImageUrl: string
}) {
  const router = useRouter()
  const stageRef = useRef<HTMLDivElement>(null)
  const frameCountRef = useRef(0)
  const [frames, setFrames] = useState<string[]>([])
  const [discovering, setDiscovering] = useState(true)
  const [failed, setFailed] = useState(false)
  const [index, setIndex] = useState(0)
  const [tool, setTool] = useState<Tool>("white")
  const [radius, setRadius] = useState(DEFAULT_RADIUS)
  const [marks, setMarks] = useState<Record<number, FrameMarks>>({})
  const [draft, setDraft] = useState<LineMark | null>(null)
  const [natural, setNatural] = useState({ w: 0, h: 0 })
  const [stage, setStage] = useState({ w: 0, h: 0 })
  const [hint, setHint] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const close = useCallback(() => router.push("/"), [router])
  const frameMarks = marks[index]

  useEffect(() => {
    frameCountRef.current = frames.length
  }, [frames.length])

  useEffect(() => {
    let cancelled = false
    async function load() {
      const first = buildFrameUrl(firstImageUrl, 0) ?? firstImageUrl
      if (!(await probeImage(first))) {
        if (!cancelled) {
          setFailed(true)
          setDiscovering(false)
        }
        return
      }
      if (cancelled) return
      setFrames([first])
      if (buildFrameUrl(firstImageUrl, 1) === null) {
        setDiscovering(false)
        return
      }

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
          found.push(urls[k]!)
        }
        if (found.length > 0) setFrames((prev) => [...prev, ...found])
        if (found.length < urls.length) break
      }
      if (!cancelled) setDiscovering(false)
    }
    load()
    return () => {
      cancelled = true
    }
  }, [firstImageUrl])

  useEffect(() => {
    const el = stageRef.current
    if (!el) return
    const observer = new ResizeObserver(([entry]) => {
      setStage({
        w: entry?.contentRect.width ?? 0,
        h: entry?.contentRect.height ?? 0,
      })
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close()
      else if (event.key === "ArrowRight") {
        setIndex((i) => Math.min(i + 1, Math.max(frameCountRef.current - 1, 0)))
      } else if (event.key === "ArrowLeft") setIndex((i) => Math.max(0, i - 1))
      else if (event.key === "1") setTool("white")
      else if (event.key === "2") setTool("black")
      else if (event.key === "3") setTool("line")
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [close])

  const patchFrame = (patch: Partial<FrameMarks>) => {
    setMarks((prev) => ({ ...prev, [index]: { ...prev[index], ...patch } }))
  }

  const pointFromEvent = (event: React.PointerEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    return {
      x: Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height)),
    }
  }

  const placeCircle = (point: { x: number; y: number }) => {
    if (tool === "line") return
    const current = frameMarks?.[tool]
    const mark: CircleMark = {
      ...point,
      r: current?.r ?? radius,
    }
    patchFrame({ [tool]: mark })
    setHint(null)
  }

  const changeRadius = (delta: number) => {
    const next = clampRadius(
      (frameMarks?.[tool === "line" ? "white" : tool]?.r ?? radius) + delta
    )
    setRadius(next)
    if (tool !== "line" && frameMarks?.[tool]) {
      patchFrame({ [tool]: { ...frameMarks[tool]!, r: next } })
    }
  }

  const save = () => {
    setError(null)
    const payload = Object.entries(marks).flatMap(([key, frame]) => {
      if (!frame?.white && !frame?.black && !frame?.line) return []
      return [{ index: Number(key), marks: frame }]
    })
    startTransition(async () => {
      const res = await enhanceSavedFilmstrip(id, payload)
      if (res.ok) router.push(`/film/${id}`)
      else setError(res.error ?? "A javítás nem sikerült.")
    })
  }

  const aspect = natural.w > 0 && natural.h > 0 ? natural.w / natural.h : 4 / 3
  const displayW = Math.max(0, Math.min(stage.w, stage.h * aspect))
  const displayH = displayW / aspect
  const src = frames[index]
  const angle = frameMarks?.line ? deskewDegrees(frameMarks.line) : null

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black text-white">
      <header className="flex flex-wrap items-center gap-2 px-4 py-3">
        <div className="mr-auto min-w-0">
          <p className="truncate text-sm text-white/70">{title}</p>
          <p className="text-sm">
            {frames.length === 0
              ? "Képek keresése..."
              : `${index + 1} / ${frames.length}`}
            {discovering && frames.length > 0 ? " · további diák keresése" : ""}
          </p>
        </div>
        <ToolButton
          active={tool === "white"}
          label="Fehér"
          onClick={() => setTool("white")}
        >
          <CircleIcon className="text-white" />
        </ToolButton>
        <ToolButton
          active={tool === "black"}
          label="Fekete"
          onClick={() => setTool("black")}
        >
          <CircleIcon className="text-white/40" />
        </ToolButton>
        <ToolButton
          active={tool === "line"}
          label="Dőlés"
          onClick={() => setTool("line")}
        >
          <SlashIcon />
        </ToolButton>
        {tool !== "line" && (
          <>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => changeRadius(-0.006)}
            >
              Kisebb
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => changeRadius(0.006)}
            >
              Nagyobb
            </Button>
          </>
        )}
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => {
            setMarks((prev) => {
              const next = { ...prev }
              delete next[index]
              return next
            })
            setDraft(null)
            setHint(null)
          }}
        >
          <EraserIcon />
          Törlés
        </Button>
        <Button
          type="button"
          disabled={pending || discovering || failed}
          onClick={save}
        >
          {pending ? "Javítás..." : "Mentés és javítás"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Bezárás"
          className="text-white hover:bg-white/10"
          onClick={close}
        >
          <XIcon />
        </Button>
      </header>

      <div ref={stageRef} className="relative min-h-0 flex-1">
        {failed && (
          <p className="absolute inset-0 grid place-items-center text-sm text-destructive">
            A kezdő kép nem tölthető be.
          </p>
        )}
        {src && displayW > 0 && (
          <div
            className="absolute top-1/2 left-1/2"
            style={{
              width: displayW,
              height: displayH,
              transform: "translate(-50%, -50%)",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src}
              alt={`${title} – ${index + 1}. kép`}
              draggable={false}
              className="size-full select-none"
              onLoad={(event) => {
                setNatural({
                  w: event.currentTarget.naturalWidth,
                  h: event.currentTarget.naturalHeight,
                })
              }}
            />
            <svg
              className="absolute inset-0 cursor-crosshair touch-none"
              viewBox={`0 0 ${natural.w || 1} ${natural.h || 1}`}
              preserveAspectRatio="none"
              onPointerDown={(event) => {
                const point = pointFromEvent(event)
                if (tool === "line") {
                  setDraft({
                    x1: point.x,
                    y1: point.y,
                    x2: point.x,
                    y2: point.y,
                  })
                  event.currentTarget.setPointerCapture(event.pointerId)
                  return
                }
                placeCircle(point)
              }}
              onPointerMove={(event) => {
                if (!draft) return
                const point = pointFromEvent(event)
                setDraft((current) =>
                  current ? { ...current, x2: point.x, y2: point.y } : current
                )
              }}
              onPointerUp={() => {
                if (!draft) return
                const dx = draft.x2 - draft.x1
                const dy = draft.y2 - draft.y1
                if (dx * dx + dy * dy < 0.08 * 0.08) {
                  setHint("A vonal túl rövid. Húzz egy hosszabb élet.")
                } else if (deskewDegrees(draft) === null) {
                  setHint(
                    "A vonal túl ferde. Jelölj egy majdnem vízszintes vagy függőleges élet."
                  )
                } else {
                  patchFrame({ line: draft })
                  setHint(null)
                }
                setDraft(null)
              }}
            >
              <MarkOverlay marks={frameMarks} natural={natural} draft={draft} />
            </svg>
          </div>
        )}
      </div>

      <footer className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm text-white/70">
        <Button
          type="button"
          variant="secondary"
          size="icon"
          aria-label="Előző dia"
          disabled={index === 0}
          onClick={() => {
            setIndex((i) => Math.max(0, i - 1))
            setNatural({ w: 0, h: 0 })
          }}
        >
          <ChevronLeftIcon />
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="icon"
          aria-label="Következő dia"
          disabled={index >= frames.length - 1}
          onClick={() => {
            setIndex((i) => Math.min(frames.length - 1, i + 1))
            setNatural({ w: 0, h: 0 })
          }}
        >
          <ChevronRightIcon />
        </Button>
        <p className="min-w-0 flex-1">
          {hint ??
            (angle
              ? `Egyenesítés: ${Math.abs(angle).toFixed(1)}°. A jelöletlen diák automatikusan javulnak.`
              : "Fehér: a betű fehérje. Fekete: a legsötétebb rész. Dőlés: egy majdnem egyenes él. A jelölések nem kötelezők.")}
        </p>
        {error && (
          <p role="alert" className="text-destructive">
            {error}
          </p>
        )}
      </footer>
    </div>
  )
}

function ToolButton({
  active,
  label,
  onClick,
  children,
}: {
  active: boolean
  label: string
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <Button
      type="button"
      variant={active ? "default" : "secondary"}
      size="sm"
      aria-pressed={active}
      onClick={onClick}
    >
      {children}
      {label}
    </Button>
  )
}

function MarkOverlay({
  marks,
  natural,
  draft,
}: {
  marks?: FrameMarks
  natural: { w: number; h: number }
  draft: LineMark | null
}) {
  const min = Math.min(natural.w, natural.h)
  const circle = (mark: CircleMark, stroke: string) => (
    <circle
      cx={mark.x * natural.w}
      cy={mark.y * natural.h}
      r={mark.r * min}
      fill={stroke}
      fillOpacity={0.18}
      stroke={stroke}
      strokeWidth={2}
      vectorEffect="non-scaling-stroke"
    />
  )
  const line = marks?.line
  return (
    <>
      {marks?.white && circle(marks.white, "white")}
      {marks?.black && (
        <circle
          cx={marks.black.x * natural.w}
          cy={marks.black.y * natural.h}
          r={marks.black.r * min}
          fill="#000"
          fillOpacity={0.35}
          stroke="white"
          strokeDasharray="5 4"
          strokeWidth={2}
          vectorEffect="non-scaling-stroke"
        />
      )}
      {line && (
        <line
          x1={line.x1 * natural.w}
          y1={line.y1 * natural.h}
          x2={line.x2 * natural.w}
          y2={line.y2 * natural.h}
          stroke="#f5d90a"
          strokeWidth={2}
          vectorEffect="non-scaling-stroke"
        />
      )}
      {draft && (
        <line
          x1={draft.x1 * natural.w}
          y1={draft.y1 * natural.h}
          x2={draft.x2 * natural.w}
          y2={draft.y2 * natural.h}
          stroke="#f5d90a"
          strokeWidth={1.5}
          vectorEffect="non-scaling-stroke"
        />
      )}
    </>
  )
}
