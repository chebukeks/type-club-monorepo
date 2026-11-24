/**
 * fileUtils.ts — Утилиты для работы с именами файлов и путями.
 */

/**
 * Извлекает осмысленное имя файла по умолчанию из содержимого Markdown-заметки:
 * 1. Ищет первый заголовок (# Заголовок)
 * 2. Если заголовков нет — берёт первую непустую строку
 * 3. Очищает от Markdown-форматирования и запрещённых в файловой системе символов
 * 4. Ограничивает длину до 60 символов
 * 5. Добавляет расширение .md
 */
export function suggestFileName(content: string, fallback: string = 'Untitled.md'): string {
  if (!content || !content.trim()) return fallback

  const lines = content.split(/\r?\n/)
  let candidate = ''

  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (!line) continue
    // Пропускаем YAML/TOML frontmatter разделители
    if (line === '---' || line === '+++') continue

    const headingMatch = line.match(/^#{1,6}\s+(.+)$/)
    if (headingMatch && headingMatch[1].trim()) {
      candidate = headingMatch[1].trim()
      break
    }
    if (!candidate) {
      candidate = line
    }
  }

  if (!candidate) return fallback

  // Очищаем от Markdown-разметки (ссылки, изображения, форматирование, списки)
  let clean = candidate
    .replace(/!\[.*?\]\(.*?\)/g, '')
    .replace(/\[(.*?)\]\(.*?\)/g, '$1')
    .replace(/^[-*+]\s+/, '')
    .replace(/^\d+\.\s+/, '')
    .replace(/[*_~`>#]/g, '')
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  if (!clean) return fallback

  if (clean.length > 60) {
    clean = clean.slice(0, 60).trim()
  }

  return clean.toLowerCase().endsWith('.md') ? clean : `${clean}.md`
}

export function resolveDocumentImageSrc(src: string, documentPath: string): string {
  if (!src || /^(?:[a-z][\w+.-]*:|[/\\]|[?#])/i.test(src)) return src

  const normalizedPath = documentPath.replace(/\\/g, '/')
  const encodedPath = normalizedPath.split('/').map(encodeURIComponent).join('/')
  const documentUrl = normalizedPath.startsWith('//')
    ? `file:${encodedPath}`
    : `file:///${encodedPath.replace(/^\//, '').replace(/^([a-z])%3A\//i, '$1:/')}`

  return new URL(src.replace(/\\/g, '/'), documentUrl).href
}

export const LOCAL_IMAGE_SCHEME = 'typeclub-image'

export function resolveDesktopImageSrc(src: string, documentPath: string, pageProtocol: string): string {
  const fileUrl = resolveDocumentImageSrc(src, documentPath)
  if (fileUrl === src || pageProtocol === 'file:') return fileUrl

  const url = new URL(fileUrl)
  const fragment = url.hash
  url.hash = ''
  return `${LOCAL_IMAGE_SCHEME}://local/?file=${encodeURIComponent(url.href)}${fragment}`
}
