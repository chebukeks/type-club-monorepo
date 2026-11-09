import { useState, useMemo } from 'react'
import { createPortal } from 'react-dom'
import {
  X,
  FileText,
  Code2,
  FileSpreadsheet,
  AlignLeft,
  Download,
  Check,
  Sparkles,
  BookOpen,
} from 'lucide-react'
import { useEditor } from '../context/EditorContext'
import { generateExportHtml, stripMarkdown } from '@type-club/editor'

export type ExportFormat = 'pdf' | 'docx' | 'html' | 'txt'

interface ExportModalProps {
  onClose: () => void
}

export function ExportModal({ onClose }: ExportModalProps) {
  const { state, t } = useEditor()
  const activeTab = state.tabs.find((tab) => tab.id === state.activeTabId)
  const content = activeTab?.content || ''
  const defaultBaseName = activeTab?.fileName || (state.language === 'ru' ? 'Документ' : 'Document')

  const [format, setFormat] = useState<ExportFormat>('pdf')

  // PDF options
  const [pdfPageSize, setPdfPageSize] = useState<'A4' | 'Letter'>('A4')
  const [pdfLandscape, setPdfLandscape] = useState<boolean>(false)
  const [pdfPreset, setPdfPreset] = useState<'light' | 'dark' | 'gost'>('light')
  const [pdfPageNumbers, setPdfPageNumbers] = useState<boolean>(true)

  // HTML options
  const [htmlTheme, setHtmlTheme] = useState<'light' | 'dark'>('dark')

  // DOCX options
  const [docxPreset, setDocxPreset] = useState<'standard' | 'gost'>('standard')

  // TXT options
  const [stripMd, setStripMd] = useState<boolean>(true)

  const [isExporting, setIsExporting] = useState<boolean>(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Превью для HTML / PDF
  const previewHtml = useMemo(() => {
    if (format === 'html') {
      return generateExportHtml(content, { theme: htmlTheme, title: defaultBaseName })
    }
    if (format === 'pdf') {
      if (pdfPreset === 'gost') {
        return generateExportHtml(content, { preset: 'gost', title: defaultBaseName })
      }
      return generateExportHtml(content, { theme: pdfPreset, title: defaultBaseName })
    }
    return ''
  }, [content, format, htmlTheme, pdfPreset, defaultBaseName])

  // Превью для TXT
  const previewTxt = useMemo(() => {
    if (format === 'txt') {
      return stripMd ? stripMarkdown(content) : content
    }
    return ''
  }, [content, format, stripMd])

  const handleExport = async () => {
    setIsExporting(true)
    setErrorMessage(null)
    try {
      let success = false

      if (format === 'pdf') {
        const html = pdfPreset === 'gost'
          ? generateExportHtml(content, { preset: 'gost', title: defaultBaseName })
          : generateExportHtml(content, { theme: pdfPreset, title: defaultBaseName })

        success = await window.api.exportPdf(html, defaultBaseName, {
          pageSize: pdfPageSize,
          landscape: pdfLandscape,
          pageNumbers: pdfPageNumbers,
        })
      } else if (format === 'html') {
        const html = generateExportHtml(content, { theme: htmlTheme, title: defaultBaseName })
        success = await window.api.exportHtml(html, defaultBaseName)
      } else if (format === 'docx') {
        success = await window.api.exportDocx(content, defaultBaseName, {
          preset: docxPreset,
          title: defaultBaseName,
        })
      } else if (format === 'txt') {
        const txt = stripMd ? stripMarkdown(content) : content
        success = await window.api.exportTxt(txt, defaultBaseName)
      }

      if (success) {
        onClose()
      }
    } catch (err) {
      console.error('Ошибка при экспорте:', err)
      setErrorMessage(err instanceof Error ? err.message : String(err))
    } finally {
      setIsExporting(false)
    }
  }

  const formats: { id: ExportFormat; label: string; ext: string; icon: any }[] = [
    { id: 'pdf', label: 'PDF', ext: '.pdf', icon: FileText },
    { id: 'docx', label: 'Word', ext: '.docx', icon: FileSpreadsheet },
    { id: 'html', label: 'HTML', ext: '.html', icon: Code2 },
    { id: 'txt', label: t('export.format') === 'Формат' ? 'Текст' : 'Text', ext: '.txt', icon: AlignLeft },
  ]

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150 ease-out"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className="w-full max-w-4xl h-[620px] max-h-[92vh] flex flex-col bg-[var(--bg-elevated)] border border-[var(--border-strong)] rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150 ease-out"
        style={{ color: 'var(--text-primary)' }}
      >
        {/* Шапка */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-default)]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[var(--accent)]/10 text-[var(--accent)] flex items-center justify-center">
              <Download size={18} />
            </div>
            <div>
              <h2 className="text-base font-semibold leading-tight">{t('export.title')}</h2>
              <p className="text-xs text-[var(--text-dim)] truncate max-w-md">{defaultBaseName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-active)] transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Форматы (вкладки) */}
        <div className="flex items-center gap-2 px-6 pt-3 pb-2 border-b border-[var(--border-default)] bg-[var(--bg-surface)]">
          {formats.map((f) => {
            const Icon = f.icon
            const active = format === f.id
            return (
              <button
                key={f.id}
                onClick={() => setFormat(f.id)}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  active
                    ? 'bg-[var(--accent)] text-white shadow-xs'
                    : 'text-[var(--text-secondary)] hover:bg-[var(--bg-active)] hover:text-[var(--text-primary)]'
                }`}
              >
                <Icon size={14} />
                <span>{f.label}</span>
                <span className={`text-[10px] opacity-75 font-mono`}>{f.ext}</span>
              </button>
            )
          })}
        </div>

        {/* Тело модального окна: Настройки (слева) + Предпросмотр (справа) */}
        <div className="flex flex-1 overflow-hidden">
          {/* Левая колонка: Настройки выбранного формата */}
          <div className="w-[320px] shrink-0 p-5 border-r border-[var(--border-default)] overflow-y-auto space-y-4 text-xs">
            {/* Настройки PDF */}
            {format === 'pdf' && (
              <>
                <div>
                  <label className="block text-[11px] font-semibold text-[var(--text-dim)] uppercase tracking-wider mb-2">
                    {t('export.pageSize')}
                  </label>
                  <div className="grid grid-cols-2 gap-1.5 p-1 bg-[var(--bg-base)] border border-[var(--border-default)] rounded-lg">
                    {(['A4', 'Letter'] as const).map((sz) => (
                      <button
                        key={sz}
                        type="button"
                        onClick={() => setPdfPageSize(sz)}
                        className={`py-1 rounded text-xs font-medium transition-colors ${
                          pdfPageSize === sz ? 'bg-[var(--bg-active)] text-white shadow-xs' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                        }`}
                      >
                        {sz}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-[var(--text-dim)] uppercase tracking-wider mb-2">
                    {t('export.orientation')}
                  </label>
                  <div className="grid grid-cols-2 gap-1.5 p-1 bg-[var(--bg-base)] border border-[var(--border-default)] rounded-lg">
                    <button
                      type="button"
                      onClick={() => setPdfLandscape(false)}
                      className={`py-1 rounded text-xs font-medium transition-colors ${
                        !pdfLandscape ? 'bg-[var(--bg-active)] text-white shadow-xs' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                      }`}
                    >
                      {t('export.portrait')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setPdfLandscape(true)}
                      className={`py-1 rounded text-xs font-medium transition-colors ${
                        pdfLandscape ? 'bg-[var(--bg-active)] text-white shadow-xs' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                      }`}
                    >
                      {t('export.landscape')}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-[var(--text-dim)] uppercase tracking-wider mb-2">
                    {t('export.theme')}
                  </label>
                  <div className="grid grid-cols-3 gap-1 p-1 bg-[var(--bg-base)] border border-[var(--border-default)] rounded-lg">
                    <button
                      type="button"
                      onClick={() => setPdfPreset('light')}
                      className={`py-1 rounded text-xs font-medium transition-colors ${
                        pdfPreset === 'light' ? 'bg-[var(--bg-active)] text-white shadow-xs' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                      }`}
                    >
                      {t('export.themeLight')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setPdfPreset('dark')}
                      className={`py-1 rounded text-xs font-medium transition-colors ${
                        pdfPreset === 'dark' ? 'bg-[var(--bg-active)] text-white shadow-xs' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                      }`}
                    >
                      {t('export.themeDark')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setPdfPreset('gost')}
                      className={`py-1 rounded text-xs font-medium transition-colors ${
                        pdfPreset === 'gost' ? 'bg-[var(--bg-active)] text-white shadow-xs' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                      }`}
                    >
                      ГОСТ
                    </button>
                  </div>
                </div>

                <div className="pt-1">
                  <label className="flex items-center gap-2.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={pdfPageNumbers}
                      onChange={(e) => setPdfPageNumbers(e.target.checked)}
                      className="rounded border-[var(--border-default)] text-[var(--accent)] focus:ring-0"
                    />
                    <span className="text-xs text-[var(--text-primary)]">{t('export.pageNumbers')}</span>
                  </label>
                </div>
              </>
            )}

            {/* Настройки DOCX */}
            {format === 'docx' && (
              <div className="space-y-3">
                <label className="block text-[11px] font-semibold text-[var(--text-dim)] uppercase tracking-wider">
                  {t('export.preset')}
                </label>

                {/* Вариант: Стандартный */}
                <div
                  onClick={() => setDocxPreset('standard')}
                  className={`p-3 rounded-xl border cursor-pointer transition-all ${
                    docxPreset === 'standard'
                      ? 'border-[var(--accent)] bg-[var(--accent)]/10 shadow-xs'
                      : 'border-[var(--border-default)] bg-[var(--bg-base)] hover:border-[var(--border-strong)]'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-xs flex items-center gap-1.5">
                      <Sparkles size={14} className="text-[var(--accent)]" />
                      {t('export.presetStandard')}
                    </span>
                    {docxPreset === 'standard' && <Check size={14} className="text-[var(--accent)]" />}
                  </div>
                  <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
                    {t('export.presetStandardDesc')}
                  </p>
                </div>

                {/* Вариант: ГОСТ (НИР) */}
                <div
                  onClick={() => setDocxPreset('gost')}
                  className={`p-3 rounded-xl border cursor-pointer transition-all ${
                    docxPreset === 'gost'
                      ? 'border-[var(--accent)] bg-[var(--accent)]/10 shadow-xs'
                      : 'border-[var(--border-default)] bg-[var(--bg-base)] hover:border-[var(--border-strong)]'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-xs flex items-center gap-1.5">
                      <BookOpen size={14} className="text-[var(--accent)]" />
                      {t('export.presetGost')}
                    </span>
                    {docxPreset === 'gost' && <Check size={14} className="text-[var(--accent)]" />}
                  </div>
                  <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
                    {t('export.presetGostDesc')}
                  </p>
                </div>
              </div>
            )}

            {/* Настройки HTML */}
            {format === 'html' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-[11px] font-semibold text-[var(--text-dim)] uppercase tracking-wider mb-2">
                    {t('export.theme')}
                  </label>
                  <div className="grid grid-cols-2 gap-1.5 p-1 bg-[var(--bg-base)] border border-[var(--border-default)] rounded-lg">
                    <button
                      type="button"
                      onClick={() => setHtmlTheme('dark')}
                      className={`py-1 rounded text-xs font-medium transition-colors ${
                        htmlTheme === 'dark' ? 'bg-[var(--bg-active)] text-white shadow-xs' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                      }`}
                    >
                      {t('export.themeDark')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setHtmlTheme('light')}
                      className={`py-1 rounded text-xs font-medium transition-colors ${
                        htmlTheme === 'light' ? 'bg-[var(--bg-active)] text-white shadow-xs' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                      }`}
                    >
                      {t('export.themeLight')}
                    </button>
                  </div>
                </div>

                <div className="p-3 bg-[var(--bg-base)] border border-[var(--border-default)] rounded-xl text-[11px] text-[var(--text-secondary)] leading-relaxed">
                  {t('export.htmlNotice')}
                </div>
              </div>
            )}

            {/* Настройки TXT */}
            {format === 'txt' && (
              <div className="space-y-3">
                <label className="flex items-start gap-2.5 cursor-pointer select-none p-3 bg-[var(--bg-base)] border border-[var(--border-default)] rounded-xl">
                  <input
                    type="checkbox"
                    checked={stripMd}
                    onChange={(e) => setStripMd(e.target.checked)}
                    className="mt-0.5 rounded border-[var(--border-default)] text-[var(--accent)] focus:ring-0"
                  />
                  <div>
                    <span className="text-xs font-medium text-[var(--text-primary)] block">
                      {t('export.stripMarkdown')}
                    </span>
                    <span className="text-[11px] text-[var(--text-secondary)] block mt-0.5">
                      {t('export.stripMarkdownDesc')}
                    </span>
                  </div>
                </label>
              </div>
            )}

            {errorMessage && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg text-xs leading-relaxed">
                {errorMessage}
              </div>
            )}
          </div>

          {/* Правая колонка: Живой предпросмотр */}
          <div className="flex-1 flex flex-col bg-[var(--bg-base)] overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--border-default)] bg-[var(--bg-surface)] text-[11px] text-[var(--text-dim)]">
              <span>{t('export.preview')}</span>
              <span className="font-mono uppercase">{format}</span>
            </div>

            <div className="flex-1 overflow-auto p-4 flex items-center justify-center">
              {/* Для HTML и PDF рендерим iframe с готовым HTML */}
              {(format === 'html' || format === 'pdf') && (
                <iframe
                  title="Export Preview"
                  srcDoc={previewHtml}
                  className="w-full h-full border border-[var(--border-default)] rounded-lg shadow-xs bg-white"
                  sandbox="allow-same-origin allow-scripts"
                />
              )}

              {/* Для Word отображаем стилизованный блок документа */}
              {format === 'docx' && (
                <div
                  className="w-full h-full overflow-y-auto p-6 bg-white text-black rounded-lg border border-[var(--border-default)] shadow-xs"
                  style={{
                    fontFamily: docxPreset === 'gost' ? '"Times New Roman", serif' : 'Calibri, sans-serif',
                    fontSize: docxPreset === 'gost' ? '14pt' : '11pt',
                    lineHeight: docxPreset === 'gost' ? '1.5' : '1.15',
                    textAlign: docxPreset === 'gost' ? 'justify' : 'left',
                  }}
                >
                  <div className="max-w-xl mx-auto space-y-4">
                    <h1
                      style={{
                        fontSize: docxPreset === 'gost' ? '16pt' : '18pt',
                        fontWeight: 'bold',
                        textAlign: docxPreset === 'gost' ? 'center' : 'left',
                        color: docxPreset === 'gost' ? '#000000' : '#1F4E79',
                        marginBottom: '12pt',
                      }}
                    >
                      {defaultBaseName.replace(/\.md$/i, '')}
                    </h1>
                    <div className="whitespace-pre-wrap text-black/90">
                      {stripMarkdown(content).slice(0, 1500)}
                      {content.length > 1500 ? '\n\n[...]' : ''}
                    </div>
                  </div>
                </div>
              )}

              {/* Для TXT отображаем чистый текст */}
              {format === 'txt' && (
                <div className="w-full h-full p-4 bg-[var(--bg-surface)] rounded-lg border border-[var(--border-default)] overflow-auto">
                  <pre className="font-mono text-xs whitespace-pre-wrap text-[var(--text-primary)] leading-relaxed">
                    {previewTxt || (
                      <span className="text-[var(--text-dim)] italic">
                        {state.language === 'ru' ? 'Документ пуст' : 'Document is empty'}
                      </span>
                    )}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Подвал */}
        <div className="flex items-center justify-end gap-2.5 px-6 py-3.5 border-t border-[var(--border-default)] bg-[var(--bg-surface)]">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-active)] transition-colors"
          >
            {t('export.cancel')}
          </button>
          <button
            type="button"
            disabled={isExporting}
            onClick={handleExport}
            className="flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-semibold bg-[var(--accent)] hover:brightness-110 text-white shadow-xs transition-all disabled:opacity-50"
          >
            <Download size={14} />
            <span>{isExporting ? '...' : t('export.btn')}</span>
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
