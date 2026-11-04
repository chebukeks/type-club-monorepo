/**
 * StatsToast.tsx — Плавающая плашка статистики текста.
 * Поддерживает 2 режима расположения:
 * 1) 'right': Справа от документа, ширина совпадает с оглавлением над ним, не сжимается меньше 180px.
 * 2) 'sidebar': Внизу сайдбара с отступами 12px, при раскрытии расширяется вправо.
 */
import { useState, useMemo, useRef, useEffect } from 'react'
import { useEditor } from '../context/EditorContext'
import type { LimitType } from '../types'

interface StatsToastProps {
  mode?: 'right' | 'sidebar'
  sidebarWidth?: number
  containerWidth?: number
}

export function StatsToast({ mode = 'right', sidebarWidth = 240, containerWidth }: StatsToastProps) {
  const { state, setWordLimit, t } = useEditor()
  const { tabs, activeTabId, wordLimit } = state
  const activeTab = activeTabId ? tabs.find((t) => t.id === activeTabId) : null
  const [isExpanded, setIsExpanded] = useState(false)
  const [showLimitInput, setShowLimitInput] = useState(false)
  const [limitInputValue, setLimitInputValue] = useState('')
  const [limitInputType, setLimitInputType] = useState<LimitType>('chars')
  const [isSelectOpen, setIsSelectOpen] = useState(false)
  const [rightPaneWidth, setRightPaneWidth] = useState(containerWidth || 1200)
  const [selectedText, setSelectedText] = useState('')
  const [showFullDocWhenSelected, setShowFullDocWhenSelected] = useState(false)

  const inputRef = useRef<HTMLInputElement>(null)
  const selectRef = useRef<HTMLDivElement>(null)
  const toastRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (containerWidth) {
      setRightPaneWidth(containerWidth)
    }
  }, [containerWidth])

  // Измерение ширины правой панели для режима 'right'
  useEffect(() => {
    const parent = toastRef.current?.parentElement
    if (!parent) return
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setRightPaneWidth(entry.contentRect.width)
      }
    })
    ro.observe(parent)
    return () => ro.disconnect()
  }, [])

  // Отслеживание выделения текста в редакторе
  useEffect(() => {
    const handleSelectionChange = (e: Event) => {
      const detail = (e as CustomEvent).detail
      setSelectedText(detail?.selectedText || '')
      setShowFullDocWhenSelected(false)
    }
    const handleDomSelection = () => {
      const sel = window.getSelection()
      const text = sel ? sel.toString().trim() : ''
      if (!text) {
        setSelectedText('')
      }
    }
    window.addEventListener('editor-selection-change', handleSelectionChange)
    document.addEventListener('selectionchange', handleDomSelection)
    return () => {
      window.removeEventListener('editor-selection-change', handleSelectionChange)
      document.removeEventListener('selectionchange', handleDomSelection)
    }
  }, [])

  const isSelectionActive = Boolean(selectedText && selectedText.trim().length > 0)

  // Вычисление статистики: если выделен текст, рассчитывается только по нему
  const stats = useMemo(() => {
    const raw = (isSelectionActive && !showFullDocWhenSelected) ? selectedText : (activeTab?.content || '')
    const text = raw.trim()
    const chars = text.length
    const words = text ? text.split(/\s+/).filter(Boolean).length : 0
    const sentences = text ? (text.match(/[.!?]+(?:\s|$)/g) || []).length : 0
    const paragraphs = text ? text.split(/\n\s*\n/).filter(p => p.trim().length > 0).length : 0
    const readingMinutes = Math.max(1, Math.ceil(words / 250))
    return { chars, words, sentences, paragraphs, readingMinutes }
  }, [isSelectionActive, showFullDocWhenSelected, selectedText, activeTab?.content])

  const currentValue = wordLimit.type === 'chars' ? stats.chars : stats.words
  const isOverLimit = wordLimit.enabled && currentValue > wordLimit.value
  const limitRatio = wordLimit.enabled ? currentValue / wordLimit.value : 0

  useEffect(() => {
    if (showLimitInput && inputRef.current) {
      inputRef.current.focus()
    }
  }, [showLimitInput])

  // Закрытие дропдауна по клику вне
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (selectRef.current && !selectRef.current.contains(e.target as Node)) {
        setIsSelectOpen(false)
      }
    }
    if (isSelectOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isSelectOpen])

  if (!activeTab) return null

  const numLocale = state.language === 'ru' ? 'ru-RU' : 'en-US'
  const selectionSuffix = isSelectionActive
    ? showFullDocWhenSelected
      ? ` (${t('stats.entireDocument') || 'весь документ'})`
      : ` (${t('stats.selected') || 'выделено'})`
    : ''
  const compactText = (wordLimit.enabled
    ? `${currentValue.toLocaleString(numLocale)} / ${wordLimit.value.toLocaleString(numLocale)} ${wordLimit.type === 'chars' ? t('stats.charsShort') : t('stats.wordsShort')}`
    : `${stats.chars.toLocaleString(numLocale)} ${t('stats.charsShort')}`) + selectionSuffix

  const limitColor = isOverLimit
    ? '#ec404eff'
    : limitRatio > 0.95
      ? '#dbb02fff'
      : 'var(--text-muted)'

  const handleSetLimit = () => {
    const num = parseInt(limitInputValue, 10)
    if (num > 0) {
      setWordLimit({ enabled: true, value: num, type: limitInputType })
      setShowLimitInput(false)
      setLimitInputValue('')
    }
  }

  const handleRemoveLimit = () => {
    setWordLimit({ enabled: false, value: wordLimit.value, type: wordLimit.type })
  }

  const handleLimitKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSetLimit()
    if (e.key === 'Escape') { setShowLimitInput(false); setLimitInputValue('') }
  }

  // Расчёт геометрии для режима 'right'
  const docScale = (state.documentZoom || 100) / 100
  const docHalfWidth = 430 * docScale
  const leftPos = rightPaneWidth / 2 + docHalfWidth + 16
  const rightPos = 32
  const availableWidth = rightPaneWidth - rightPos - leftPos
  const targetWidth = Math.min(280, Math.max(180, availableWidth))

  const isSidebar = mode === 'sidebar'
  const isConstrained = availableWidth < 180

  const sbWidth = sidebarWidth || 240
  const collapsedSidebarWidth = sbWidth - 24
  const expandedSidebarWidth = Math.max(240, collapsedSidebarWidth)

  const collapsedRightWidth = isConstrained ? 180 : targetWidth
  const expandedRightWidth = Math.max(240, collapsedRightWidth)

  const outerStyle: React.CSSProperties = isSidebar
    ? {
        position: 'absolute',
        bottom: '24px',
        left: '12px',
        width: isExpanded ? 'max-content' : `${collapsedSidebarWidth}px`,
        minWidth: isExpanded ? `${expandedSidebarWidth}px` : 'auto',
        maxWidth: isExpanded ? '360px' : `${collapsedSidebarWidth}px`,
        zIndex: isExpanded ? 50 : 40,
      }
    : {
        position: 'absolute',
        bottom: '24px',
        right: '32px',
        width: isExpanded ? 'max-content' : `${collapsedRightWidth}px`,
        minWidth: isExpanded ? `${expandedRightWidth}px` : `${collapsedRightWidth}px`,
        maxWidth: '360px',
        zIndex: isExpanded ? 50 : 30,
      }

  return (
    <div
      ref={toastRef}
      style={outerStyle}
      onMouseEnter={() => setIsExpanded(true)}
      onMouseLeave={() => {
        setIsExpanded(false)
        setShowLimitInput(false)
        setLimitInputValue('')
        setIsSelectOpen(false)
      }}
    >
      <div
        className={`bg-[var(--bg-surface)] backdrop-blur-xl border border-[var(--border-default)] rounded-xl shadow-xl transition-all duration-200 ease-out overflow-hidden ${isExpanded ? 'py-1' : ''}`}
        style={{ width: '100%' }}
      >
        {/* Компактный вид / Заголовок раскрытого вида */}
        <div
          className="text-center whitespace-nowrap cursor-default select-none transition-all duration-200 text-[13px] truncate"
          style={{ color: wordLimit.enabled ? limitColor : 'var(--text-muted)', padding: '12px' }}
        >
          {compactText}
        </div>

        {/* Раскрытый вид с плавным открытием/закрытием */}
        <div className={`grid transition-all duration-200 ease-out ${isExpanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
          <div className="overflow-hidden">
            <div className="border-t border-[var(--border-default)] my-1.5 mx-2 opacity-80" />

            {isSelectionActive && (
              <div
                className="menu-item select-none"
                style={{ padding: '6px 12px', cursor: 'default' }}
              >
                <span
                  className="flex items-center gap-1.5 text-[11px] font-medium"
                  style={{ color: !showFullDocWhenSelected ? 'var(--accent)' : 'var(--text-dim)' }}
                >
                  <span
                    className="inline-block w-1.5 h-1.5 rounded-full"
                    style={{ backgroundColor: !showFullDocWhenSelected ? 'var(--accent)' : 'var(--border-strong)' }}
                  />
                  <span>
                    {!showFullDocWhenSelected
                      ? (t('stats.selectedFragment') || 'Выделенный фрагмент')
                      : (t('stats.entireDocument') || 'Весь документ')}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    setShowFullDocWhenSelected(!showFullDocWhenSelected)
                  }}
                  className="text-[11px] font-medium text-[var(--accent)] hover:text-[var(--accent-hover)] transition-colors cursor-pointer"
                  style={{ background: 'transparent', border: 'none', padding: 0 }}
                >
                  {!showFullDocWhenSelected
                    ? (t('stats.showAll') || 'Весь текст')
                    : (t('stats.showSelected') || 'Только выделенное')}
                </button>
              </div>
            )}

            {/* Подробная статистика */}
            <div className="menu-item" style={{ padding: '6px 12px', cursor: 'default' }}>
              <span className="text-[var(--text-dim)]">{t('stats.chars')}</span>
              <span className="text-[var(--text-secondary)] tabular-nums">{stats.chars.toLocaleString(numLocale)}</span>
            </div>
            <div className="menu-item" style={{ padding: '6px 12px', cursor: 'default' }}>
              <span className="text-[var(--text-dim)]">{t('stats.words')}</span>
              <span className="text-[var(--text-secondary)] tabular-nums">{stats.words.toLocaleString(numLocale)}</span>
            </div>
            <div className="menu-item" style={{ padding: '6px 12px', cursor: 'default' }}>
              <span className="text-[var(--text-dim)]">{t('stats.sentences')}</span>
              <span className="text-[var(--text-secondary)] tabular-nums">{stats.sentences.toLocaleString(numLocale)}</span>
            </div>
            <div className="menu-item" style={{ padding: '6px 12px', cursor: 'default' }}>
              <span className="text-[var(--text-dim)]">{t('stats.paragraphs')}</span>
              <span className="text-[var(--text-secondary)] tabular-nums">{stats.paragraphs.toLocaleString(numLocale)}</span>
            </div>
            <div className="menu-item" style={{ padding: '6px 12px', cursor: 'default' }}>
              <span className="text-[var(--text-dim)]">{t('stats.reading')}</span>
              <span className="text-[var(--text-secondary)]">
                {t('stats.readingMinutes', { count: stats.readingMinutes })}
              </span>
            </div>

            <div className="border-t border-[var(--border-default)] my-1.5 mx-2 opacity-80" />

            {/* Ограничение */}
            {!showLimitInput ? (
              wordLimit.enabled ? (
                <div className="menu-item" style={{ padding: '6px 12px', cursor: 'default' }}>
                  <span className="text-[var(--text-dim)]">
                    {t('stats.limit')}: {wordLimit.value.toLocaleString(numLocale)} {wordLimit.type === 'chars' ? t('stats.charsShort') : t('stats.wordsShort')}
                  </span>
                  <span
                    className="text-[var(--accent)] cursor-pointer hover:underline"
                    onClick={handleRemoveLimit}
                  >
                    {t('stats.removeLimit')}
                  </span>
                </div>
              ) : (
                <div className="menu-item enabled" style={{ padding: '6px 12px' }} onClick={() => setShowLimitInput(true)}>
                  <span className="text-[var(--accent)]">{t('stats.setLimit')}</span>
                </div>
              )
            ) : (
              /* Строка ввода лимита */
              <div className="flex items-center gap-2" style={{ padding: '6px 12px' }}>
                {/* Поле числа */}
                <input
                  ref={inputRef}
                  type="number"
                  min="1"
                  placeholder=""
                  value={limitInputValue}
                  onChange={(e) => setLimitInputValue(e.target.value)}
                  onKeyDown={handleLimitKeyDown}
                  className="w-[70px] text-[12px] rounded-lg bg-[var(--bg-input)] border border-[var(--border-strong)] text-[var(--text-primary)] outline-none focus:border-[var(--accent)] transition-colors"
                  style={{ padding: '4px 8px' }}
                />

                {/* Кастомный Dropdown единиц (открывается ВВЕРХ) */}
                <div className="relative flex-1" ref={selectRef}>
                  <div
                    onClick={() => setIsSelectOpen(!isSelectOpen)}
                    className="flex items-center justify-between w-full text-[13px] rounded-lg bg-[var(--bg-input)] border border-[var(--border-strong)] text-[var(--text-primary)] outline-none cursor-pointer transition-colors"
                    style={{
                      padding: '4px 8px',
                      borderColor: isSelectOpen ? 'var(--accent)' : 'var(--border-strong)'
                    }}
                  >
                    <span className="select-none">{limitInputType === 'chars' ? t('stats.charsShort') : t('stats.wordsShort')}</span>
                    <div className="text-[var(--text-dim)] ml-1 pointer-events-none">
                      <svg width="8" height="5" viewBox="0 0 8 5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M1 1l3 3 3-3" />
                      </svg>
                    </div>
                  </div>

                  {/* Выпадающее (наверх) меню */}
                  {isSelectOpen && (
                    <div className="absolute bottom-[calc(100%+4px)] left-0 w-full bg-[var(--bg-input)] border border-[var(--border-strong)] rounded-lg shadow-lg overflow-hidden z-40">
                      <div
                        className={`text-[13px] cursor-pointer hover:bg-[var(--menu-hover-bg)] ${limitInputType === 'chars' ? 'text-[var(--accent)] bg-[var(--menu-hover-bg)]' : 'text-[var(--text-primary)]'}`}
                        onClick={() => {
                          setLimitInputType('chars')
                          setIsSelectOpen(false)
                        }}
                        style={{ padding: '6px 8px' }}
                      >
                        {t('stats.charsShort')}
                      </div>
                      <div
                        className={`text-[13px] cursor-pointer hover:bg-[var(--menu-hover-bg)] ${limitInputType === 'words' ? 'text-[var(--accent)] bg-[var(--menu-hover-bg)]' : 'text-[var(--text-primary)]'}`}
                        onClick={() => {
                          setLimitInputType('words')
                          setIsSelectOpen(false)
                        }}
                        style={{ padding: '6px 8px' }}
                      >
                        {t('stats.wordsShort')}
                      </div>
                    </div>
                  )}
                </div>

                {/* Кнопка ОК */}
                <button
                  onClick={handleSetLimit}
                  className="text-[13px] font-medium rounded bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)] transition-colors active:opacity-80"
                  style={{ padding: '4px 12px' }}
                >
                  {t('stats.ok')}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
