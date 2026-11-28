export function readReleaseNotes(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined

  const notes: string[] = []
  for (const item of value) {
    if (typeof item !== 'string' || !item.trim()) continue
    const characters = Array.from(item.trim())
    notes.push(characters.length > 250 ? characters.slice(0, 249).join('') + '…' : characters.join(''))
    if (notes.length === 8) break
  }
  return notes.length ? notes : undefined
}
