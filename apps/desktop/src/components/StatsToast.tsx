/**
 * StatsToast.tsx — Плавающая плашка статистики текста.
 * Компактный режим: счётчик символов в правом нижнем углу.
 * При наведении: полная статистика + кнопка задать ограничение.
 * Стилизация: единый дизайн с dropdown-меню (MenuBar) + кастомный селект.
 */
import { useState, useMemo, useRef, useEffect } from 'react'
import { useEditor } from '../context/EditorContext'
import type { LimitType } from '../types'

export function StatsToast() {
  const { state, setWordLimit } = useEditor()
  const { tabs, activeTabId, wordLimit } = state
  const activeTab = activeTabId ? tabs.find((t) => t.id === activeTabId) : null
  const [isExpanded, setIsExpanded] = useState(false)
  const [showLimitInput, setShowLimitInput] = useState(false)
  const [limitInputValue, setLimitInputValue] = useState('')
  const [limitInputType, setLimitInputType] = useState<LimitType>('chars')
  const [isSelectOpen, setIsSelectOpen] = useState(false)

  const inputRef = useRef<HTMLInputElement>(null)
  const selectRef = useRef<HTMLDivElement>(null)

  // Вычисление статистики
  const stats = useMemo(() => {
    const content = activeTab?.content || ''
    const text = content.trim()
    const chars = text.length
    const words = text ? text.split(/\s+/).filter(Boolean).length : 0
    const sentences = text ? (text.match(/[.!?]+(?:\s|$)/g) || []).length : 0
    const paragraphs = text ? text.split(/\n\s*\n/).filter(p => p.trim().length > 0).length : 0
    const readingMinutes = Math.max(1, Math.ceil(words / 250))
    return { chars, words, sentences, paragraphs, readingMinutes }
  }, [activeTab?.content])

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

  const compactText = wordLimit.enabled
    ? `${currentValue.toLocaleString('ru-RU')} / ${wordLimit.value.toLocaleString('ru-RU')} ${wordLimit.type === 'chars' ? 'симв.' : 'сл.'}`
    : `${stats.chars.toLocaleString('ru-RU')} симв.`

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

  return (
    <div
      className="absolute bottom-6 right-8 z-30"
      onMouseEnter={() => setIsExpanded(true)}
      onMouseLeave={() => {
        setIsExpanded(false)
        setShowLimitInput(false)
        setLimitInputValue('')
        setIsSelectOpen(false)
      }}
    >
      <div
        className={`bg-[var(--bg-elevated)] border border-[var(--border-strong)] rounded-md shadow-lg transition-all duration-200 overflow-visible ${isExpanded ? 'py-1' : ''}`}
        style={{ minWidth: isExpanded ? '240px' : 'auto' }}
      >
        {/* Компактный вид / Заголовок раскрытого вида */}
        <div
          className="text-center whitespace-nowrap cursor-default select-none transition-all duration-200 px-5 text-[13px]"
          style={{ color: wordLimit.enabled ? limitColor : 'var(--text-muted)', padding: '12px' }}
        >
          {compactText}
        </div>

        {/* Раскрытый вид */}
        {isExpanded && (
          <>
            <div className="border-t border-[var(--border-strong)] my-1" />

            {/* Подробная статистика */}
            <div className="menu-item" style={{ cursor: 'default' }}>
              <span className="text-[var(--text-dim)]">Символы</span>
              <span className="text-[var(--text-secondary)] tabular-nums">{stats.chars.toLocaleString('ru-RU')}</span>
            </div>
            <div className="menu-item" style={{ cursor: 'default' }}>
              <span className="text-[var(--text-dim)]">Слова</span>
              <span className="text-[var(--text-secondary)] tabular-nums">{stats.words.toLocaleString('ru-RU')}</span>
            </div>
            <div className="menu-item" style={{ cursor: 'default' }}>
              <span className="text-[var(--text-dim)]">Предложения</span>
              <span className="text-[var(--text-secondary)] tabular-nums">{stats.sentences.toLocaleString('ru-RU')}</span>
            </div>
            <div className="menu-item" style={{ cursor: 'default' }}>
              <span className="text-[var(--text-dim)]">Абзацы</span>
              <span className="text-[var(--text-secondary)] tabular-nums">{stats.paragraphs.toLocaleString('ru-RU')}</span>
            </div>
            <div className="menu-item" style={{ cursor: 'default' }}>
              <span className="text-[var(--text-dim)]">Чтение</span>
              <span className="text-[var(--text-secondary)]">
                {stats.readingMinutes === 1 ? '~1 мин' : `~${stats.readingMinutes} мин`}
              </span>
            </div>

            <div className="border-t border-[var(--border-strong)] my-1" />

            {/* Ограничение */}
            {!showLimitInput ? (
              wordLimit.enabled ? (
                <div className="menu-item" style={{ cursor: 'default' }}>
                  <span className="text-[var(--text-dim)]">
                    Лимит: {wordLimit.value.toLocaleString('ru-RU')} {wordLimit.type === 'chars' ? 'симв.' : 'сл.'}
                  </span>
                  <span
                    className="text-[var(--accent)] cursor-pointer hover:underline"
                    onClick={handleRemoveLimit}
                  >
                    Убрать
                  </span>
                </div>
              ) : (
                <div className="menu-item enabled" onClick={() => setShowLimitInput(true)}>
                  <span className="text-[var(--accent)]">Задать ограничение</span>
                </div>
              )
            ) : (
              /* Строка ввода лимита */
              <div className="flex items-center gap-2 px-5 py-2" style={{ padding: '12px' }}>
                {/* Поле числа */}
                <input
                  ref={inputRef}
                  type="number"
                  min="1"
                  placeholder=""
                  value={limitInputValue}
                  onChange={(e) => setLimitInputValue(e.target.value)}
                  onKeyDown={handleLimitKeyDown}
                  className="w-[70px] px-2 text-[12px] rounded bg-[var(--bg-input)] border border-[var(--border-strong)] text-[var(--text-primary)] outline-none focus:border-[var(--accent)] transition-colors"
                  style={{ padding: '5px' }}
                />

                {/* Кастомный Dropdown единиц (открывается ВВЕРХ) */}
                <div className="relative flex-1" ref={selectRef}>
                  <div
                    onClick={() => setIsSelectOpen(!isSelectOpen)}
                    className="flex items-center justify-between w-full text-[13px] rounded bg-[var(--bg-input)] border border-[var(--border-strong)] text-[var(--text-primary)] outline-none cursor-pointer transition-colors"
                    style={{
                      padding: '6px 8px',
                      borderColor: isSelectOpen ? 'var(--accent)' : 'var(--border-strong)'
                    }}
                  >
                    <span className="select-none">{limitInputType === 'chars' ? 'симв.' : 'слов'}</span>
                    <div className="text-[var(--text-dim)] ml-1 pointer-events-none">
                      <svg width="8" height="5" viewBox="0 0 8 5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M1 1l3 3 3-3" />
                      </svg>
                    </div>
                  </div>

                  {/* Выпадающее (наверх) меню */}
                  {isSelectOpen && (
                    <div className="absolute bottom-[calc(100%+4px)] left-0 w-full bg-[var(--bg-input)] border border-[var(--border-strong)] rounded shadow-lg overflow-hidden z-40">
                      <div
                        className={`px-3 py-2 text-[13px] cursor-pointer hover:bg-[var(--menu-hover-bg)] ${limitInputType === 'chars' ? 'text-[var(--accent)] bg-[var(--menu-hover-bg)]' : 'text-[var(--text-primary)]'}`}
                        onClick={() => {
                          setLimitInputType('chars')
                          setIsSelectOpen(false)
                        }}
                        style={{ padding: '5px' }}
                      >
                        симв.
                      </div>
                      <div
                        className={`px-3 py-2 text-[13px] cursor-pointer hover:bg-[var(--menu-hover-bg)] ${limitInputType === 'words' ? 'text-[var(--accent)] bg-[var(--menu-hover-bg)]' : 'text-[var(--text-primary)]'}`}
                        onClick={() => {
                          setLimitInputType('words')
                          setIsSelectOpen(false)
                        }}
                        style={{ padding: '5px' }}
                      >
                        слов
                      </div>
                    </div>
                  )}
                </div>

                {/* Кнопка ОК */}
                <button
                  onClick={handleSetLimit}
                  className="text-[13px] font-medium rounded bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)] transition-colors active:opacity-80"
                  style={{ padding: '6px 12px' }}
                >
                  ОК
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
