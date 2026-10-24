"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { PencilIcon } from "lucide-react"

import { deleteFilmstrip, updateFilmstrip } from "@/app/actions"
import { Button } from "@/components/ui/button"
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

type Film = { id: number; title: string; firstImageUrl: string }

function EditForm({ film, onDone }: { film: Film; onDone: () => void }) {
  const [title, setTitle] = useState(film.title)
  const [url, setUrl] = useState(film.firstImageUrl)
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

  return (
    <div className="group relative">
      <Link
        href={`/film/${film.id}`}
        className="relative block aspect-4/3 overflow-hidden rounded-3xl bg-black ring-1 ring-foreground/10"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={film.firstImageUrl}
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
              Módosítsd a címet vagy a kezdő kép linkjét, vagy töröld a
              diafilmet.
            </DialogDescription>
          </DialogHeader>
          {open && <EditForm film={film} onDone={() => setOpen(false)} />}
        </DialogContent>
      </Dialog>
    </div>
  )
}
