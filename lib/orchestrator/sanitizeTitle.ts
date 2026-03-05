/**
 * Удаление хвостовой пунктуации из title.
 * Применяется: после parseSegment (до каталога), после канонизации (перед items/clarification).
 */
export function sanitizeTitle(s: string): string {
  return (s || '')
    .trim()
    .replace(/\s*[,.;:\-–—]+$/g, '')
    .trim()
}
