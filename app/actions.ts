"use server"

import { revalidatePath } from "next/cache"

import prisma from "@/lib/prisma"

export type CreateFilmstripState = {
  ok: boolean
  error?: string
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === "http:" || url.protocol === "https:"
  } catch {
    return false
  }
}

export async function createFilmstrip(
  _prev: CreateFilmstripState,
  formData: FormData
): Promise<CreateFilmstripState> {
  const title = String(formData.get("title") ?? "").trim()
  const firstImageUrl = String(formData.get("firstImageUrl") ?? "").trim()

  if (!title) return { ok: false, error: "A cím megadása kötelező." }
  if (!firstImageUrl) {
    return { ok: false, error: "A kezdő kép linkjének megadása kötelező." }
  }
  if (!isHttpUrl(firstImageUrl)) {
    return { ok: false, error: "Érvényes http(s) linket adj meg." }
  }

  try {
    await prisma.filmstrip.create({ data: { title, firstImageUrl } })
  } catch (error) {
    console.error("Error creating filmstrip:", error)
    return { ok: false, error: "A diafilm mentése nem sikerült." }
  }

  revalidatePath("/")
  return { ok: true }
}

export type FilmRef = { id: number; title: string }

export async function findFilmByNfcUid(uid: string): Promise<FilmRef | null> {
  try {
    const card = await prisma.nfcCard.findUnique({
      where: { uid },
      select: { filmstrip: { select: { id: true, title: true } } },
    })
    return card?.filmstrip ?? null
  } catch (error) {
    console.error("Error looking up NFC card:", error)
    return null
  }
}

export async function assignNfcCard(
  uid: string,
  filmstripId: number
): Promise<{ ok: boolean; film?: FilmRef; error?: string }> {
  if (!uid || !Number.isInteger(filmstripId)) {
    return { ok: false, error: "Hiányzó kártya vagy diafilm." }
  }

  try {
    const card = await prisma.nfcCard.upsert({
      where: { uid },
      create: { uid, filmstripId },
      update: { filmstripId },
      select: { filmstrip: { select: { id: true, title: true } } },
    })
    return { ok: true, film: card.filmstrip }
  } catch (error) {
    console.error("Error assigning NFC card:", error)
    return { ok: false, error: "A mentés nem sikerült." }
  }
}
