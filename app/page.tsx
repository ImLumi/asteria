import Link from "next/link"

import { AddFilmstripTile } from "@/components/add-filmstrip-tile"
import { FullscreenToggle } from "@/components/fullscreen-toggle"
import { Starfield } from "@/components/starfield"
import {
  ControllerSettingsButton,
  ControllerSettingsDialog,
} from "@/components/controller-settings"
import prisma from "@/lib/prisma"

export const dynamic = "force-dynamic"

export default async function Page() {
  let filmstrips: Awaited<ReturnType<typeof prisma.filmstrip.findMany>> = []
  let error: string | null = null

  try {
    filmstrips = await prisma.filmstrip.findMany({
      orderBy: { createdAt: "desc" },
    })
  } catch (e) {
    console.error("Error fetching filmstrips:", e)
    error = "A diafilmek betöltése nem sikerült. Ellenőrizd a DATABASE_URL-t."
  }

  return (
    <main className="min-h-svh p-6">
      <Starfield />
      <h1 className="absolute inset-x-0 top-5 text-center text-xl font-semibold tracking-[0.4em] uppercase">
        Asteria
      </h1>

      <div className="absolute top-4 right-4 flex items-center gap-1">
        <FullscreenToggle />
        <ControllerSettingsButton />
        <ControllerSettingsDialog
          filmstrips={filmstrips.map(({ id, title }) => ({ id, title }))}
        />
      </div>

      <div className="mx-auto flex min-h-[calc(100svh-3rem)] max-w-5xl flex-col justify-center gap-6">
        {error && (
          <p role="alert" className="text-center text-sm text-destructive">
            {error}
          </p>
        )}
        <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-4">
          <AddFilmstripTile />
          {filmstrips.map((film) => (
            <Link
              key={film.id}
              href={`/film/${film.id}`}
              className="group relative block aspect-4/3 overflow-hidden rounded-3xl bg-black ring-1 ring-foreground/10"
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
          ))}
        </div>
      </div>
    </main>
  )
}
