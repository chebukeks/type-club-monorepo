import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { resolveDesktopImageSrc, resolveDocumentImageSrc, suggestFileName } from '../fileUtils.ts'

describe('fileUtils — suggestFileName', () => {
  it('should extract filename from first H1 heading', () => {
    const content = '# Мой список задач\n\n- Купить молоко\n- Позвонить врачу'
    const name = suggestFileName(content, 'Без названия.md')
    assert.strictEqual(name, 'Мой список задач.md')
  })

  it('should extract filename from H2 or H3 when no H1 is present', () => {
    const content = '## Архитектурные решения\n\nТекст заметки'
    const name = suggestFileName(content, 'Untitled.md')
    assert.strictEqual(name, 'Архитектурные решения.md')
  })

  it('should fallback to first non-empty line when no headings exist', () => {
    const content = '\n\nСрочная заметка для встречи\nВторая строка'
    const name = suggestFileName(content, 'Untitled.md')
    assert.strictEqual(name, 'Срочная заметка для встречи.md')
  })

  it('should strip markdown formatting and links', () => {
    const content = '**Важное** [обсуждение](https://example.com) с `командой`'
    const name = suggestFileName(content, 'Untitled.md')
    assert.strictEqual(name, 'Важное обсуждение с командой.md')
  })

  it('should sanitize illegal filesystem characters', () => {
    const content = '# Вопрос: почему? / как * это | работает <или> "нет"'
    const name = suggestFileName(content, 'Untitled.md')
    // Illegal characters : ? / * | < > " should be removed/replaced
    assert.ok(!/[<>:"/\\|?*]/.test(name))
    assert.ok(name.endsWith('.md'))
  })

  it('should truncate excessively long names to 60 chars', () => {
    const longHeading = '# ' + 'ОченьДлинныйЗаголовок'.repeat(10)
    const name = suggestFileName(longHeading, 'Untitled.md')
    assert.ok(name.length <= 64) // 60 chars + .md
    assert.ok(name.endsWith('.md'))
  })

  it('should use fallback when content is empty or whitespace only', () => {
    assert.strictEqual(suggestFileName('', 'Без названия.md'), 'Без названия.md')
    assert.strictEqual(suggestFileName('   \n\n  \t  ', 'Untitled.md'), 'Untitled.md')
  })

  it('should not duplicate .md extension if already present', () => {
    const content = '# Readme.md'
    const name = suggestFileName(content, 'Untitled.md')
    assert.strictEqual(name, 'Readme.md')
  })
})

describe('resolveDocumentImageSrc', () => {
  it('resolves the path saved by Save locally beside the Markdown document', () => {
    const src = './image-123.jpeg'
    assert.equal(resolveDocumentImageSrc(src, '/notes/My draft #2/post.md'), 'file:///notes/My%20draft%20%232/image-123.jpeg')
    assert.equal(resolveDocumentImageSrc(src, 'C:\\notes\\My draft #2\\post.md'), 'file:///C:/notes/My%20draft%20%232/image-123.jpeg')
  })

  it('resolves nested paths and leaves absolute and remote sources alone', () => {
    const documentPath = '/notes/section/post.md'
    assert.equal(resolveDocumentImageSrc('../images/a%20b.png', documentPath), 'file:///notes/images/a%20b.png')
    assert.equal(resolveDocumentImageSrc('.\\a.png', '\\\\server\\notes\\post.md'), 'file://server/notes/a.png')
    for (const src of ['https://example.com/image.png', '/uploads/image.png', '/tmp/image.png', 'C:/image.png', 'data:image/png;base64,AA==']) {
      assert.equal(resolveDocumentImageSrc(src, documentPath), src)
    }
  })
})

it('uses the Electron image protocol for relative paths on the Vite page', () => {
  const documentPath = 'C:\\Заметки и фото #1\\черновик.md'
  const source = './image-123.png'
  const fileUrl = resolveDocumentImageSrc(source, documentPath)
  const devUrl = new URL(resolveDesktopImageSrc(source, documentPath, 'http:'))

  assert.equal(devUrl.protocol, 'typeclub-image:')
  assert.equal(devUrl.searchParams.get('file'), fileUrl)
  assert.equal(resolveDesktopImageSrc(source, documentPath, 'file:'), fileUrl)
  assert.equal(resolveDesktopImageSrc('/uploads/image.png', documentPath, 'http:'), '/uploads/image.png')
})
