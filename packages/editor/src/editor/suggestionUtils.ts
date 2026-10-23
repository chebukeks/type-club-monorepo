export interface ParsedSuggestion {
  odId: string
  type: 'replace' | 'insert' | 'delete'
  authorName: string
  authorId: number
  createdAt: string
  deletedText?: string
  insertedText?: string
  noteText?: string
}

export interface CreateSuggestionOptions {
  odId?: string
  authorId?: number
  authorName: string
  originalText?: string
  replacementText?: string
  comment?: string
  color?: string
}

export function generateSuggestionId(): string {
  return `sug_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

export function escapeAttr(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

/**
 * Builds HTML spans for a suggestion (delete, insert, note).
 */
export function createSuggestionTags(opts: CreateSuggestionOptions): string {
  const odId = opts.odId || generateSuggestionId()
  const authorId = opts.authorId || 0
  const authorName = escapeAttr(opts.authorName)
  const createdAt = new Date().toISOString()
  const color = opts.color || '#3b82f6'

  let result = ''

  if (opts.originalText) {
    result += `<span class="suggestion-delete" data-od-id="${odId}" data-sug-author-id="${authorId}" data-sug-author-name="${authorName}" data-sug-created-at="${createdAt}">${opts.originalText}</span>`
  }

  if (opts.replacementText) {
    result += `<span class="suggestion-insert" data-od-id="${odId}" data-sug-author-id="${authorId}" data-sug-author-name="${authorName}" data-sug-created-at="${createdAt}" style="--sug-color: ${color}">${opts.replacementText}</span>`
  }

  if (opts.comment) {
    const note = escapeAttr(opts.comment)
    result += `<span class="suggestion-note" data-od-id="${odId}" data-sug-author-id="${authorId}" data-sug-author-name="${authorName}" data-sug-note-text="${note}" data-sug-created-at="${createdAt}"></span>`
  }

  return result
}

/**
 * Parses all suggestions contained in the given markdown text.
 */
export function parseSuggestionsFromMarkdown(markdown: string): ParsedSuggestion[] {
  const map = new Map<string, ParsedSuggestion>()

  // 1. Suggestion Delete spans
  const deleteRegex = /<span\s+class="suggestion-delete"([^>]*)>([\s\S]*?)<\/span>/gi
  let match: RegExpExecArray | null
  while ((match = deleteRegex.exec(markdown)) !== null) {
    const attrs = match[1]
    const content = match[2]
    const odIdMatch = attrs.match(/data-od-id="([^"]*)"/)
    const authorNameMatch = attrs.match(/data-sug-author-name="([^"]*)"/)
    const authorIdMatch = attrs.match(/data-sug-author-id="([^"]*)"/)
    const createdAtMatch = attrs.match(/data-sug-created-at="([^"]*)"/)

    const odId = odIdMatch ? odIdMatch[1] : ''
    if (!odId) continue

    const existing = map.get(odId) || {
      odId,
      type: 'delete',
      authorName: authorNameMatch ? authorNameMatch[1] : 'Advisor',
      authorId: authorIdMatch ? Number(authorIdMatch[1]) || 0 : 0,
      createdAt: createdAtMatch ? createdAtMatch[1] : '',
    }
    existing.deletedText = (existing.deletedText || '') + content
    map.set(odId, existing)
  }

  // 2. Suggestion Insert spans
  const insertRegex = /<span\s+class="suggestion-insert"([^>]*)>([\s\S]*?)<\/span>/gi
  while ((match = insertRegex.exec(markdown)) !== null) {
    const attrs = match[1]
    const content = match[2]
    const odIdMatch = attrs.match(/data-od-id="([^"]*)"/)
    const authorNameMatch = attrs.match(/data-sug-author-name="([^"]*)"/)
    const authorIdMatch = attrs.match(/data-sug-author-id="([^"]*)"/)
    const createdAtMatch = attrs.match(/data-sug-created-at="([^"]*)"/)

    const odId = odIdMatch ? odIdMatch[1] : ''
    if (!odId) continue

    const existing = map.get(odId)
    if (existing) {
      existing.type = 'replace'
      existing.insertedText = (existing.insertedText || '') + content
    } else {
      map.set(odId, {
        odId,
        type: 'insert',
        authorName: authorNameMatch ? authorNameMatch[1] : 'Advisor',
        authorId: authorIdMatch ? Number(authorIdMatch[1]) || 0 : 0,
        createdAt: createdAtMatch ? createdAtMatch[1] : '',
        insertedText: content,
      })
    }
  }

  // 3. Suggestion Note spans
  const noteRegex = /<span\s+class="suggestion-note"([^>]*)><\/span>/gi
  while ((match = noteRegex.exec(markdown)) !== null) {
    const attrs = match[1]
    const odIdMatch = attrs.match(/data-od-id="([^"]*)"/)
    const noteTextMatch = attrs.match(/data-sug-note-text="([^"]*)"/)

    const odId = odIdMatch ? odIdMatch[1] : ''
    if (!odId) continue

    const existing = map.get(odId)
    if (existing && noteTextMatch) {
      existing.noteText = noteTextMatch[1]
    }
  }

  return Array.from(map.values())
}

/**
 * Applies a suggestion decision (accept or reject) on the markdown string.
 */
export function applySuggestionDecision(
  markdown: string,
  odId: string,
  decision: 'accept' | 'reject'
): string {
  const escapedOdId = odId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

  // Regex patterns targeting this specific odId
  const deletePattern = new RegExp(
    `<span\\s+class="suggestion-delete"[^>]*data-od-id="${escapedOdId}"[^>]*>([\\s\\S]*?)<\\/span>`,
    'gi'
  )
  const insertPattern = new RegExp(
    `<span\\s+class="suggestion-insert"[^>]*data-od-id="${escapedOdId}"[^>]*>([\\s\\S]*?)<\\/span>`,
    'gi'
  )
  const notePattern = new RegExp(
    `<span\\s+class="suggestion-note"[^>]*data-od-id="${escapedOdId}"[^>]*><\\/span>`,
    'gi'
  )

  let result = markdown

  // Always remove the note span
  result = result.replace(notePattern, '')

  if (decision === 'accept') {
    // ACCEPT:
    // - Remove deleted text completely
    result = result.replace(deletePattern, '')
    // - Keep inserted text unwrapped
    result = result.replace(insertPattern, '$1')
  } else {
    // REJECT:
    // - Keep original (deleted) text unwrapped
    result = result.replace(deletePattern, '$1')
    // - Remove inserted text completely
    result = result.replace(insertPattern, '')
  }

  return result
}

/**
 * Strips all suggestion spans and produces clean markdown.
 * If mode === 'accepted', applies all proposals.
 * If mode === 'rejected', reverts all proposals to original state.
 */
export function getCleanMarkdown(
  markdown: string,
  mode: 'accept' | 'reject' | 'accepted' | 'rejected' = 'accept'
): string {
  const decision: 'accept' | 'reject' =
    mode === 'reject' || mode === 'rejected' ? 'reject' : 'accept'
  const suggestions = parseSuggestionsFromMarkdown(markdown)
  let current = markdown
  for (const s of suggestions) {
    current = applySuggestionDecision(current, s.odId, decision)
  }
  return current
}

/**
 * Inserts a new suggestion into markdown by targeting an existing substring.
 */
export function proposeSuggestionInMarkdown(
  markdown: string,
  targetText: string,
  replacementText: string,
  authorName: string,
  comment?: string,
  authorId: number = 0
): string {
  if (!targetText && !replacementText) {
    throw new Error('Either targetText or replacementText must be provided')
  }

  const tags = createSuggestionTags({
    authorName,
    authorId,
    originalText: targetText,
    replacementText,
    comment,
  })

  if (!targetText) {
    // Append to end of document if no target specified
    return markdown ? `${markdown}\n\n${tags}` : tags
  }

  const index = markdown.indexOf(targetText)
  if (index === -1) {
    throw new Error(`Target text not found in document: "${targetText}"`)
  }

  return markdown.substring(0, index) + tags + markdown.substring(index + targetText.length)
}
