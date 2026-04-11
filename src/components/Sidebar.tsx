/**
 * Sidebar.tsx — Боковая панель File Explorer.
 */
import { useState, useEffect, useRef } from 'react'
import { useEditor } from '../context/EditorContext'
import type { FileEntry, TocItem } from '../types'

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
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-folder-open-icon lucide-folder-open">
            <path d="m6 14 1.5-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.54 6a2 2 0 0 1-1.95 1.5H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H18a2 2 0 0 1 2 2v2" />
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
                activeToc={state.activeToc || []}
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
    <div
      className="flex flex-col items-center justify-center h-full text-center"
      style={{ gap: '20px', padding: '0 24px' }}
    >
      <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-disabled)' }}>
        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
      </svg>
      <p style={{ fontSize: '13px', color: 'var(--text-dim)', margin: 0 }}>Нет открытой папки</p>
      <button
        onClick={onOpenFolder}
        style={{
          padding: '8px 20px',
          fontSize: '13px',
          fontWeight: 500,
          background: 'var(--accent)',
          color: 'white',
          border: 'none',
          borderRadius: '6px',
          cursor: 'pointer',
          transition: 'background 0.15s',
        }}
        onMouseEnter={e => (e.currentTarget.style.background = 'var(--accent-hover)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'var(--accent)')}
      >Открыть папку</button>
    </div>
  )
}

function FileTreeItem({ entry, depth, onFileClick, activeFilePath, activeToc }: {
  entry: FileEntry; depth: number;
  onFileClick: (filePath: string, fileName: string) => void;
  activeFilePath: string | null;
  activeToc: TocItem[];
}) {
  const [isOpen, setIsOpen] = useState(depth < 1)
  const [isTocOpen, setIsTocOpen] = useState(true)
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
              <FileTreeItem key={child.path} entry={child} depth={depth + 1} onFileClick={onFileClick} activeFilePath={activeFilePath} activeToc={activeToc} />
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div>
      <div className={`w-full flex items-center gap-1.5 text-[13px] rounded transition-colors group ${isActive ? 'bg-[var(--bg-hover)] text-[var(--text-primary)]' : 'text-[var(--text-muted)] hover:bg-[var(--bg-hover)]'
        }`} style={{ paddingLeft: `${depth * 12 + (isActive && activeToc.length > 0 ? 8 : 26)}px`, paddingRight: '1px' }}>
        {isActive && activeToc.length > 0 && (
          <button onClick={() => setIsTocOpen(!isTocOpen)} className="p-1 rounded hover:bg-[var(--border-default)]">
            <svg width="10" height="10" viewBox="0 0 12 12" className={`transition-transform flex-shrink-0 text-[var(--text-dim)] ${isTocOpen ? 'rotate-90' : ''}`} fill="currentColor">
              <path d="M4 2l4 4-4 4z" />
            </svg>
          </button>
        )}
        <button
          onClick={() => onFileClick(entry.path, entry.name)}
          className="flex-1 flex items-center gap-1.5 overflow-hidden"
          style={{ paddingTop: '5px', paddingBottom: '5px' }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0 text-[var(--accent)]">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
          <span className="truncate">{entry.name}</span>
        </button>
      </div>
      {isActive && isTocOpen && activeToc.length > 0 && (
        <div className="mt-0.5">
          {activeToc.map((toc) => (
            <button
              key={toc.id}
              onClick={() => window.dispatchEvent(new CustomEvent('editor-scroll-to', { detail: { pos: toc.pos } }))}
              className="w-full text-left truncate text-[12px] text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] rounded transition-colors"
              style={{
                paddingTop: '3px', paddingBottom: '3px',
                paddingLeft: `${depth * 12 + 26 + (toc.level - 1) * 12}px`,
                paddingRight: '8px'
              }}
              title={toc.text}
            >
              <span className="opacity-50 mr-1">#</span>
              {toc.text}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
