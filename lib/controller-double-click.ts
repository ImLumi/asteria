export function createControllerDoubleClickDetector(intervalMs: number) {
  let lastClick: number | null = null

  return {
    reset() {
      lastClick = null
    },
    click(now: number): boolean {
      if (lastClick !== null && now >= lastClick && now - lastClick <= intervalMs) {
        lastClick = null
        return true
      }
      lastClick = now
      return false
    },
  }
}
