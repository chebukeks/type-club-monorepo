/**
 * stripMarkdown.ts — Очистка Markdown-разметки для экспорта в простой текст (.txt)
 *
 * Преобразует документ Markdown в читаемый чистый текст без спецсимволов разметки,
 * сохраняя структуру абзацев, списков, таблиц и цитат.
 */

export function stripMarkdown(markdown: string): string {
  if (!markdown || typeof markdown !== 'string') return ''

  return markdown
    // 1. Удаляем фронтматтер YAML / TOML
    .replace(/^---[\s\S]*?---\r?\n*/, '')
    .replace(/^\+\+\+[\s\S]*?\+\+\+\r?\n*/, '')

    // 2. Теги системы правок Type Club (suggestion)
    .replace(/<span[^>]*class="[^"]*suggestion-delete[^"]*"[^>]*>[\s\S]*?<\/span>/gi, '')
    .replace(/<span[^>]*class="[^"]*suggestion-insert[^"]*"[^>]*>([\s\S]*?)<\/span>/gi, '$1')
    .replace(/<span[^>]*class="[^"]*suggestion-note[^"]*"[^>]*>[\s\S]*?<\/span>/gi, '')

    // 3. HTML-теги: убираем теги, сохраняя текстовое содержимое
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')

    // 4. Заголовки: # Заголовок -> Заголовок
    .replace(/^#{1,6}\s+(.+)$/gm, '$1')

    // 5. Изображения: ![alt](url) -> [Изображение: alt] или пусто
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, (_match, alt) => {
      const cleanAlt = alt.trim()
      return cleanAlt ? `[${cleanAlt}]` : ''
    })

    // 6. Ссылки: [text](url) -> text (url), или просто text если ссылка совпадает с текстом
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_match, text, url) => {
      const cleanText = text.trim()
      const cleanUrl = url.trim()
      if (cleanText === cleanUrl || cleanUrl.startsWith('#')) {
        return cleanText
      }
      return `${cleanText} (${cleanUrl})`
    })

    // 7. Форматирование текста: жирный, курсив, зачёркивание, подсветка, спойлеры
    .replace(/(\*\*|__)(.*?)\1/g, '$2')
    .replace(/(\*|_)(.*?)\1/g, '$2')
    .replace(/~~(.*?)~~/g, '$1')
    .replace(/==(.*?)==/g, '$1')
    .replace(/\|\|(.*?)\|\|/g, '$1')

    // 8. Блоки кода ```lang\ncode\n``` -> code
    .replace(/```[a-zA-Z0-9_-]*\r?\n([\s\S]*?)\r?\n```/g, '$1')

    // 9. Инлайн-код `code` -> code
    .replace(/`([^`]+)`/g, '$1')

    // 10. Формулы LaTeX $$...$$ и $...$
    .replace(/\$\$([\s\S]*?)\$\$/g, '$1')
    .replace(/\$([^\$\r\n]+)\$/g, '$1')

    // 11. Цитаты: > цитата -> цитата
    .replace(/^>\s?/gm, '')

    // 12. Списки задач: [ ] и [x]
    .replace(/^(\s*)[-*+]\s+\[ \]\s+/gm, '$1[ ] ')
    .replace(/^(\s*)[-*+]\s+\[x\]\s+/gm, '$1[x] ')

    // 13. Маркированные списки: - или * -> •
    .replace(/^(\s*)[-*+]\s+/gm, '$1• ')

    // 14. Горизонтальные разделители: ---, ***, ___
    .replace(/^[-*_]{3,}\s*$/gm, '----------------------------------------')

    // 15. Таблицы Markdown: разделительная полоса |---|---|
    .replace(/^\s*\|?\s*[-:]+[-| :]*\|\s*$/gm, '')

    // 16. Таблицы Markdown: ячейки через табуляцию
    .replace(/^\|(.*)\|$/gm, (_match, row) => {
      return row
        .split('|')
        .map((col: string) => col.trim())
        .join('\t')
    })

    // 17. Нормализация переносов строк (не более двух подряд)
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
