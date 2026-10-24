"use client"

import { useEffect, useRef } from "react"

type Star = {
  x: number
  y: number
  size: number
  alpha: number
  speed: number
  phase: number
  sparkle: boolean
}

const STAR_DENSITY = 1 / 9000

// Négyágú, csillogó csillag: két keskeny, egymást keresztező rombusz
function drawSparkle(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number
) {
  const waist = r * 0.14
  ctx.beginPath()
  ctx.moveTo(x, y - r)
  ctx.quadraticCurveTo(x + waist, y - waist, x + r, y)
  ctx.quadraticCurveTo(x + waist, y + waist, x, y + r)
  ctx.quadraticCurveTo(x - waist, y + waist, x - r, y)
  ctx.quadraticCurveTo(x - waist, y - waist, x, y - r)
  ctx.fill()
}

export function Starfield() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext("2d")
    if (!canvas || !ctx) return

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches
    let stars: Star[] = []
    let raf = 0

    const resize = () => {
      const dpr = window.devicePixelRatio || 1
      const w = window.innerWidth
      const h = window.innerHeight
      canvas.width = w * dpr
      canvas.height = h * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

      const count = Math.round(w * h * STAR_DENSITY)
      stars = Array.from({ length: count }, () => {
        const sparkle = Math.random() < 0.18
        return {
          x: Math.random() * w,
          y: Math.random() * h,
          size: sparkle ? 2.5 + Math.random() * 3.5 : 0.5 + Math.random() * 1,
          alpha: 0.15 + Math.random() * 0.35,
          speed: 0.4 + Math.random() * 1.2,
          phase: Math.random() * Math.PI * 2,
          sparkle,
        }
      })
    }

    const render = (time: number) => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      const t = reduceMotion ? 0 : time / 1000

      for (const s of stars) {
        const twinkle = 0.65 + 0.35 * Math.sin(t * s.speed + s.phase)
        const a = s.alpha * twinkle

        if (s.sparkle) {
          const glow = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.size * 2.2)
          glow.addColorStop(0, `rgba(255, 244, 214, ${a * 0.35})`)
          glow.addColorStop(1, "rgba(255, 244, 214, 0)")
          ctx.fillStyle = glow
          ctx.beginPath()
          ctx.arc(s.x, s.y, s.size * 2.2, 0, Math.PI * 2)
          ctx.fill()

          ctx.fillStyle = `rgba(255, 248, 230, ${a})`
          drawSparkle(ctx, s.x, s.y, s.size * (0.85 + 0.15 * twinkle))
        } else {
          ctx.fillStyle = `rgba(235, 240, 255, ${a})`
          ctx.beginPath()
          ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2)
          ctx.fill()
        }
      }

      if (!reduceMotion) raf = requestAnimationFrame(render)
    }

    resize()
    raf = requestAnimationFrame(render)
    const onResize = () => {
      resize()
      if (reduceMotion) render(0)
    }
    window.addEventListener("resize", onResize)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener("resize", onResize)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 size-full"
    />
  )
}
