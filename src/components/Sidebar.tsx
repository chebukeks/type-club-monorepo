/**
 * Sidebar.tsx — Боковая панель File Explorer.
 * Позволяет:
 * - Открыть рабочую папку
 * - Просматривать дерево .md файлов
 * - Кликнуть по файлу для открытия во вкладке
 */
import { useState } from 'react'
import { useEditor } from '../context/EditorContext'
import type { FileEntry } from '../types'

export function Sidebar() {
  const { state, openFolder, openFile } = useEditor()

  return (
    <div className="w-60 min-w-[200px] max-w-[400px] bg-[#1e1f22] border-r border-[#2d2e32] flex flex-col h-full">
      {/* Заголовок панели — высота h-9 совпадает с TabBar */}
      <div
        className="flex items-center justify-between border-b border-[#2d2e32]"
        style={{ height: '36px', paddingLeft: '16px', paddingRight: '12px' }}
      >
        <span className="text-[11px] font-semibold uppercase tracking-widest text-[#6a6e78]">
          Проводник
        </span>
        <button
          onClick={openFolder}
          className="p-1 rounded hover:bg-[#2a2d33] text-[#6a6e78] hover:text-[#a0a4ab] transition-colors"
          title="Открыть папку"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
            <line x1="12" y1="11" x2="12" y2="17" />
            <line x1="9" y1="14" x2="15" y2="14" />
          </svg>
        </button>
      </div>

      {/* Дерево файлов */}
      <div className="flex-1 overflow-y-auto py-2">
        {state.fileTree.length === 0 ? (
          <EmptyState onOpenFolder={openFolder} />
        ) : (
          <div className="px-1">
            {state.fileTree.map((entry) => (
              <FileTreeItem
                key={entry.path}
                entry={entry}
                depth={0}
                onFileClick={(filePath, fileName) => openFile(filePath, fileName)}
                activeFilePath={
                  state.tabs.find((t) => t.id === state.activeTabId)?.filePath || null
                }
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

/** Заглушка при пустом проводнике */
function EmptyState({ onOpenFolder }: { onOpenFolder: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-full px-6 text-center">
      <svg
        width="40"
        height="40"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-[#3a3d44] mb-4"
      >
        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
      </svg>
      <p className="text-[13px] text-[#6a6e78] mb-3">
        Нет открытой папки
      </p>
      <button
        onClick={onOpenFolder}
        className="px-3 py-1.5 text-[12px] font-medium bg-[#6c8cff] text-white rounded-md hover:bg-[#5a7aef] transition-colors"
      >
        Открыть папку
      </button>
    </div>
  )
}

/** Рекурсивный элемент дерева файлов */
function FileTreeItem({
  entry,
  depth,
  onFileClick,
  activeFilePath,
}: {
  entry: FileEntry
  depth: number
  onFileClick: (filePath: string, fileName: string) => void
  activeFilePath: string | null
}) {
  const [isOpen, setIsOpen] = useState(depth < 1) // Первый уровень раскрыт по умолчанию
  const isActive = entry.path === activeFilePath

  if (entry.isDirectory) {
    return (
      <div>
        {/* Папка */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="w-full flex items-center gap-1.5 text-[13px] text-[#a0a4ab] hover:bg-[#2a2d33] rounded transition-colors"
          style={{
            paddingTop: '5px',
            paddingBottom: '5px',
            paddingLeft: `${depth * 12 + 8}px`,
            paddingRight: '8px',
          }}
        >
          {/* Стрелка раскрытия */}
          <svg
            width="12"
            height="12"
            viewBox="0 0 12 12"
            className={`transition-transform flex-shrink-0 ${isOpen ? 'rotate-90' : ''}`}
            fill="currentColor"
          >
            <path d="M4 2l4 4-4 4z" />
          </svg>
          {/* Иконка папки */}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0 text-[#6a6e78]">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
          </svg>
          <span className="truncate">{entry.name}</span>
        </button>
        {/* Дочерние элементы */}
        {isOpen && entry.children && (
          <div>
            {entry.children.map((child) => (
              <FileTreeItem
                key={child.path}
                entry={child}
                depth={depth + 1}
                onFileClick={onFileClick}
                activeFilePath={activeFilePath}
              />
            ))}
          </div>
        )}
      </div>
    )
  }

  // Файл
  return (
    <button
      onClick={() => onFileClick(entry.path, entry.name)}
      className={`w-full flex items-center gap-1.5 text-[13px] rounded transition-colors ${
        isActive
          ? 'bg-[#2a2d33] text-[#e1e1e3]'
          : 'text-[#a0a4ab] hover:bg-[#2a2d33]'
      }`}
      style={{
        paddingTop: '5px',
        paddingBottom: '5px',
        paddingLeft: `${depth * 12 + 26}px`,
        paddingRight: '8px',
      }}
    >
      {/* Иконка файла Markdown */}
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0 text-[#6c8cff]">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
      </svg>
      <span className="truncate">{entry.name}</span>
    </button>
  )
}
