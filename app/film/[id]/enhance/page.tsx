import { notFound } from "next/navigation"

import { EnhanceEditor } from "@/components/enhance-editor"
import prisma from "@/lib/prisma"

export const dynamic = "force-dynamic"

export default async function EnhancePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const filmId = Number(id)
  if (!Number.isInteger(filmId)) notFound()

  const film = await prisma.filmstrip.findUnique({ where: { id: filmId } })
  if (!film) notFound()

  return (
    <EnhanceEditor
      id={film.id}
      title={film.title}
      firstImageUrl={film.firstImageUrl}
    />
  )
}
