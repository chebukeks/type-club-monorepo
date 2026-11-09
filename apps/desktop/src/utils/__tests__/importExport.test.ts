import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { cleanPdfText, importTxtBuffer } from '../../../electron/importers'
import { markdownToDocxBuffer } from '../../../electron/docxExporter'

describe('File Import & Export utilities', () => {
  it('should clean PDF text by joining soft breaks and removing page numbers', () => {
    const rawPdf = `
Документ исследования

Страница 1 из 5

Первая строка абзаца очень длинная и продол-
жается на следующей строке без проблем.

12

Второй абзац текста начинается здесь.
Он также содержит несколько предложений.
`
    const cleaned = cleanPdfText(rawPdf)

    assert.ok(!cleaned.includes('Страница 1'))
    assert.ok(!cleaned.includes('12'))
    assert.ok(cleaned.includes('продолжается')) // hyphenated word joined
    assert.ok(cleaned.includes('Первая строка абзаца очень длинная и продолжается'))
    assert.ok(cleaned.includes('Второй абзац текста'))
  })

  it('should import TXT buffer correctly handling UTF-8 BOM', () => {
    const utf8WithBom = Buffer.from([0xef, 0xbb, 0xbf, 0x48, 0x65, 0x6c, 0x6c, 0x6f])
    const text = importTxtBuffer(utf8WithBom)
    assert.equal(text, 'Hello')

    const plainUtf8 = Buffer.from('Привет мир', 'utf-8')
    assert.equal(importTxtBuffer(plainUtf8), 'Привет мир')
  })

  it('should generate valid DOCX buffers for standard and GOST presets', async () => {
    const md = `# Введение

Текст первого раздела с **полужирным** и *курсивным* текстом.

## Подраздел 1.1

Текст подраздела с формулой $x = 1$.

| Номер | Название |
| --- | --- |
| 1 | Тест |
`
    const standardBuf = await markdownToDocxBuffer(md, { preset: 'standard' })
    assert.ok(standardBuf instanceof Buffer)
    assert.ok(standardBuf.length > 1000)

    const gostBuf = await markdownToDocxBuffer(md, { preset: 'gost' })
    assert.ok(gostBuf instanceof Buffer)
    assert.ok(gostBuf.length > 1000)
  })
})
