/**
 * TabBar.tsx — Панель вкладок открытых файлов.
 * Поддерживает Drag & Drop для изменения порядка (#35).
 */
import { useState, useRef } from 'react'
import { useEditor } from '../context/EditorContext'

export function TabBar() {
  const { state, dispatch, closeTab, t } = useEditor()
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [dropIndex, setDropIndex] = useState<number | null>(null)
  const dragNodeRef = useRef<HTMLDivElement | null>(null)

  if (state.tabs.length === 0) return null

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDragIndex(index)
    dragNodeRef.current = e.currentTarget as HTMLDivElement
    e.dataTransfer.effectAllowed = 'move'
    // Делаем перетаскиваемый элемент полупрозрачным
    requestAnimationFrame(() => {
      if (dragNodeRef.current) dragNodeRef.current.style.opacity = '0.4'
    })
  }

  const handleDragEnd = () => {
    if (dragNodeRef.current) dragNodeRef.current.style.opacity = '1'
    setDragIndex(null)
    setDropIndex(null)
    dragNodeRef.current = null
  }

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (dragIndex !== null && index !== dragIndex) {
      setDropIndex(index)
    }
  }

  const handleDrop = (e: React.DragEvent, index: number) => {
    e.preventDefault()
    if (dragIndex !== null && dragIndex !== index) {
      dispatch({ type: 'REORDER_TABS', payload: { fromIndex: dragIndex, toIndex: index } })
    }
    handleDragEnd()
  }

  return (
    <div className="flex items-center h-[36px] bg-[var(--bg-surface)] overflow-x-auto select-none" style={{ paddingLeft: '10px', paddingRight: '10px', gap: '6px' }}>
      {state.tabs.map((tab, index) => {
        const isActive = tab.id === state.activeTabId
        const isDropTarget = dropIndex === index && dragIndex !== null && dragIndex !== index

        return (
          <div
            key={tab.id}
            draggable
            onDragStart={(e) => handleDragStart(e, index)}
            onDragEnd={handleDragEnd}
            onDragOver={(e) => handleDragOver(e, index)}
            onDragEnter={(e) => { e.preventDefault(); setDropIndex(index) }}
            onDragLeave={() => { if (dropIndex === index) setDropIndex(null) }}
            onDrop={(e) => handleDrop(e, index)}
            onClick={() => dispatch({ type: 'SET_ACTIVE_TAB', payload: { tabId: tab.id } })}
            className={`group flex items-center cursor-pointer transition-all min-w-0 max-w-[220px] rounded-lg ${
              isActive
                ? 'bg-[var(--bg-base)] text-[var(--text-primary)] shadow-xs border border-[var(--border-default)] font-medium'
                : 'text-[var(--text-dim)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] border border-transparent'
            }`}
            style={{
              paddingTop: '5px',
              paddingBottom: '5px',
              paddingLeft: '14px',
              paddingRight: '10px',
              gap: '7px',
              borderLeftWidth: isDropTarget ? '2px' : '0px',
              borderLeftColor: isDropTarget ? 'var(--accent)' : 'transparent',
              borderLeftStyle: 'solid',
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="flex-shrink-0 opacity-50">
              {tab.articleId ? (
                <>
                  <circle cx="12" cy="12" r="10" />
                  <line x1="2" y1="12" x2="22" y2="12" />
                  <path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" />
                </>
              ) : (
                <>
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                </>
              )}
            </svg>
            <span className="text-[13px] truncate">{tab.fileName}</span>
            {!state.autosave && tab.isModified && (
              <span className="w-2 h-2 rounded-full bg-[var(--accent)] flex-shrink-0" />
            )}
            <button
              onClick={(e) => {
                e.stopPropagation()
                if (e.altKey) {
                  // Alt+Click — закрыть все вкладки кроме текущей
                  dispatch({ type: 'CLOSE_OTHER_TABS', payload: { tabId: tab.id } })
                } else {
                  // Обычный клик — закрыть эту вкладку (с проверкой несохранённых)
                  closeTab(tab.id)
                }
              }}
              className="ml-auto p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-[var(--bg-active)] transition-all flex-shrink-0"
              title={t('titlebar.tabCloseOthers')}
            >
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5">
                <line x1="2" y1="2" x2="8" y2="8" />
                <line x1="8" y1="2" x2="2" y2="8" />
              </svg>
            </button>
          </div>
        )
      })}
    </div>
  )
}
