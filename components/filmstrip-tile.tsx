"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { PencilIcon } from "lucide-react"

import { deleteFilmstrip, updateFilmstrip } from "@/app/actions"
import { Button, buttonVariants } from "@/components/ui/button"
import { enhancedFrameUrl, enhancedPlayback } from "@/lib/enhanced-playback"
import { cn } from "cn"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

type Film = {
  id: number
  title: string
  firstImageUrl: string
  enhanceQuality: boolean
  enhancedFrameCount: number | null
  enhancedSourceUrl: string | null
  updatedAt: Date | string
}

function EditForm({ film, onDone }: { film: Film; onDone: () => void }) {
  const [title, setTitle] = useState(film.title)
  const [url, setUrl] = useState(film.firstImageUrl)
  const [enhance, setEnhance] = useState(film.enhanceQuality)
  const [error, setError] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [pending, startTransition] = useTransition()

  const run = (action: () => Promise<{ ok: boolean; error?: string }>) =>
    startTransition(async () => {
      const res = await action()
      if (res.ok) onDone()
      else setError(res.error ?? "Hiba történt.")
    })

  return (
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault()
        setError(null)
        run(() => updateFilmstrip(film.id, title, url))
      }}
    >
      <div className="grid gap-2">
        <Label htmlFor={`title-${film.id}`}>Diafilm címe</Label>
        <Input
          id={`title-${film.id}`}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor={`url-${film.id}`}>Kezdő kép linkje</Label>
        <Input
          id={`url-${film.id}`}
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          required
        />
      </div>
      <div className="flex items-center gap-2">
        <input
          id={`enhance-${film.id}`}
          type="checkbox"
          checked={enhance}
          onChange={(e) => setEnhance(e.target.checked)}
          className="size-4 accent-foreground"
        />
        <Label htmlFor={`enhance-${film.id}`}>Képminőség javítás</Label>
      </div>
      {enhance && (
        <p className="text-xs text-muted-foreground">
          Mentéskor letölti és feljavítja az összes diát. Ezután a vetítés a
          lementett képeket használja, nem a külső linket.
        </p>
      )}
      {url.trim() === film.firstImageUrl ? (
        <Link
          href={`/film/${film.id}/enhance`}
          className={cn(buttonVariants({ variant: "outline" }))}
        >
          Képminőség javítás
        </Link>
      ) : (
        <Button type="button" variant="outline" disabled>
          Képminőség javítás
        </Button>
      )}
      <p className="text-xs text-muted-foreground">
        {url.trim() === film.firstImageUrl
          ? "Képenként kijelölhető a fehér és a fekete pont, illetve a dőlés. Jelölés nélkül automatikus a javítás."
          : "A kezdő link változott. Előbb mentsd, utána nyílik a javító nézet."}
      </p>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <DialogFooter className="sm:justify-between">
        {confirming ? (
          <Button
            type="button"
            variant="destructive"
            disabled={pending}
            onClick={() => {
              setError(null)
              run(() => deleteFilmstrip(film.id))
            }}
          >
            Biztosan törlöd?
          </Button>
        ) : (
          <Button
            type="button"
            variant="destructive"
            disabled={pending}
            onClick={() => setConfirming(true)}
          >
            Törlés
          </Button>
        )}
        <Button type="submit" disabled={pending}>
          {pending ? "Mentés..." : "Mentés"}
        </Button>
      </DialogFooter>
    </form>
  )
}

export function FilmstripTile({ film }: { film: Film }) {
  const [open, setOpen] = useState(false)
  const playback = enhancedPlayback(film)

  return (
    <div className="group relative">
      <Link
        href={`/film/${film.id}`}
        className="relative block aspect-4/3 overflow-hidden rounded-3xl bg-black ring-1 ring-foreground/10"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={
            playback
              ? enhancedFrameUrl(film.id, 0, playback.version)
              : film.firstImageUrl
          }
          alt={film.title}
          loading="lazy"
          className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
        <span className="absolute inset-x-0 bottom-0 truncate bg-linear-to-t from-black/80 to-transparent p-3 pt-8 text-sm font-medium text-white">
          {film.title}
        </span>
      </Link>

      <Button
        type="button"
        variant="secondary"
        size="icon-sm"
        aria-label="Diafilm szerkesztése"
        className="absolute top-2 right-2 rounded-full bg-black/60 text-white hover:bg-black/80"
        onClick={() => setOpen(true)}
      >
        <PencilIcon />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Diafilm szerkesztése</DialogTitle>
            <DialogDescription>
              Módosítsd a címet vagy a kezdő kép linkjét, nyisd meg a
              képjavítót, vagy töröld a diafilmet.
            </DialogDescription>
          </DialogHeader>
          {open && <EditForm film={film} onDone={() => setOpen(false)} />}
        </DialogContent>
      </Dialog>
    </div>
  )
}
