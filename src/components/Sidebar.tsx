/**
 * Sidebar.tsx — Боковая панель File Explorer.
 */
import { useState, useEffect, useRef } from 'react'
import { useEditor } from '../context/EditorContext'
import type { FileEntry } from '../types'

export function Sidebar() {
  const { state, dispatch, openFolder, openFile, createFile, createFolder } = useEditor()

  return (
    <div className="w-60 min-w-[200px] max-w-[400px] bg-[var(--bg-surface)] border-r border-[var(--border-default)] flex flex-col h-full">
      <div
        className="flex items-center justify-between border-b border-[var(--border-default)]"
        style={{ height: '36px', paddingLeft: '16px', paddingRight: '12px' }}
      >
        <span className="text-[11px] font-semibold uppercase tracking-widest text-[var(--text-dim)]">
          Проводник
        </span>
        <button
          onClick={openFolder}
          className="p-1 rounded hover:bg-[var(--bg-hover)] text-[var(--text-dim)] hover:text-[var(--text-muted)] transition-colors"
          title="Открыть папку"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
            <line x1="12" y1="11" x2="12" y2="17" />
            <line x1="9" y1="14" x2="15" y2="14" />
          </svg>
        </button>
      </div>
      <div className="flex-1 overflow-y-auto py-2">
        {state.fileTree.length === 0 && !state.creating ? (
          <EmptyState onOpenFolder={openFolder} />
        ) : (
          <div className="px-1">
            {state.creating && (
              <InlineCreateInput
                type={state.creating.type}
                onSubmit={(name) => {
                  if (state.creating?.type === 'file') createFile(name)
                  else createFolder(name)
                }}
                onCancel={() => dispatch({ type: 'STOP_CREATING' })}
              />
            )}
            {state.fileTree.map((entry) => (
              <FileTreeItem
                key={entry.path}
                entry={entry}
                depth={0}
                onFileClick={(filePath, fileName) => openFile(filePath, fileName)}
                activeFilePath={state.tabs.find((t) => t.id === state.activeTabId)?.filePath || null}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function InlineCreateInput({ type, onSubmit, onCancel }: {
  type: 'file' | 'folder'; onSubmit: (name: string) => void; onCancel: () => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => { inputRef.current?.focus() }, [])
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') { const name = e.currentTarget.value.trim(); if (name) onSubmit(name); else onCancel() }
    else if (e.key === 'Escape') onCancel()
  }
  return (
    <div className="flex items-center gap-1.5 rounded" style={{ padding: '4px 8px' }}>
      {type === 'folder' ? (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0 text-[var(--text-dim)]">
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
        </svg>
      ) : (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0 text-[var(--accent)]">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
        </svg>
      )}
      <input ref={inputRef} type="text"
        className="flex-1 bg-[var(--bg-hover)] text-[var(--text-primary)] text-[13px] border border-[var(--accent)] rounded px-1.5 py-0.5 outline-none"
        placeholder={type === 'folder' ? 'Имя папки...' : 'Имя файла...'}
        onKeyDown={handleKeyDown} onBlur={onCancel}
      />
    </div>
  )
}

function EmptyState({ onOpenFolder }: { onOpenFolder: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-full px-6 text-center">
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--text-disabled)] mb-4">
        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
      </svg>
      <p className="text-[13px] text-[var(--text-dim)] mb-3">Нет открытой папки</p>
      <button onClick={onOpenFolder}
        className="px-3 py-1.5 text-[12px] font-medium bg-[var(--accent)] text-white rounded-md hover:bg-[var(--accent-hover)] transition-colors"
      >Открыть папку</button>
    </div>
  )
}

function FileTreeItem({ entry, depth, onFileClick, activeFilePath }: {
  entry: FileEntry; depth: number;
  onFileClick: (filePath: string, fileName: string) => void;
  activeFilePath: string | null;
}) {
  const [isOpen, setIsOpen] = useState(depth < 1)
  const isActive = entry.path === activeFilePath

  if (entry.isDirectory) {
    return (
      <div>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="w-full flex items-center gap-1.5 text-[13px] text-[var(--text-muted)] hover:bg-[var(--bg-hover)] rounded transition-colors"
          style={{ paddingTop: '5px', paddingBottom: '5px', paddingLeft: `${depth * 12 + 8}px`, paddingRight: '8px' }}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" className={`transition-transform flex-shrink-0 ${isOpen ? 'rotate-90' : ''}`} fill="currentColor">
            <path d="M4 2l4 4-4 4z" />
          </svg>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0 text-[var(--text-dim)]">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
          </svg>
          <span className="truncate">{entry.name}</span>
        </button>
        {isOpen && entry.children && (
          <div>
            {entry.children.map((child) => (
              <FileTreeItem key={child.path} entry={child} depth={depth + 1} onFileClick={onFileClick} activeFilePath={activeFilePath} />
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <button
      onClick={() => onFileClick(entry.path, entry.name)}
      className={`w-full flex items-center gap-1.5 text-[13px] rounded transition-colors ${
        isActive ? 'bg-[var(--bg-hover)] text-[var(--text-primary)]' : 'text-[var(--text-muted)] hover:bg-[var(--bg-hover)]'
      }`}
      style={{ paddingTop: '5px', paddingBottom: '5px', paddingLeft: `${depth * 12 + 26}px`, paddingRight: '8px' }}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0 text-[var(--accent)]">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
      </svg>
      <span className="truncate">{entry.name}</span>
    </button>
  )
}
