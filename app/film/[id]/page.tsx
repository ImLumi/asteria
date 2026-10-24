import { notFound } from "next/navigation"

import { Slideshow } from "@/components/slideshow"
import prisma from "@/lib/prisma"

export const dynamic = "force-dynamic"

export default async function FilmPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const filmId = Number(id)
  if (!Number.isInteger(filmId)) notFound()

  const film = await prisma.filmstrip.findUnique({ where: { id: filmId } })
  if (!film) notFound()

  return <Slideshow title={film.title} firstImageUrl={film.firstImageUrl} />
}
