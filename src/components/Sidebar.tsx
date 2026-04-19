/**
 * Sidebar.tsx — Боковая панель File Explorer.
 */
import { useState, useEffect, useRef } from 'react'
import { useEditor } from '../context/EditorContext'
import type { FileEntry, TocItem } from '../types'

export function Sidebar({ width }: { width: number }) {
  const { state, dispatch, openFolder, openFile, createFile, createFolder, startCreating, setActiveExplorerPath, refreshFileTree, setShowEmptyFolders, startRenaming, deleteItem, showInExplorer, moveItem } = useEditor()
  const [copied, setCopied] = useState(false)

  const filterTree = (nodes: FileEntry[]): FileEntry[] => {
    return nodes.reduce<FileEntry[]>((acc, node) => {
      if (!node.isDirectory) {
        acc.push(node)
      } else {
        const filteredChildren = filterTree(node.children || [])
        // Оставляем папку, если она непустая, ИЛИ если мы явно просим показывать пустые
        if (filteredChildren.length > 0 || state.showEmptyFolders) {
          acc.push({ ...node, children: filteredChildren })
        }
      }
      return acc
    }, [])
  }

  const visibleTree = filterTree(state.fileTree)

  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, path: string, type: 'file' | 'folder', name: string } | null>(null)

  useEffect(() => {
    const handleGlobalClick = () => setContextMenu(null)
    if (contextMenu) {
      document.addEventListener('click', handleGlobalClick)
      window.addEventListener('scroll', handleGlobalClick, true)
    }
    return () => {
      document.removeEventListener('click', handleGlobalClick)
      window.removeEventListener('scroll', handleGlobalClick, true)
    }
  }, [contextMenu])

  const handleContextMenu = (e: React.MouseEvent, path: string, type: 'file' | 'folder', name: string) => {
    e.preventDefault()
    e.stopPropagation()
    setContextMenu({ x: e.clientX, y: e.clientY, path, type, name })
  }

  return (
    <div style={{ width: `${width}px`, minWidth: '140px', maxWidth: '500px' }} className="bg-[var(--bg-surface)] border-r border-[var(--border-default)] flex flex-col h-full flex-shrink-0">
      <div
        className="flex items-center justify-between border-b border-[var(--border-default)]"
        style={{ height: '36px', paddingLeft: '16px', paddingRight: '12px' }}
      >
        <span
          className="text-[11px] font-semibold uppercase tracking-widest text-[var(--text-dim)] truncate cursor-pointer select-none"
          title={state.folderPath || 'Проводник'}
          onClick={() => {
            if (state.folderPath) {
              navigator.clipboard.writeText(state.folderPath)
              setCopied(true)
              setTimeout(() => setCopied(false), 1500)
            }
          }}
        >
          {copied ? 'Скопировано!' : (state.folderPath ? state.folderPath.replace(/^.*[\\/]/, '') : 'Проводник')}
        </span>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setShowEmptyFolders(!state.showEmptyFolders)}
            className="p-1 rounded hover:bg-[var(--bg-hover)] text-[var(--text-dim)] hover:text-[var(--text-muted)] transition-colors"
            title={state.showEmptyFolders ? "Скрыть пустые папки" : "Показывать пустые папки"}
          >
            {state.showEmptyFolders ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-eye">
                <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" />
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-eye-off">
                <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" /><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" /><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" /><line x1="2" x2="22" y1="2" y2="22" />
              </svg>
            )}
          </button>

          <button
            onClick={refreshFileTree}
            className="p-1 rounded hover:bg-[var(--bg-hover)] text-[var(--text-dim)] hover:text-[var(--text-muted)] transition-colors"
            title="Обновить"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-rotate-cw">
              <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" /><path d="M21 3v5h-5" />
            </svg>
          </button>

          <button
            onClick={openFolder}
            className="p-1 rounded hover:bg-[var(--bg-hover)] text-[var(--text-dim)] hover:text-[var(--text-muted)] transition-colors"
            title="Открыть папку"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-folder-open-icon lucide-folder-open">
              <path d="m6 14 1.5-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.54 6a2 2 0 0 1-1.95 1.5H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H18a2 2 0 0 1 2 2v2" />
            </svg>
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto py-2" 
        onClick={(e) => { if (e.target === e.currentTarget) setActiveExplorerPath(null) }}
        onContextMenu={(e) => {
          // ПКМ по пустому месту в Sidebar (#17)
          if (e.target === e.currentTarget && state.folderPath) {
            e.preventDefault()
            setContextMenu({ x: e.clientX, y: e.clientY, path: '__empty__', type: 'folder', name: '' })
          }
        }}
        onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move' }}
        onDrop={(e) => {
          e.preventDefault()
          const sourcePath = e.dataTransfer.getData('text/plain')
          if (sourcePath && state.folderPath) moveItem(sourcePath, state.folderPath)
        }}
      >
        {visibleTree.length === 0 && !state.creating ? (
          <EmptyState onOpenFolder={openFolder} isFolderOpen={!!state.folderPath} onCreateFile={() => startCreating('file')} />
        ) : (
          <div className="px-1" onClick={(e) => {
            if (e.target === e.currentTarget) setActiveExplorerPath(null)
          }}>
            {state.creating && state.creating.targetPath === state.folderPath && (
              <InlineCreateInput
                type={state.creating.type}
                depth={0}
                onSubmit={(name) => {
                  if (state.creating?.type === 'file') createFile(name, state.folderPath!)
                  else createFolder(name, state.folderPath!)
                }}
                onCancel={() => dispatch({ type: 'STOP_CREATING' })}
              />
            )}
            {visibleTree.map((entry) => (
              <FileTreeItem
                key={entry.path}
                entry={entry}
                depth={0}
                onFileClick={(filePath, fileName) => openFile(filePath, fileName)}
                onContextMenu={handleContextMenu}
                activeFilePath={state.tabs.find((t) => t.id === state.activeTabId)?.filePath || null}
                activeToc={state.activeToc || []}
              />
            ))}
          </div>
        )}
      </div>

      {contextMenu && (
        <div
          className="fixed bg-[var(--bg-elevated)] border border-[var(--border-strong)] rounded-md shadow-lg z-50 py-1 flex flex-col text-[13px] text-[var(--text-secondary)]"
          style={{ top: contextMenu.y, left: contextMenu.x, minWidth: '160px' }}
          onContextMenu={(e) => e.preventDefault()}
        >
          {contextMenu.path === '__empty__' ? (
            <>
              <button className="menu-item enabled" onClick={() => { startCreating('file'); setContextMenu(null) }}>
                Создать файл
              </button>
              <button className="menu-item enabled" onClick={() => { startCreating('folder'); setContextMenu(null) }}>
                Создать папку
              </button>
            </>
          ) : (
            <>
              <button className="menu-item enabled" onClick={() => { startRenaming(contextMenu.path, contextMenu.type); setContextMenu(null) }}>
                Переименовать
              </button>
              <button className="menu-item enabled" onClick={() => {
                navigator.clipboard.writeText(contextMenu.path)
                setContextMenu(null)
              }}>
                Копировать путь
              </button>
              {contextMenu.type === 'file' && (
                <button className="menu-item enabled" onClick={async () => {
                  try {
                    const content = await window.api.readFile(contextMenu.path)
                    const sep = contextMenu.path.includes('/') ? '/' : '\\'
                    const ext = contextMenu.name.includes('.') ? contextMenu.name.substring(contextMenu.name.lastIndexOf('.')) : ''
                    const baseName = ext ? contextMenu.name.substring(0, contextMenu.name.lastIndexOf('.')) : contextMenu.name
                    const dir = contextMenu.path.substring(0, contextMenu.path.lastIndexOf(sep))
                    const copyPath = dir + sep + baseName + ' копия' + ext
                    await window.api.writeFile(copyPath, content)
                    refreshFileTree()
                  } catch (err) { console.error('Ошибка копированиея файла:', err) }
                  setContextMenu(null)
                }}>
                  Создать копию
                </button>
              )}
              <div className="border-t border-[var(--border-strong)] my-1" />
              <button className="menu-item enabled" style={{ color: 'var(--text-danger)' }} onClick={() => { deleteItem(contextMenu.path, contextMenu.type, contextMenu.name); setContextMenu(null) }}>
                Удалить
              </button>
              <div className="border-t border-[var(--border-strong)] my-1" />
              <button className="menu-item enabled" onClick={() => { showInExplorer(contextMenu.path); setContextMenu(null) }}>
                Открыть в проводнике
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}

function InlineRenameInput({ initialValue, depth, onSubmit, onCancel }: {
  initialValue: string; depth: number; onSubmit: (name: string) => void; onCancel: () => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [value, setValue] = useState(initialValue)

  useEffect(() => {
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') { const name = value.trim(); if (name) onSubmit(name); else onCancel() }
    else if (e.key === 'Escape') onCancel()
  }
  return (
    <div className="flex items-center gap-1.5 rounded" style={{ paddingTop: '2px', paddingBottom: '2px', paddingLeft: `${depth * 12 + 26}px`, paddingRight: '8px' }}>
      <input ref={inputRef} type="text"
        value={value} onChange={e => setValue(e.target.value)}
        className="flex-1 bg-[var(--bg-hover)] text-[var(--text-primary)] text-[13px] border border-[var(--accent)] rounded px-1.5 py-0.5 outline-none"
        onKeyDown={handleKeyDown} onBlur={() => { const name = value.trim(); if (name && name !== initialValue) onSubmit(name); else onCancel() }}
      />
    </div>
  )
}

function InlineCreateInput({ type, depth, onSubmit, onCancel }: {
  type: 'file' | 'folder'; depth: number; onSubmit: (name: string) => void; onCancel: () => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => { inputRef.current?.focus() }, [])
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') { const name = e.currentTarget.value.trim(); if (name) onSubmit(name); else onCancel() }
    else if (e.key === 'Escape') onCancel()
  }
  return (
    <div className="flex items-center gap-1.5 rounded" style={{ paddingTop: '2px', paddingBottom: '2px', paddingLeft: `${depth * 12 + 26}px`, paddingRight: '8px' }}>
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

function EmptyState({ onOpenFolder, onCreateFile, isFolderOpen }: { onOpenFolder: () => void, onCreateFile: () => void, isFolderOpen: boolean }) {
  return (
    <div
      className="flex flex-col items-center justify-center h-full text-center"
      style={{ gap: '20px', padding: '0 24px' }}
    >
      <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-disabled)' }}>
        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
      </svg>
      <p style={{ fontSize: '13px', color: 'var(--text-dim)', margin: 0 }}>
        {isFolderOpen ? 'Эта папка пуста' : 'Нет открытой папки'}
      </p>
      <button
        onClick={isFolderOpen ? onCreateFile : onOpenFolder}
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
      >
        {isFolderOpen ? 'Создать файл' : 'Открыть папку'}
      </button>
    </div>
  )
}

function FileTreeItem({ entry, depth, onFileClick, onContextMenu, activeFilePath, activeToc }: {
  entry: FileEntry; depth: number;
  onFileClick: (filePath: string, fileName: string) => void;
  onContextMenu: (e: React.MouseEvent, path: string, type: 'file' | 'folder', name: string) => void;
  activeFilePath: string | null;
  activeToc: TocItem[];
}) {
  const { state, dispatch, createFile, createFolder, setActiveExplorerPath, renameItem, moveItem } = useEditor()
  const [isOpen, setIsOpen] = useState(depth < 1)
  const [isTocOpen, setIsTocOpen] = useState(true)
  const [isDragOver, setIsDragOver] = useState(false)

  const isActiveFile = !entry.isDirectory && entry.path === activeFilePath
  const isFolderActive = entry.isDirectory && entry.path === state.activeExplorerPath

  const handleDragStart = (e: React.DragEvent) => {
    e.stopPropagation()
    e.dataTransfer.setData('text/plain', entry.path)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
    const sourcePath = e.dataTransfer.getData('text/plain')
    if (sourcePath && sourcePath !== entry.path) {
      if (entry.isDirectory) {
        moveItem(sourcePath, entry.path)
      } else {
        const sep = entry.path.includes('/') ? '/' : '\\'
        const dirPath = entry.path.substring(0, entry.path.lastIndexOf(sep))
        moveItem(sourcePath, dirPath)
      }
    }
  }

  useEffect(() => {
    if (state.creating?.targetPath === entry.path) setIsOpen(true)
  }, [state.creating?.targetPath, entry.path])

  const isRenaming = state.renaming?.path === entry.path

  if (entry.isDirectory) {
    return (
      <div>
        {isRenaming ? (
          <InlineRenameInput
            initialValue={entry.name}
            depth={depth}
            onSubmit={(name) => renameItem(entry.path, name, 'folder')}
            onCancel={() => dispatch({ type: 'STOP_RENAMING' })}
          />
        ) : (
          <button
            draggable
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onContextMenu={(e) => onContextMenu(e, entry.path, 'folder', entry.name)}
            onClick={() => {
              setActiveExplorerPath(entry.path)
              setIsOpen(!isOpen)
            }}
            className={`w-full flex items-center gap-1.5 text-[13px] rounded transition-colors ${
               isDragOver ? 'bg-[var(--accent)] text-white' : isFolderActive ? 'bg-[var(--bg-hover)] text-[var(--text-primary)]' : 'text-[var(--text-muted)] hover:bg-[var(--bg-hover)]'
              }`}
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
        )}
        {isOpen && (
          <div>
            {state.creating?.targetPath === entry.path && (
              <InlineCreateInput
                type={state.creating.type}
                depth={depth}
                onSubmit={(name) => {
                  if (state.creating?.type === 'file') createFile(name, entry.path)
                  else createFolder(name, entry.path)
                }}
                onCancel={() => dispatch({ type: 'STOP_CREATING' })}
              />
            )}
            {entry.children?.map((child) => (
              <FileTreeItem key={child.path} entry={child} depth={depth + 1} onFileClick={onFileClick} onContextMenu={onContextMenu} activeFilePath={activeFilePath} activeToc={activeToc} />
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div>
      {isRenaming ? (
        <InlineRenameInput
          initialValue={entry.name.replace(/\.md$/i, '')}
          depth={depth}
          onSubmit={(name) => renameItem(entry.path, name, 'file')}
          onCancel={() => dispatch({ type: 'STOP_RENAMING' })}
        />
      ) : (
        <div 
          draggable
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`w-full flex items-center gap-1.5 text-[13px] rounded transition-colors group ${
            isDragOver ? 'bg-[var(--accent)] text-white' : isActiveFile ? 'bg-[var(--bg-hover)] text-[var(--text-primary)]' : 'text-[var(--text-muted)] hover:bg-[var(--bg-hover)]'
          }`} style={{ paddingLeft: `${depth * 12 + (isActiveFile && activeToc.length > 0 ? 8 : 26)}px`, paddingRight: '1px' }}>
          {isActiveFile && activeToc.length > 0 && (
            <button onClick={() => setIsTocOpen(!isTocOpen)} className={`p-1 rounded ${isDragOver ? 'hover:bg-white/20' : 'hover:bg-[var(--border-default)]'}`}>
              <svg width="10" height="10" viewBox="0 0 12 12" className={`transition-transform flex-shrink-0 ${isDragOver ? 'text-white' : 'text-[var(--text-dim)]'} ${isTocOpen ? 'rotate-90' : ''}`} fill="currentColor">
                <path d="M4 2l4 4-4 4z" />
              </svg>
            </button>
          )}
          <button
            onContextMenu={(e) => onContextMenu(e, entry.path, 'file', entry.name)}
            onClick={() => onFileClick(entry.path, entry.name)}
            className="flex-1 flex items-center gap-1.5 overflow-hidden"
            style={{ paddingTop: '5px', paddingBottom: '5px' }}
          >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`flex-shrink-0 ${isDragOver ? 'text-white' : 'text-[var(--accent)]'}`}>
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
          <span className="truncate">{entry.name}</span>
        </button>
      </div>
      )}
      {isActiveFile && isTocOpen && activeToc.length > 0 && (
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
