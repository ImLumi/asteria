/**
 * A diafilm képkockáinak URL-jei: az első kép URL-jében a fájlnévben lévő
 * utolsó számcsoport sorszámát növeljük (a kezdő nullákat megtartva).
 */
export function buildFrameUrl(firstImageUrl: string, index: number): string | null {
  let url: URL
  try {
    url = new URL(firstImageUrl)
  } catch {
    return null
  }

  const segments = url.pathname.split("/")
  const fileName = segments[segments.length - 1]
  const matches = [...fileName.matchAll(/\d+/g)]
  const last = matches[matches.length - 1]
  if (!last || last.index === undefined) return null

  const start = Number(last[0])
  const next = String(start + index).padStart(last[0].length, "0")

  segments[segments.length - 1] =
    fileName.slice(0, last.index) +
    next +
    fileName.slice(last.index + last[0].length)
  url.pathname = segments.join("/")
  return url.toString()
}
