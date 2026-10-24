"use client"

import { useActionState, useEffect, useState } from "react"
import { PlusIcon } from "lucide-react"

import { createFilmstrip, type CreateFilmstripState } from "@/app/actions"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

const initialState: CreateFilmstripState = { ok: false }

function AddFilmstripForm({ onDone }: { onDone: () => void }) {
  const [state, formAction, pending] = useActionState(
    createFilmstrip,
    initialState
  )

  useEffect(() => {
    if (state.ok) onDone()
  }, [state, onDone])

  return (
    <form action={formAction} className="grid gap-4">
      <div className="grid gap-2">
        <Label htmlFor="title">Diafilm címe</Label>
        <Input id="title" name="title" required autoFocus />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="firstImageUrl">Kezdő kép linkje</Label>
        <Input
          id="firstImageUrl"
          name="firstImageUrl"
          type="url"
          placeholder="https://.../kep-01.jpg"
          required
        />
      </div>
      {state.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
      <DialogFooter>
        <Button type="submit" disabled={pending}>
          {pending ? "Mentés..." : "Hozzáadás"}
        </Button>
      </DialogFooter>
    </form>
  )
}

export function AddFilmstripTile() {
  const [open, setOpen] = useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <button
            type="button"
            aria-label="Új diafilm hozzáadása"
            className="flex aspect-4/3 w-full items-center justify-center rounded-3xl border-2 border-dashed border-border text-muted-foreground transition-colors hover:border-foreground/40 hover:text-foreground"
          />
        }
      >
        <PlusIcon className="size-12" />
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Új diafilm</DialogTitle>
          <DialogDescription>
            Add meg a diafilm címét és az első kép linkjét.
          </DialogDescription>
        </DialogHeader>
        {open && <AddFilmstripForm onDone={() => setOpen(false)} />}
      </DialogContent>
    </Dialog>
  )
}
