import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {
  importDocxBuffer,
  importHtmlBuffer,
  importTxtBuffer,
  ommlToLatex,
} from '../../../electron/importers'
import { markdownToDocxBuffer } from '../../../electron/docxExporter'
import { generateExportHtml } from '../../../../../packages/editor/src/editor/markdownConfig'
import { stripMarkdown } from '../../../../../packages/editor/src/editor/stripMarkdown'

describe('File Import & Export Round-trip Compatibility & ГОСТ Compliance', () => {
  const fixturesDir = path.resolve(process.cwd(), 'apps/desktop/src/utils/__tests__/fixtures')
  const academicMd = fs.readFileSync(path.join(fixturesDir, 'academic-paper.md'), 'utf-8')
  const techMd = fs.readFileSync(path.join(fixturesDir, 'technical-spec.md'), 'utf-8')

  describe('DOCX Round-trip Multi-pass Stability (md -> docx -> md -> docx -> md)', () => {
    it('should achieve 100% idempotence on academic document (Pass 1 === Pass 2)', async () => {
      // Pass 1: Original MD -> DOCX -> Imported MD 1
      const docx1 = await markdownToDocxBuffer(academicMd, { preset: 'standard' })
      const md1 = await importDocxBuffer(docx1)

      // Pass 2: Imported MD 1 -> DOCX -> Imported MD 2
      const docx2 = await markdownToDocxBuffer(md1, { preset: 'standard' })
      const md2 = await importDocxBuffer(docx2)

      // Pass 1 and Pass 2 must be bit-for-bit identical (zero degradation)
      assert.equal(md1.trim(), md2.trim(), 'Second pass must be completely identical to the first pass')
    })

    it('should achieve 100% idempotence on technical spec document (Pass 1 === Pass 2)', async () => {
      const docx1 = await markdownToDocxBuffer(techMd, { preset: 'standard' })
      const md1 = await importDocxBuffer(docx1)

      const docx2 = await markdownToDocxBuffer(md1, { preset: 'standard' })
      const md2 = await importDocxBuffer(docx2)

      assert.equal(md1.trim(), md2.trim(), 'Second pass must be completely identical to the first pass')
    })

    it('should achieve 100% idempotence with ГОСТ preset', async () => {
      const docxGost1 = await markdownToDocxBuffer(academicMd, { preset: 'gost' })
      const mdGost1 = await importDocxBuffer(docxGost1)

      const docxGost2 = await markdownToDocxBuffer(mdGost1, { preset: 'gost' })
      const mdGost2 = await importDocxBuffer(docxGost2)

      assert.equal(mdGost1.trim(), mdGost2.trim(), 'GOST roundtrip must be idempotent')
    })
  })

  describe('Formulas & Mathematical Notation Fidelity in DOCX', () => {
    it('should preserve inline formulas ($E = mc^2$) across docx roundtrip', async () => {
      const docxBuf = await markdownToDocxBuffer(academicMd, { preset: 'standard' })
      const imported = await importDocxBuffer(docxBuf)

      assert.ok(imported.includes('$E = mc^2$'), 'Inline formula $E = mc^2$ must be preserved')
      assert.ok(imported.includes('$U$'), 'Variable $U$ must be preserved')
      assert.ok(imported.includes('$I$'), 'Variable $I$ must be preserved')
      assert.ok(imported.includes('$P$'), 'Variable $P$ must be preserved')
    })

    it('should preserve block formulas ($$\\frac{a}{b} = c$$) across docx roundtrip', async () => {
      const docxBuf = await markdownToDocxBuffer(academicMd, { preset: 'standard' })
      const imported = await importDocxBuffer(docxBuf)

      assert.ok(
        imported.includes('$$\n\\frac{a}{b} = c\n$$') || imported.includes('$$\n{a}/{b} = c\n$$') || imported.includes('\\frac{a}{b} = c'),
        'Block fraction formula must be preserved'
      )
      assert.ok(
        imported.includes('H\\psi = E\\psi'),
        'Schrodinger equation must be preserved'
      )
    })

    it('ommlToLatex should correctly convert XML math structures', () => {
      const fractionXml = '<m:f><m:num><m:r><m:t>x</m:t></m:r></m:num><m:den><m:r><m:t>y</m:t></m:r></m:den></m:f>'
      assert.equal(ommlToLatex(fractionXml), '\\frac{x}{y}')

      const supXml = '<m:sSup><m:e><m:r><m:t>x</m:t></m:r></m:e><m:sup><m:r><m:t>2</m:t></m:r></m:sup></m:sSup>'
      assert.equal(ommlToLatex(supXml), '{x}^{2}')

      const subXml = '<m:sSub><m:e><m:r><m:t>a</m:t></m:r></m:e><m:sub><m:r><m:t>i</m:t></m:r></m:sub></m:sSub>'
      assert.equal(ommlToLatex(subXml), '{a}_{i}')

      const radXml = '<m:rad><m:e><m:r><m:t>16</m:t></m:r></m:e></m:rad>'
      assert.equal(ommlToLatex(radXml), '\\sqrt{16}')
    })
  })

  describe('Tables, Lists & Code Elements Fidelity in DOCX', () => {
    it('should preserve markdown table headers, columns, and rows across docx roundtrip', async () => {
      const docxBuf = await markdownToDocxBuffer(academicMd, { preset: 'standard' })
      const imported = await importDocxBuffer(docxBuf)

      assert.ok(imported.includes('| --- | --- | --- | --- |'), 'Table header separator must be present')
      assert.ok(imported.includes('Номер образца'), 'Table column header must be present')
      assert.ok(imported.includes('1.25'), 'Table data cell must be present')
      assert.ok(imported.includes('210.0'), 'Table data cell must be present')
    })

    it('should preserve bulleted and numbered lists across docx roundtrip', async () => {
      const docxBuf = await markdownToDocxBuffer(academicMd, { preset: 'standard' })
      const imported = await importDocxBuffer(docxBuf)

      assert.ok(imported.includes('- Линейная зависимость проводимости'), 'Bullet list item must be preserved')
      assert.ok(imported.includes('- Эффект туннелирования'), 'Bullet list item must be preserved')
      assert.ok(imported.includes('1. Подготовка криостата'), 'Numbered list item must be preserved')
      assert.ok(imported.includes('2. Калибровка датчиков Холла'), 'Numbered list item must be preserved')
    })

    it('should preserve fenced code blocks and inline code', async () => {
      const docxBuf = await markdownToDocxBuffer(techMd, { preset: 'standard' })
      const imported = await importDocxBuffer(docxBuf)

      assert.ok(imported.includes('`createCollabClient`'), 'Inline code must be preserved with backticks')
      assert.ok(imported.includes('```'), 'Fenced code block must be preserved')
      assert.ok(imported.includes('const client = new CollabClient({'), 'Code block content must be preserved')
    })

    it('should preserve blockquotes', async () => {
      const docxBuf = await markdownToDocxBuffer(academicMd, { preset: 'standard' })
      const imported = await importDocxBuffer(docxBuf)

      assert.ok(imported.includes('> '), 'Blockquote prefix must be preserved')
      assert.ok(imported.includes('Квантовая когерентность сохраняется'), 'Blockquote content must be preserved')
    })
  })

  describe('HTML and TXT Round-trip Compatibility', () => {
    it('should convert exported HTML back to clean Markdown', () => {
      const html = generateExportHtml(academicMd, { theme: 'light', title: 'Экспорт' })
      const importedMd = importHtmlBuffer(Buffer.from(html, 'utf-8'))

      assert.ok(importedMd.includes('# Исследование квантовых эффектов'))
      assert.ok(importedMd.includes('**квантовомеханических**'))
      assert.ok(importedMd.includes('*низких температурах*'))
      assert.ok(importedMd.includes('~~классической физики~~'))
      assert.ok(importedMd.includes('| Номер образца |'))
      assert.ok(importedMd.includes('- Линейная зависимость'))
      assert.ok(importedMd.includes('1. Подготовка криостата'))
    })

    it('should strip markdown cleanly for TXT export and import back', () => {
      const txt = stripMarkdown(academicMd)
      const importedTxt = importTxtBuffer(Buffer.from(txt, 'utf-8'))

      assert.ok(!importedTxt.includes('**'))
      assert.ok(!importedTxt.includes('~~'))
      assert.ok(!importedTxt.includes('```'))
      assert.ok(importedTxt.includes('Исследование квантовых эффектов'))
      assert.ok(importedTxt.includes('Квантовая когерентность сохраняется'))
    })
  })

  describe('ГОСТ 7.32 / ГОСТ 2.105 Compliance Verifications', () => {
    it('should include correct ГОСТ styles and typography in exported HTML', () => {
      const gostHtml = generateExportHtml(academicMd, { preset: 'gost', title: 'Отчет' })

      // Шрифты и размеры
      assert.ok(gostHtml.includes('"Times New Roman"'), 'ГОСТ должен использовать Times New Roman')
      assert.ok(gostHtml.includes('font-size: 14pt'), 'Основной текст по ГОСТ должен быть 14pt')
      assert.ok(gostHtml.includes('line-height: 1.5'), 'Межстрочный интервал по ГОСТ должен быть 1.5')
      assert.ok(gostHtml.includes('text-indent: 1.25cm'), 'Абзацный отступ по ГОСТ должен быть 1.25cm')

      // Поля страницы
      assert.ok(gostHtml.includes('margin: 20mm 10mm 20mm 30mm'), 'Поля страницы по ГОСТ 7.32 (30/10/20/20 мм)')

      // Маркеры списков
      assert.ok(gostHtml.includes('list-style-type: "–  "'), 'Маркер списка по ГОСТ 7.32 должен быть тире/дефис')

      // Таблицы по ГОСТ
      assert.ok(gostHtml.includes('font-size: 12pt'), 'Текст в таблицах по ГОСТ должен иметь кегль 12pt')
      assert.ok(gostHtml.includes('border: 1px solid #000000'), 'Границы таблиц по ГОСТ должны быть сплошными черными')
    })
  })
})
