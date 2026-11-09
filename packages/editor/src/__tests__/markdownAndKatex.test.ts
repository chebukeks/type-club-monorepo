import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  parseMarkdown,
  serializeMarkdown,
  generateExportHtml,
} from '../editor/markdownConfig'
import { stripMarkdown } from '../editor/stripMarkdown'
import katex from 'katex'

describe('Editor Markdown & KaTeX integration', () => {
  it('should parse and serialize standard markdown elements', () => {
    const originalMd = '# Hello World\n\nThis is a **bold** and *italic* text with `inline code` and a [link](https://example.com).\n\n- Item 1\n- Item 2\n\n> Blockquote text'
    const doc = parseMarkdown(originalMd)

    assert.ok(doc)
    assert.equal(doc.type.name, 'doc')
    assert.ok(doc.childCount >= 3)

    const serialized = serializeMarkdown(doc)
    assert.ok(serialized.includes('# Hello World'))
    assert.ok(serialized.includes('**bold**'))
    assert.ok(serialized.includes('*italic*'))
    assert.ok(serialized.includes('`inline code`'))
    assert.ok(serialized.includes('[link](https://example.com)'))
    assert.ok(serialized.includes('Item 1'))
    assert.ok(serialized.includes('Item 2'))
    assert.ok(serialized.includes('> Blockquote text'))
  })

  it('should parse and serialize tables correctly', () => {
    const tableMd = '| Col 1 | Col 2 |\n| --- | --- |\n| Val A | Val B |'
    const doc = parseMarkdown(tableMd)

    assert.ok(doc)
    const serialized = serializeMarkdown(doc)
    assert.ok(serialized.includes('Col 1'))
    assert.ok(serialized.includes('Col 2'))
    assert.ok(serialized.includes('Val A'))
    assert.ok(serialized.includes('Val B'))
  })

  it('should parse and serialize inline and display math with KaTeX', () => {
    const mathMd = 'Inline math: $E = mc^2$.\n\n$$\\frac{a}{b} = c$$'
    const doc = parseMarkdown(mathMd)

    assert.ok(doc)
    const serialized = serializeMarkdown(doc)
    assert.ok(serialized.includes('E = mc^2'))
    assert.ok(serialized.includes('\\frac{a}{b} = c'))
  })

  it('should directly render formulas with katex.renderToString safely', () => {
    const rendered = katex.renderToString('x^2 + y^2 = z^2', {
      throwOnError: false,
      displayMode: false,
    })
    assert.ok(rendered)
    assert.ok(rendered.includes('katex'))
    assert.ok(rendered.includes('span'))
  })

  it('should generate valid standalone HTML export with styles and scripts', () => {
    const md = '# Title\n\nSome text with $x + y = 10$'
    const html = generateExportHtml(md, 'dark')

    assert.ok(html.includes('<!DOCTYPE html>'))
    assert.ok(html.includes('<html'))
    assert.ok(html.includes('<style>'))
    assert.ok(html.includes('katex'))
    assert.ok(html.includes('Title'))
  })

  it('should generate HTML with GOST preset styling', () => {
    const md = '# Отчет о НИР\n\nТекст отчета.'
    const html = generateExportHtml(md, { preset: 'gost', title: 'Отчет' })

    assert.ok(html.includes('Times New Roman'))
    assert.ok(html.includes('1.25cm'))
    assert.ok(html.includes('Отчет'))
  })

  it('should strip markdown formatting cleanly for TXT export', () => {
    const md = `# Заголовок статьи

Введение с **жирным** и *курсивным* текстом, а также [ссылкой](https://example.com) и \`кодом\`.

![Схема архитектуры](https://example.com/img.png)

> Важная цитата

- [x] Задача выполнена
- [ ] Задача в процессе
* Обычный пункт

| Колонка 1 | Колонка 2 |
| --- | --- |
| Значение 1 | Значение 2 |

\`\`\`typescript
const a = 1;
\`\`\`
`
    const txt = stripMarkdown(md)

    assert.ok(!txt.includes('# Заголовок'))
    assert.ok(txt.includes('Заголовок статьи'))
    assert.ok(!txt.includes('**жирным**'))
    assert.ok(txt.includes('жирным'))
    assert.ok(!txt.includes('*курсивным*'))
    assert.ok(txt.includes('курсивным'))
    assert.ok(txt.includes('ссылкой (https://example.com)'))
    assert.ok(!txt.includes('`кодом`'))
    assert.ok(txt.includes('кодом'))
    assert.ok(txt.includes('[Схема архитектуры]'))
    assert.ok(txt.includes('Важная цитата'))
    assert.ok(txt.includes('[x] Задача выполнена'))
    assert.ok(txt.includes('[ ] Задача в процессе'))
    assert.ok(txt.includes('• Обычный пункт'))
    assert.ok(txt.includes('Колонка 1\tКолонка 2'))
    assert.ok(txt.includes('Значение 1\tЗначение 2'))
    assert.ok(txt.includes('const a = 1;'))
  })
})
