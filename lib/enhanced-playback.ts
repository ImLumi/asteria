export type EnhancedFilm = {
  id: number
  firstImageUrl: string
  enhanceQuality: boolean
  enhancedFrameCount: number | null
  enhancedSourceUrl: string | null
  updatedAt: Date | string
}

function versionOf(updatedAt: Date | string): number {
  return updatedAt instanceof Date
    ? updatedAt.getTime()
    : new Date(updatedAt).getTime()
}

/** Bekapcsolt javítás és a készlet a jelenlegi kezdő URL-hez tartozik. */
export function enhancedPlayback(
  film: EnhancedFilm
): { id: number; count: number; version: number } | null {
  if (
    !film.enhanceQuality ||
    film.enhancedSourceUrl !== film.firstImageUrl ||
    !film.enhancedFrameCount ||
    film.enhancedFrameCount < 1
  ) {
    return null
  }
  return {
    id: film.id,
    count: film.enhancedFrameCount,
    version: versionOf(film.updatedAt),
  }
}

export function enhancedFrameUrl(
  filmId: number,
  index: number,
  version?: number
): string {
  const base = `/api/enhanced/${filmId}/${index}`
  return version == null ? base : `${base}?v=${version}`
}
