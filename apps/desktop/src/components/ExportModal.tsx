import { useState, useMemo, useRef, useEffect } from 'react'
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

  const overlayMouseDownRef = useRef(false)

  // Закрытие по клавише Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const handleOverlayMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    overlayMouseDownRef.current = e.target === e.currentTarget
  }

  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget && overlayMouseDownRef.current) {
      onClose()
    }
    overlayMouseDownRef.current = false
  }

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

  const formats: { id: ExportFormat; label: string; ext: string; icon: typeof FileText }[] = [
    { id: 'pdf', label: 'PDF', ext: '.pdf', icon: FileText },
    { id: 'docx', label: 'Word', ext: '.docx', icon: FileSpreadsheet },
    { id: 'html', label: 'HTML', ext: '.html', icon: Code2 },
    { id: 'txt', label: t('export.format') === 'Формат' ? 'Текст' : 'Text', ext: '.txt', icon: AlignLeft },
  ]

  return createPortal(
    <div
      className="modal-overlay animate-in fade-in duration-150 ease-out"
      onMouseDown={handleOverlayMouseDown}
      onClick={handleOverlayClick}
    >
      <div
        className="modal-panel animate-in zoom-in-95 duration-150 ease-out"
        style={{
          width: '100%',
          maxWidth: '920px',
          height: '620px',
          maxHeight: '92vh',
          padding: 0,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          color: 'var(--text-primary)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Шапка */}
        <div
          className="flex items-center justify-between border-b border-[var(--border-default)] select-none shrink-0"
          style={{ padding: '16px 20px' }}
        >
          <div className="flex items-center" style={{ gap: '12px' }}>
            <div
              className="w-8 h-8 rounded-lg bg-[var(--accent)]/10 text-[var(--accent)] flex items-center justify-center shrink-0 border border-[var(--accent)]/20"
            >
              <Download size={18} />
            </div>
            <div>
              <h2 className="text-[14px] font-semibold text-[var(--text-primary)] leading-tight">{t('export.title')}</h2>
              <p className="text-[11.5px] text-[var(--text-dim)] truncate" style={{ maxWidth: '420px', marginTop: '2px' }}>{defaultBaseName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors cursor-pointer"
            title={t('common.close') || 'Close'}
          >
            <X size={16} />
          </button>
        </div>

        {/* Форматы (вкладки) */}
        <div
          className="flex items-center border-b border-[var(--border-default)] bg-[var(--bg-surface)] select-none shrink-0"
          style={{ padding: '8px 20px', gap: '8px' }}
        >
          {formats.map((f) => {
            const Icon = f.icon
            const active = format === f.id
            return (
              <button
                key={f.id}
                onClick={() => setFormat(f.id)}
                className={`flex items-center rounded-lg text-[12px] font-medium transition-all cursor-pointer ${
                  active
                    ? 'bg-[var(--accent)] text-white shadow-xs'
                    : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]'
                }`}
                style={{ padding: '6px 14px', gap: '8px' }}
              >
                <Icon size={14} />
                <span>{f.label}</span>
                <span className="text-[10px] opacity-75 font-mono">{f.ext}</span>
              </button>
            )
          })}
        </div>

        {/* Тело модального окна: Настройки (слева) + Предпросмотр (справа) */}
        <div className="flex flex-1 overflow-hidden">
          {/* Левая колонка: Настройки выбранного формата */}
          <div
            className="shrink-0 border-r border-[var(--border-default)] overflow-y-auto text-xs"
            style={{ width: '320px', padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '16px' }}
          >
            {/* Настройки PDF */}
            {format === 'pdf' && (
              <>
                <div>
                  <label
                    className="block text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider"
                    style={{ marginBottom: '8px' }}
                  >
                    {t('export.pageSize')}
                  </label>
                  <div
                    className="grid grid-cols-2 rounded-lg bg-[var(--bg-base)] border border-[var(--border-default)]"
                    style={{ padding: '3px', gap: '4px' }}
                  >
                    {(['A4', 'Letter'] as const).map((sz) => (
                      <button
                        key={sz}
                        type="button"
                        onClick={() => setPdfPageSize(sz)}
                        className={`rounded-md text-[12px] font-medium transition-colors cursor-pointer text-center ${
                          pdfPageSize === sz
                            ? 'bg-[var(--bg-active)] text-white shadow-xs'
                            : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]'
                        }`}
                        style={{ padding: '6px 10px' }}
                      >
                        {sz}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label
                    className="block text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider"
                    style={{ marginBottom: '8px' }}
                  >
                    {t('export.orientation')}
                  </label>
                  <div
                    className="grid grid-cols-2 rounded-lg bg-[var(--bg-base)] border border-[var(--border-default)]"
                    style={{ padding: '3px', gap: '4px' }}
                  >
                    <button
                      type="button"
                      onClick={() => setPdfLandscape(false)}
                      className={`rounded-md text-[12px] font-medium transition-colors cursor-pointer text-center ${
                        !pdfLandscape
                          ? 'bg-[var(--bg-active)] text-white shadow-xs'
                          : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]'
                      }`}
                      style={{ padding: '6px 10px' }}
                    >
                      {t('export.portrait')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setPdfLandscape(true)}
                      className={`rounded-md text-[12px] font-medium transition-colors cursor-pointer text-center ${
                        pdfLandscape
                          ? 'bg-[var(--bg-active)] text-white shadow-xs'
                          : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]'
                      }`}
                      style={{ padding: '6px 10px' }}
                    >
                      {t('export.landscape')}
                    </button>
                  </div>
                </div>

                <div>
                  <label
                    className="block text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider"
                    style={{ marginBottom: '8px' }}
                  >
                    {t('export.theme')}
                  </label>
                  <div
                    className="grid grid-cols-3 rounded-lg bg-[var(--bg-base)] border border-[var(--border-default)]"
                    style={{ padding: '3px', gap: '4px' }}
                  >
                    <button
                      type="button"
                      onClick={() => setPdfPreset('light')}
                      className={`rounded-md text-[12px] font-medium transition-colors cursor-pointer text-center ${
                        pdfPreset === 'light'
                          ? 'bg-[var(--bg-active)] text-white shadow-xs'
                          : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]'
                      }`}
                      style={{ padding: '6px 4px' }}
                    >
                      {t('export.themeLight')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setPdfPreset('dark')}
                      className={`rounded-md text-[12px] font-medium transition-colors cursor-pointer text-center ${
                        pdfPreset === 'dark'
                          ? 'bg-[var(--bg-active)] text-white shadow-xs'
                          : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]'
                      }`}
                      style={{ padding: '6px 4px' }}
                    >
                      {t('export.themeDark')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setPdfPreset('gost')}
                      className={`rounded-md text-[12px] font-medium transition-colors cursor-pointer text-center ${
                        pdfPreset === 'gost'
                          ? 'bg-[var(--bg-active)] text-white shadow-xs'
                          : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]'
                      }`}
                      style={{ padding: '6px 4px' }}
                    >
                      ГОСТ
                    </button>
                  </div>
                </div>

                <div
                  className="rounded-xl bg-[var(--bg-surface)] border border-[var(--border-default)]"
                  style={{ padding: '10px 14px' }}
                >
                  <label className="flex items-center gap-2.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={pdfPageNumbers}
                      onChange={(e) => setPdfPageNumbers(e.target.checked)}
                      className="rounded border-[var(--border-default)] text-[var(--accent)] focus:ring-0 cursor-pointer"
                    />
                    <span className="text-[12px] text-[var(--text-primary)] font-medium">{t('export.pageNumbers')}</span>
                  </label>
                </div>
              </>
            )}

            {/* Настройки DOCX */}
            {format === 'docx' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <label className="block text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                  {t('export.preset')}
                </label>

                {/* Вариант: Стандартный */}
                <div
                  onClick={() => setDocxPreset('standard')}
                  className={`rounded-xl border cursor-pointer transition-all ${
                    docxPreset === 'standard'
                      ? 'border-[var(--accent)] bg-[var(--accent)]/10 shadow-xs'
                      : 'border-[var(--border-default)] bg-[var(--bg-base)] hover:border-[var(--border-strong)]'
                  }`}
                  style={{ padding: '12px 14px' }}
                >
                  <div className="flex items-center justify-between" style={{ marginBottom: '4px' }}>
                    <span className="font-semibold text-[12px] flex items-center gap-1.5 text-[var(--text-primary)]">
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
                  className={`rounded-xl border cursor-pointer transition-all ${
                    docxPreset === 'gost'
                      ? 'border-[var(--accent)] bg-[var(--accent)]/10 shadow-xs'
                      : 'border-[var(--border-default)] bg-[var(--bg-base)] hover:border-[var(--border-strong)]'
                  }`}
                  style={{ padding: '12px 14px' }}
                >
                  <div className="flex items-center justify-between" style={{ marginBottom: '4px' }}>
                    <span className="font-semibold text-[12px] flex items-center gap-1.5 text-[var(--text-primary)]">
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
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <label
                    className="block text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider"
                    style={{ marginBottom: '8px' }}
                  >
                    {t('export.theme')}
                  </label>
                  <div
                    className="grid grid-cols-2 rounded-lg bg-[var(--bg-base)] border border-[var(--border-default)]"
                    style={{ padding: '3px', gap: '4px' }}
                  >
                    <button
                      type="button"
                      onClick={() => setHtmlTheme('dark')}
                      className={`rounded-md text-[12px] font-medium transition-colors cursor-pointer text-center ${
                        htmlTheme === 'dark'
                          ? 'bg-[var(--bg-active)] text-white shadow-xs'
                          : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]'
                      }`}
                      style={{ padding: '6px 10px' }}
                    >
                      {t('export.themeDark')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setHtmlTheme('light')}
                      className={`rounded-md text-[12px] font-medium transition-colors cursor-pointer text-center ${
                        htmlTheme === 'light'
                          ? 'bg-[var(--bg-active)] text-white shadow-xs'
                          : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]'
                      }`}
                      style={{ padding: '6px 10px' }}
                    >
                      {t('export.themeLight')}
                    </button>
                  </div>
                </div>

                <div
                  className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-xl text-[11.5px] text-[var(--text-secondary)] leading-relaxed"
                  style={{ padding: '12px 14px' }}
                >
                  {t('export.htmlNotice')}
                </div>
              </div>
            )}

            {/* Настройки TXT */}
            {format === 'txt' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <label
                  className="flex items-start gap-3 cursor-pointer select-none bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-xl hover:border-[var(--border-strong)] transition-colors"
                  style={{ padding: '12px 14px' }}
                >
                  <input
                    type="checkbox"
                    checked={stripMd}
                    onChange={(e) => setStripMd(e.target.checked)}
                    className="mt-0.5 rounded border-[var(--border-default)] text-[var(--accent)] focus:ring-0 cursor-pointer"
                  />
                  <div>
                    <span className="text-[12px] font-medium text-[var(--text-primary)] block">
                      {t('export.stripMarkdown')}
                    </span>
                    <span className="text-[11px] text-[var(--text-secondary)] block mt-0.5 leading-relaxed">
                      {t('export.stripMarkdownDesc')}
                    </span>
                  </div>
                </label>
              </div>
            )}

            {errorMessage && (
              <div
                className="bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg text-xs leading-relaxed"
                style={{ padding: '10px 14px' }}
              >
                {errorMessage}
              </div>
            )}
          </div>

          {/* Правая колонка: Живой предпросмотр */}
          <div className="flex-1 flex flex-col bg-[var(--bg-base)] overflow-hidden">
            <div
              className="flex items-center justify-between border-b border-[var(--border-default)] bg-[var(--bg-surface)] text-[11px] text-[var(--text-dim)] select-none shrink-0"
              style={{ padding: '8px 16px' }}
            >
              <span>{t('export.preview')}</span>
              <span className="font-mono uppercase font-semibold text-[var(--accent)]">{format}</span>
            </div>

            <div
              className="flex-1 overflow-auto flex items-center justify-center"
              style={{ padding: '16px' }}
            >
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
                  className="w-full h-full overflow-y-auto bg-white text-black rounded-lg border border-[var(--border-default)] shadow-xs"
                  style={{
                    padding: '24px',
                    fontFamily: docxPreset === 'gost' ? '"Times New Roman", serif' : 'Calibri, sans-serif',
                    fontSize: docxPreset === 'gost' ? '14pt' : '11pt',
                    lineHeight: docxPreset === 'gost' ? '1.5' : '1.15',
                    textAlign: docxPreset === 'gost' ? 'justify' : 'left',
                  }}
                >
                  <div className="max-w-xl mx-auto" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
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
                <div
                  className="w-full h-full bg-[var(--bg-surface)] rounded-lg border border-[var(--border-default)] overflow-auto"
                  style={{ padding: '16px' }}
                >
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
        <div
          className="flex items-center justify-end border-t border-[var(--border-default)] bg-[var(--bg-surface)] select-none shrink-0"
          style={{ padding: '14px 20px', gap: '10px' }}
        >
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl text-[12.5px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors cursor-pointer"
            style={{ padding: '8px 16px' }}
          >
            {t('export.cancel')}
          </button>
          <button
            type="button"
            disabled={isExporting}
            onClick={handleExport}
            className="flex items-center rounded-xl text-[12.5px] font-semibold bg-[var(--accent)] hover:brightness-110 text-white shadow-xs transition-all disabled:opacity-50 cursor-pointer"
            style={{ padding: '8px 20px', gap: '8px' }}
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
