/**
 * SettingsPopup.tsx — Всплывающее окно настроек.
 * Открывается по клику на шестерёнку в TitleBar.
 * Стилизация: единый дизайн с dropdown-меню (MenuBar).
 */
import { useState, useEffect, useRef } from 'react'
import { useEditor } from '../context/EditorContext'

interface SettingsPopupProps {
  onClose: () => void
}

export function SettingsPopup({ onClose }: SettingsPopupProps) {
  const { state, setAutosave, setShowStats, setTypewriterMode } = useEditor()
  const [spellcheck, setSpellcheckState] = useState(true)
  const popupRef = useRef<HTMLDivElement>(null)

  // Загрузить текущее состояние спеллчекера при открытии
  useEffect(() => {
    window.api.getSpellcheck().then(setSpellcheckState).catch(() => { })
  }, [])

  // Закрытие при клике вне
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    // Немного отложим, чтобы клик по шестерёнке не закрывал сразу
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside)
    }, 50)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [onClose])

  // --- Загрузка и управление настройками ---
  useEffect(() => {
    window.api.getSpellcheck().then(setSpellcheckState)
  }, [])

  const handleSpellcheckToggle = async () => {
    const val = !spellcheck
    setSpellcheckState(val)
    window.api.setSpellcheck(val)
  }

  const handleAutosaveToggle = () => {
    setAutosave(!state.autosave)
  }

  return (
    <div
      ref={popupRef}
      className="absolute right-0 top-full mt-1 w-max min-w-[240px] py-1 bg-[var(--bg-elevated)] border border-[var(--border-strong)] rounded-md shadow-lg z-50 text-[13px] text-[var(--text-secondary)] select-none"
    >
      {/* Заголовок */}
      <div className="menu-item enabled" style={{ cursor: 'default' }}>
        <span className="flex items-center gap-2 text-[var(--text-primary)] font-medium">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--text-muted)]">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
          Настройки
        </span>
      </div>

      <div className="border-t border-[var(--border-strong)] my-1" />

      {/* Автосохранение */}
      <div className="menu-item enabled" onClick={handleAutosaveToggle}>
        <span>Автосохранение</span>
        <ToggleSwitch enabled={state.autosave} />
      </div>

      {/* Проверка орфографии */}
      <div className="menu-item enabled" onClick={handleSpellcheckToggle}>
        <span>Проверка орфографии</span>
        <ToggleSwitch enabled={spellcheck} />
      </div>

      <div className="border-t border-[var(--border-strong)] my-1" />

      {/* Режим печатной машинки */}
      <div className="menu-item enabled" onClick={() => setTypewriterMode(!state.typewriterMode)}>
        <span>Режим печатной машинки</span>
        <ToggleSwitch enabled={state.typewriterMode} />
      </div>

      <div className="border-t border-[var(--border-strong)] my-1" />

      {/* Статистика */}
      <div className="menu-item enabled" onClick={() => setShowStats(!state.showStats)}>
        <span>Статистика</span>
        <ToggleSwitch enabled={state.showStats} />
      </div>
    </div>
  )
}

/** Мини-компонент toggle-переключателя.
 *  Использует постоянный border (прозрачный при вкл.) для стабильных размеров. */
function ToggleSwitch({ enabled }: { enabled: boolean }) {
  return (
    <div
      style={{
        position: 'relative',
        width: 40,
        height: 22,
        borderRadius: 11,
        backgroundColor: enabled ? 'var(--accent)' : 'var(--bg-input)',
        border: `1px solid ${enabled ? 'transparent' : 'var(--border-strong)'}`,
        transition: 'background-color 0.3s, border-color 0.3s',
        cursor: 'pointer',
        flexShrink: 0,
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          margin: 'auto 0',
          left: 2,
          width: 14,
          height: 14,
          borderRadius: '50%',
          backgroundColor: 'white',
          boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
          transition: 'transform 0.3s',
          transform: enabled ? 'translateX(18px)' : 'translateX(0)',
        }}
      />
    </div>
  )
}
