import { useState, useEffect, useRef, useCallback } from 'react'
import { useEditor } from '../context/EditorContext'
import { config } from '../config'
import { useAuth } from '../context/AuthContext'
import type { FileEntry, TocItem } from '../types'
import type { ArticleListItem } from '../api'
import { Search, X, Pin } from 'lucide-react'

export function Sidebar({ width }: { width: number }) {
  const { user } = useAuth()
  const {
    state,
    dispatch,
    openFolder,
    openFile,
    createFile,
    createFolder,
    startCreating,
    setActiveExplorerPath,
    refreshFileTree,
    setShowEmptyFolders,
    startRenaming,
    deleteItem,
    showInExplorer,
    moveItem,
    setSidebarMode,
    fetchOnlineArticles,
    openOnlineArticle,
    deleteOnlineArticle,
    renameOnlineArticle,
    duplicateOnlineArticle,
    pinLocalPath,
    unpinLocalPath,
    reorderPinnedLocalPaths,
    pinOnlineArticle,
    unpinOnlineArticle,
    reorderPinnedOnlineArticles,
    createOnlineArticle,
    t,
  } = useEditor()
  const [copied, setCopied] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedRoles, setSelectedRoles] = useState<('author' | 'co_author' | 'editor')[]>(['author', 'co_author', 'editor'])

  const toggleRoleFilter = (role: 'author' | 'co_author' | 'editor') => {
    setSelectedRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
    )
  }

  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({})
  const [isPinnedLocalCollapsed, setIsPinnedLocalCollapsed] = useState(false)
  const [isPinnedOnlineCollapsed, setIsPinnedOnlineCollapsed] = useState(false)

  useEffect(() => {
    window.api.storeGet('expandedFolders').then((saved) => {
      if (saved && typeof saved === 'object') {
        setExpandedFolders(saved as Record<string, boolean>)
      }
    }).catch(() => {})
    window.api.storeGet('isPinnedLocalCollapsed').then((val) => {
      if (typeof val === 'boolean') setIsPinnedLocalCollapsed(val)
    }).catch(() => {})
    window.api.storeGet('isPinnedOnlineCollapsed').then((val) => {
      if (typeof val === 'boolean') setIsPinnedOnlineCollapsed(val)
    }).catch(() => {})
  }, [])

  const toggleFolderExpanded = useCallback((path: string, defaultOpen: boolean) => {
    setExpandedFolders((prev) => {
      const currentIsOpen = prev[path] ?? defaultOpen
      const next = { ...prev, [path]: !currentIsOpen }
      window.api.storeSet('expandedFolders', next).catch(() => {})
      return next
    })
  }, [])

  const isOnline = state.sidebarMode === 'online'

  const filterTree = (nodes: FileEntry[]): FileEntry[] => {
    return nodes.reduce<FileEntry[]>((acc, node) => {
      if (!node.isDirectory) {
        acc.push(node)
      } else {
        const filteredChildren = filterTree(node.children || [])
        if (filteredChildren.length > 0 || state.showEmptyFolders) {
          acc.push({ ...node, children: filteredChildren })
        }
      }
      return acc
    }, [])
  }

  const visibleTree = filterTree(state.fileTree)

  const isLocalSearching = !isOnline && searchQuery.trim() !== ''

  const collectFlatFiles = (nodes: FileEntry[], query: string): FileEntry[] => {
    const result: FileEntry[] = []
    const q = query.trim().toLowerCase()

    const recurse = (list: FileEntry[]) => {
      for (const item of list) {
        if (!item.isDirectory) {
          if (!q || item.name.toLowerCase().includes(q)) {
            result.push(item)
          }
        } else if (item.children) {
          recurse(item.children)
        }
      }
    }

    recurse(nodes)
    return result
  }

  const flatSearchResults = isLocalSearching ? collectFlatFiles(state.fileTree, searchQuery) : []

  const filteredOnlineArticles = state.onlineArticles.filter((article) => {
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase()
      if (!article.title.toLowerCase().includes(q)) return false
    }

    if (selectedRoles.length === 0) return false
    if (selectedRoles.length === 3) return true

    const articleRoles = article.my_roles && article.my_roles.length > 0
      ? article.my_roles
      : (user && article.author_nickname === user.nickname ? ['author'] : ['author'])

    return articleRoles.some((r) => selectedRoles.includes(r as any))
  })

  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null)
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, path: string, type: 'file' | 'folder', name: string } | null>(null)
  const [onlineMenu, setOnlineMenu] = useState<{ x: number, y: number, article: ArticleListItem } | null>(null)

  const [savedCtxMenu, setSavedCtxMenu] = useState<typeof contextMenu>(null)
  const [savedOnlineMenu, setSavedOnlineMenu] = useState<typeof onlineMenu>(null)
  const [contextMenuMounted, setContextMenuMounted] = useState(false)
  const [onlineMenuMounted, setOnlineMenuMounted] = useState(false)

  useEffect(() => {
    if (contextMenu) {
      setSavedCtxMenu(contextMenu)
      setContextMenuMounted(true)
    } else {
      const timer = setTimeout(() => setContextMenuMounted(false), 100)
      return () => clearTimeout(timer)
    }
  }, [contextMenu])

  useEffect(() => {
    if (onlineMenu) {
      setSavedOnlineMenu(onlineMenu)
      setOnlineMenuMounted(true)
    } else {
      const timer = setTimeout(() => setOnlineMenuMounted(false), 100)
      return () => clearTimeout(timer)
    }
  }, [onlineMenu])

  useEffect(() => {
    const handleGlobalClick = () => { setContextMenu(null); setOnlineMenu(null) }
    if (contextMenu || onlineMenu) {
      document.addEventListener('click', handleGlobalClick)
      window.addEventListener('scroll', handleGlobalClick, true)
    }
    return () => {
      document.removeEventListener('click', handleGlobalClick)
      window.removeEventListener('scroll', handleGlobalClick, true)
    }
  }, [contextMenu, onlineMenu])

  // Сброс выбранного файла при клике вне элементов файлов
  useEffect(() => {
    const handleGlobalMouseDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null
      if (!target?.closest('[data-sidebar-file]')) {
        setSelectedFilePath(null)
      }
    }
    window.addEventListener('mousedown', handleGlobalMouseDown)
    return () => window.removeEventListener('mousedown', handleGlobalMouseDown)
  }, [])

  // Копирование файла целиком по Ctrl+C, если после выбора файла не было других кликов
  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'c' || e.key === 'C' || e.key === 'с' || e.key === 'С')) {
        // Если в документе или полях ввода есть выделенный текст, не перехватываем
        const selection = window.getSelection()?.toString()
        if (selection && selection.length > 0) return
        const activeTag = document.activeElement?.tagName.toLowerCase()
        if (activeTag === 'input' || activeTag === 'textarea') return

        if (selectedFilePath) {
          e.preventDefault()
          try {
            if (window.api?.copyFileToClipboard) {
              await window.api.copyFileToClipboard(selectedFilePath)
            } else {
              const content = await window.api.readFile(selectedFilePath)
              await navigator.clipboard.writeText(content)
            }
          } catch (err) {
            console.error('Ошибка копирования файла в буфер обмена:', err)
          }
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedFilePath])

  const handleContextMenu = (e: React.MouseEvent, path: string, type: 'file' | 'folder', name: string) => {
    e.preventDefault()
    e.stopPropagation()
    if (type === 'file') {
      setSelectedFilePath(path)
    }
    setContextMenu({ x: e.clientX, y: e.clientY, path, type, name })
  }

  const normalizePath = (p: string) => p.replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase()

  const findEntryByPath = (nodes: FileEntry[], targetPath: string): FileEntry | null => {
    const targetNorm = normalizePath(targetPath)
    for (const node of nodes) {
      if (normalizePath(node.path) === targetNorm) return node
      if (node.isDirectory && node.children) {
        const found = findEntryByPath(node.children, targetPath)
        if (found) return found
      }
    }
    return null
  }

  const resolveFileEntry = (path: string): FileEntry => {
    const found = findEntryByPath(state.fileTree, path)
    if (found) return found
    const sep = path.includes('/') ? '/' : '\\'
    const name = path.substring(path.lastIndexOf(sep) + 1) || path
    const isDir = !name.includes('.')
    return { name, path, isDirectory: isDir }
  }

  const activeTab = state.tabs.find((t) => t.id === state.activeTabId)
  const onlineUsername = user?.nickname || 'username'
  return (
    <div style={{ width: `${width}px`, minWidth: '140px', maxWidth: '500px' }} className="bg-[var(--bg-surface)] flex flex-col h-full flex-shrink-0 select-none">
      <div
        className="flex items-center justify-between"
        style={{ height: '36px', paddingLeft: '16px', paddingRight: '12px' }}
      >
        <span
          className="text-[11px] font-semibold uppercase tracking-widest text-[var(--text-dim)] truncate cursor-pointer select-none"
          title={isOnline ? 'Type Club' : (state.folderPath || t('sidebar.explorer'))}
          onClick={() => {
            if (!isOnline && state.folderPath) {
              navigator.clipboard.writeText(state.folderPath)
              setCopied(true)
              setTimeout(() => setCopied(false), 1500)
            }
          }}
        >
          {copied ? t('common.copied') : (
            isOnline ? 'Type Club' : (state.folderPath ? state.folderPath.replace(/^.*[\\/]/, '') : t('sidebar.explorer'))
          )}
        </span>
        <div className="flex items-center gap-1.5">
          {user && (
            <button
              onClick={() => setSidebarMode(isOnline ? 'local' : 'online')}
              className={`p-1 rounded transition-colors ${isOnline ? 'text-[var(--accent)] bg-[var(--bg-active)]' : 'text-[var(--text-dim)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-muted)]'}`}
              title={isOnline ? t('sidebar.localFiles') : t('sidebar.onlineArticles')}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="2" y1="12" x2="22" y2="12" />
                <path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" />
              </svg>
            </button>
          )}

          {!isOnline && (
            <>
              <button
                onClick={() => setShowEmptyFolders(!state.showEmptyFolders)}
                className="p-1 rounded hover:bg-[var(--bg-hover)] text-[var(--text-dim)] hover:text-[var(--text-muted)] transition-colors"
                title={state.showEmptyFolders ? t('sidebar.hideEmptyFolders') : t('sidebar.showEmptyFolders')}
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
                title={t('common.refresh')}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-rotate-cw">
                  <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" /><path d="M21 3v5h-5" />
                </svg>
              </button>

              <button
                onClick={openFolder}
                className="p-1 rounded hover:bg-[var(--bg-hover)] text-[var(--text-dim)] hover:text-[var(--text-muted)] transition-colors"
                title={t('sidebar.openFolder')}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-folder-open-icon lucide-folder-open">
                  <path d="m6 14 1.5-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.54 6a2 2 0 0 1-1.95 1.5H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H18a2 2 0 0 1 2 2v2" />
                </svg>
              </button>
            </>
          )}

          {isOnline && (
            <button
              onClick={fetchOnlineArticles}
              className="p-1 rounded hover:bg-[var(--bg-hover)] text-[var(--text-dim)] hover:text-[var(--text-muted)] transition-colors"
              title={t('common.refresh')}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" /><path d="M21 3v5h-5" />
              </svg>
            </button>
          )}
        </div>
      </div>

      <div className="shrink-0" style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div className="relative flex items-center">
          <Search size={13} className="absolute text-[var(--text-dim)] pointer-events-none" style={{ left: '10px' }} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={isOnline ? t('sidebar.searchArticles') : t('sidebar.searchFiles')}
            style={{ paddingLeft: '30px', paddingRight: '28px', paddingTop: '6px', paddingBottom: '6px' }}
            className="w-full rounded-xl bg-[var(--bg-input)] border border-[var(--border-default)] text-xs text-[var(--text-primary)] outline-none focus:border-[var(--accent)] transition-colors placeholder-[var(--text-dim)]"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute text-[var(--text-dim)] hover:text-[var(--text-primary)]"
              style={{ right: '8px', padding: '2px' }}
              title={t('sidebar.clearSearch')}
            >
              <X size={12} />
            </button>
          )}
        </div>

        {isOnline && (
          <div className="select-none" style={{ display: 'flex', alignItems: 'center', gap: '12px', paddingTop: '2px', paddingLeft: '2px' }}>
            <label className="flex items-center text-[11px] text-[var(--text-secondary)] cursor-pointer hover:text-[var(--text-primary)]" style={{ gap: '6px' }}>
              <input
                type="checkbox"
                checked={selectedRoles.includes('author')}
                onChange={() => toggleRoleFilter('author')}
                className="w-3.5 h-3.5 accent-[var(--accent)] rounded cursor-pointer"
              />
              <span>{t('sidebar.author')}</span>
            </label>

            <label className="flex items-center text-[11px] text-[var(--text-secondary)] cursor-pointer hover:text-[var(--text-primary)]" style={{ gap: '6px' }}>
              <input
                type="checkbox"
                checked={selectedRoles.includes('co_author')}
                onChange={() => toggleRoleFilter('co_author')}
                className="w-3.5 h-3.5 accent-[var(--accent)] rounded cursor-pointer"
              />
              <span>{t('sidebar.coAuthor')}</span>
            </label>

            <label className="flex items-center text-[11px] text-[var(--text-secondary)] cursor-pointer hover:text-[var(--text-primary)]" style={{ gap: '6px' }}>
              <input
                type="checkbox"
                checked={selectedRoles.includes('editor')}
                onChange={() => toggleRoleFilter('editor')}
                className="w-3.5 h-3.5 accent-[var(--accent)] rounded cursor-pointer"
              />
              <span>{t('sidebar.advisor')}</span>
            </label>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto py-2"
        onClick={(e) => { if (e.target === e.currentTarget) setActiveExplorerPath(null) }}
        onContextMenu={(e) => {
          if (e.target === e.currentTarget) {
            e.preventDefault()
            if (isOnline) {
              setOnlineMenu(null)
              // Empty space context menu for online — show at mouse position
              setContextMenu({ x: e.clientX, y: e.clientY, path: '__online_empty__', type: 'file', name: '' })
            } else if (state.folderPath) {
              setContextMenu({ x: e.clientX, y: e.clientY, path: '__empty__', type: 'folder', name: '' })
            }
          }
        }}
        onDragOver={isOnline ? undefined : (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move' }}
        onDrop={isOnline ? undefined : (e) => {
          e.preventDefault()
          const sourcePath = e.dataTransfer.getData('text/plain')
          if (sourcePath && state.folderPath) moveItem(sourcePath, state.folderPath)
        }}
      >
        {isOnline ? (
          /* --- Online Articles --- */
          <div className="px-1">
            {state.creating && (
              <OnlineCreateInput
                onSubmit={async (name) => {
                  try {
                    await createOnlineArticle(name)
                  } catch (err) {
                    console.error('Failed to create online article:', err)
                  }
                  dispatch({ type: 'STOP_CREATING' })
                }}
                onCancel={() => dispatch({ type: 'STOP_CREATING' })}
              />
            )}

            {/* Pinned online articles */}
            {state.pinnedOnlineArticleIds.length > 0 && !searchQuery.trim() && (
              <div
                style={{
                  paddingLeft: '6px',
                  paddingRight: '6px',
                  marginBottom: '8px',
                  paddingBottom: '4px',
                  borderBottom: '1px solid var(--border-default)',
                }}
              >
                <div
                  onClick={() => {
                    setIsPinnedOnlineCollapsed((prev) => {
                      const next = !prev
                      window.api.storeSet('isPinnedOnlineCollapsed', next).catch(() => {})
                      return next
                    })
                  }}
                  className="flex items-center justify-between px-2 py-1 text-[11px] font-semibold text-[var(--text-dim)] uppercase tracking-wider select-none cursor-pointer hover:text-[var(--text-primary)] rounded transition-colors"
                  style={{ marginBottom: '2px' }}
                >
                  <div className="flex items-center gap-1.5">
                    <Pin size={11} className="opacity-70 rotate-45" />
                    <span>{t('sidebar.pinned')}</span>
                    <span className="text-[10px] opacity-60">({state.pinnedOnlineArticleIds.length})</span>
                  </div>
                  <svg
                    width="10"
                    height="10"
                    viewBox="0 0 12 12"
                    style={{
                      transform: isPinnedOnlineCollapsed ? 'rotate(90deg)' : 'rotate(0deg)',
                      transition: 'transform 0.15s',
                    }}
                    fill="currentColor"
                    className="opacity-70"
                  >
                    <path d="M2 4l4 4 4-4z" />
                  </svg>
                </div>
                {!isPinnedOnlineCollapsed && (
                  <div className="flex flex-col gap-0.5">
                    {state.pinnedOnlineArticleIds.map((articleId, idx) => {
                      const article = state.onlineArticles.find((a) => a.id === articleId)
                      if (!article) return null
                      return (
                        <div
                          key={`pinned-online-${article.id}`}
                          draggable
                          onDragStart={(e) => {
                            e.stopPropagation()
                            e.dataTransfer.setData('application/x-type-club-pinned-online', String(idx))
                            e.dataTransfer.effectAllowed = 'move'
                          }}
                          onDragOver={(e) => {
                            if (e.dataTransfer.types.includes('application/x-type-club-pinned-online')) {
                              e.preventDefault()
                              e.stopPropagation()
                              e.dataTransfer.dropEffect = 'move'
                            }
                          }}
                          onDrop={(e) => {
                            if (e.dataTransfer.types.includes('application/x-type-club-pinned-online')) {
                              e.preventDefault()
                              e.stopPropagation()
                              const fromIdx = Number(e.dataTransfer.getData('application/x-type-club-pinned-online'))
                              if (!isNaN(fromIdx) && fromIdx !== idx) {
                                const next = [...state.pinnedOnlineArticleIds]
                                const [item] = next.splice(fromIdx, 1)
                                next.splice(idx, 0, item)
                                reorderPinnedOnlineArticles(next)
                              }
                            }
                          }}
                        >
                          <OnlineArticleItem
                            article={article}
                            activeTabArticleId={activeTab?.articleId}
                            activeToc={activeTab?.articleId === article.id ? state.activeToc : []}
                            onOpen={() => openOnlineArticle(article.id)}
                            onContextMenu={(e) => {
                              e.preventDefault()
                              e.stopPropagation()
                              setOnlineMenu({ x: e.clientX, y: e.clientY, article })
                            }}
                            onRename={(title) => renameOnlineArticle(article.id, title)}
                          />
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            {state.onlineArticles.length === 0 && !state.creating ? (
              <EmptyState
                isOnline
                onCreateArticle={() => startCreating('file')}
              />
            ) : filteredOnlineArticles.length === 0 ? (
              <div style={{ padding: '16px', textAlign: 'center' }} className="text-xs text-[var(--text-dim)] italic">
                {t('sidebar.articlesNotFound')}
              </div>
            ) : (
              filteredOnlineArticles
                .filter((article) => searchQuery.trim() ? true : !state.pinnedOnlineArticleIds.includes(article.id))
                .map((article) => (
                  <OnlineArticleItem
                    key={article.id}
                    article={article}
                    activeTabArticleId={activeTab?.articleId}
                    activeToc={activeTab?.articleId === article.id ? state.activeToc : []}
                    onOpen={() => openOnlineArticle(article.id)}
                    onContextMenu={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      setOnlineMenu({ x: e.clientX, y: e.clientY, article })
                    }}
                    onRename={(title) => renameOnlineArticle(article.id, title)}
                  />
                ))
            )}
          </div>
        ) : (
          /* --- Local Files --- */
          <>
            {isLocalSearching ? (
              flatSearchResults.length === 0 ? (
                <div style={{ padding: '16px', textAlign: 'center' }} className="text-xs text-[var(--text-dim)] italic">
                  {t('sidebar.filesNotFound')}
                </div>
              ) : (
                <div style={{ padding: '4px 6px' }}>
                  {flatSearchResults.map((file) => (
                    <div
                      key={file.path}
                      data-sidebar-file={file.path}
                      onClick={() => {
                        setSelectedFilePath(file.path)
                        openFile(file.path, file.name)
                      }}
                      onContextMenu={(e) => handleContextMenu(e, file.path, 'file', file.name)}
                      style={{ padding: '6px 10px', display: 'flex', alignItems: 'center', gap: '8px' }}
                      className={`rounded text-xs cursor-pointer hover:bg-[var(--bg-hover)] ${
                        activeTab?.filePath === file.path ? 'bg-[var(--bg-active)] text-[var(--accent)] font-medium' : 'text-[var(--text-primary)]'
                      }`}
                      title={`${file.name}\n${file.path}`}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0 text-[var(--accent)]">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                      </svg>
                      <span className="truncate">{file.name}</span>
                    </div>
                  ))}
                </div>
              )
            ) : visibleTree.length === 0 && !state.creating ? (
              <EmptyState 
                onOpenFolder={openFolder} 
                isFolderOpen={!!state.folderPath} 
                onCreateFile={() => startCreating('file')} 
              />
            ) : (
              <div className="px-1" onClick={(e) => {
                if (e.target === e.currentTarget) setActiveExplorerPath(null)
              }}>
                {/* Pinned local items */}
                {state.pinnedLocalPaths.length > 0 && !isLocalSearching && (
                  <div
                    style={{
                      paddingLeft: '6px',
                      paddingRight: '6px',
                      marginBottom: '8px',
                      paddingBottom: '4px',
                      borderBottom: '1px solid var(--border-default)',
                    }}
                  >
                    <div
                      onClick={() => {
                        setIsPinnedLocalCollapsed((prev) => {
                          const next = !prev
                          window.api.storeSet('isPinnedLocalCollapsed', next).catch(() => {})
                          return next
                        })
                      }}
                      className="flex items-center justify-between px-2 py-1 text-[11px] font-semibold text-[var(--text-dim)] uppercase tracking-wider select-none cursor-pointer hover:text-[var(--text-primary)] rounded transition-colors"
                      style={{ marginBottom: '2px' }}
                    >
                      <div className="flex items-center gap-1.5">
                        <Pin size={11} className="opacity-70 rotate-45" />
                        <span>{t('sidebar.pinned')}</span>
                        <span className="text-[10px] opacity-60">({state.pinnedLocalPaths.length})</span>
                      </div>
                      <svg
                        width="10"
                        height="10"
                        viewBox="0 0 12 12"
                        style={{
                          transform: isPinnedLocalCollapsed ? 'rotate(90deg)' : 'rotate(0deg)',
                          transition: 'transform 0.15s',
                        }}
                        fill="currentColor"
                        className="opacity-70"
                      >
                        <path d="M2 4l4 4 4-4z" />
                      </svg>
                    </div>
                    {!isPinnedLocalCollapsed && (
                      <div className="flex flex-col gap-0.5">
                        {state.pinnedLocalPaths.map((pinnedPath, idx) => {
                          const entry = resolveFileEntry(pinnedPath)
                          return (
                            <div
                              key={`pinned-local-${pinnedPath}`}
                              draggable
                              onDragStart={(e) => {
                                e.stopPropagation()
                                e.dataTransfer.setData('application/x-type-club-pinned-local', String(idx))
                                e.dataTransfer.effectAllowed = 'move'
                              }}
                              onDragOver={(e) => {
                                if (e.dataTransfer.types.includes('application/x-type-club-pinned-local')) {
                                  e.preventDefault()
                                  e.stopPropagation()
                                  e.dataTransfer.dropEffect = 'move'
                                }
                              }}
                              onDrop={(e) => {
                                if (e.dataTransfer.types.includes('application/x-type-club-pinned-local')) {
                                  e.preventDefault()
                                  e.stopPropagation()
                                  const fromIdx = Number(e.dataTransfer.getData('application/x-type-club-pinned-local'))
                                  if (!isNaN(fromIdx) && fromIdx !== idx) {
                                    const next = [...state.pinnedLocalPaths]
                                    const [item] = next.splice(fromIdx, 1)
                                    next.splice(idx, 0, item)
                                    reorderPinnedLocalPaths(next)
                                  }
                                }
                              }}
                            >
                              <FileTreeItem
                                entry={entry}
                                depth={0}
                                isPinned={true}
                                onFileClick={(filePath, fileName) => {
                                  setSelectedFilePath(filePath)
                                  openFile(filePath, fileName)
                                }}
                                onContextMenu={handleContextMenu}
                                activeFilePath={activeTab?.filePath || null}
                                activeToc={state.activeToc || []}
                                expandedFolders={expandedFolders}
                                toggleFolderExpanded={toggleFolderExpanded}
                              />
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )}
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
                      onFileClick={(filePath, fileName) => {
                        setSelectedFilePath(filePath)
                        openFile(filePath, fileName)
                      }}
                      onContextMenu={handleContextMenu}
                      activeFilePath={activeTab?.filePath || null}
                      activeToc={state.activeToc || []}
                      expandedFolders={expandedFolders}
                      toggleFolderExpanded={toggleFolderExpanded}
                    />
                  ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Context menu — local */}
      {contextMenuMounted && (contextMenu || savedCtxMenu) && (() => {
        const menu = contextMenu || savedCtxMenu!
        return (
          <div
            className={`fixed bg-[var(--bg-elevated)] backdrop-blur-xl border border-[var(--border-strong)] rounded-lg shadow-xl z-50 py-0.5 flex flex-col text-[12px] text-[var(--text-secondary)] ${
              contextMenu ? 'animate-in fade-in zoom-in-95 duration-100 ease-out' : 'animate-out fade-out zoom-out-95 duration-100 ease-in fill-mode-forwards'
            }`}
            style={{ top: menu.y, left: menu.x, minWidth: '150px' }}
            onContextMenu={(e) => e.preventDefault()}
          >
            {menu.path === '__empty__' ? (
              <>
                <button className="menu-item enabled" onClick={() => { startCreating('file'); setContextMenu(null) }}>
                  {t('menu.file.newFile')}
                </button>
                <button className="menu-item enabled" onClick={() => { startCreating('folder'); setContextMenu(null) }}>
                  {t('menu.file.newFolder')}
                </button>
              </>
            ) : menu.path === '__online_empty__' ? (
              <button className="menu-item enabled" onClick={() => { startCreating('file'); setContextMenu(null) }}>
                {t('sidebar.newArticle')}
              </button>
            ) : menu.type === 'folder' ? (
              <>
                <button className="menu-item enabled" onClick={() => {
                  startCreating('file', menu.path)
                  setContextMenu(null)
                }}>
                  {t('sidebar.newFileHere')}
                </button>
                <button className="menu-item enabled" onClick={() => {
                  startCreating('folder', menu.path)
                  setContextMenu(null)
                }}>
                  {t('sidebar.newFolderHere')}
                </button>
                <div className="border-t border-[var(--border-default)] my-1 mx-1.5 opacity-80" />
                <button className="menu-item enabled" onClick={() => { startRenaming(menu.path, menu.type); setContextMenu(null) }}>
                  {t('sidebar.rename')}
                </button>
                <button className="menu-item enabled" onClick={() => {
                  navigator.clipboard.writeText(menu.path)
                  setContextMenu(null)
                }}>
                  {t('sidebar.copyPath')}
                </button>
                <div className="border-t border-[var(--border-default)] my-1 mx-1.5 opacity-80" />
                <button className="menu-item enabled" onClick={() => {
                  const isPinned = state.pinnedLocalPaths.some(p => normalizePath(p) === normalizePath(menu.path))
                  if (isPinned) unpinLocalPath(menu.path)
                  else pinLocalPath(menu.path)
                  setContextMenu(null)
                }}>
                  {state.pinnedLocalPaths.some(p => normalizePath(p) === normalizePath(menu.path)) ? t('sidebar.unpin') : t('sidebar.pin')}
                </button>
                <div className="border-t border-[var(--border-default)] my-1 mx-1.5 opacity-80" />
                <button className="menu-item enabled" style={{ color: 'var(--text-danger)' }} onClick={() => { deleteItem(menu.path, menu.type, menu.name); setContextMenu(null) }}>
                  {t('common.delete')}
                </button>
                <div className="border-t border-[var(--border-default)] my-1 mx-1.5 opacity-80" />
                <button className="menu-item enabled" onClick={() => { showInExplorer(menu.path); setContextMenu(null) }}>
                  {t('sidebar.showInExplorer')}
                </button>
              </>
            ) : (
              <>
                <button className="menu-item enabled" onClick={async () => {
                  try {
                    if (window.api?.copyFileToClipboard) {
                      await window.api.copyFileToClipboard(menu.path)
                    } else {
                      const content = await window.api.readFile(menu.path)
                      await navigator.clipboard.writeText(content)
                    }
                  } catch (err) { console.error('Ошибка копирования файла:', err) }
                  setContextMenu(null)
                }}>
                  {t('sidebar.copyContent')}
                </button>
                <button className="menu-item enabled" onClick={async () => {
                  try {
                    const content = await window.api.readFile(menu.path)
                    const sep = menu.path.includes('/') ? '/' : '\\'
                    const ext = menu.name.includes('.') ? menu.name.substring(menu.name.lastIndexOf('.')) : ''
                    const baseName = ext ? menu.name.substring(0, menu.name.lastIndexOf('.')) : menu.name
                    const dir = menu.path.substring(0, menu.path.lastIndexOf(sep))
                    const copyPath = dir + sep + baseName + ' копия' + ext
                    await window.api.writeFile(copyPath, content)
                    refreshFileTree()
                  } catch (err) { console.error('Ошибка дублирования файла:', err) }
                  setContextMenu(null)
                }}>
                  {t('sidebar.duplicate')}
                </button>
                <div className="border-t border-[var(--border-default)] my-1 mx-1.5 opacity-80" />
                {(() => {
                  const sep = menu.path.includes('/') ? '/' : '\\'
                  const parentDir = menu.path.substring(0, menu.path.lastIndexOf(sep)) || state.folderPath
                  return (
                    <>
                      <button className="menu-item enabled" onClick={() => {
                        if (parentDir) startCreating('file', parentDir)
                        setContextMenu(null)
                      }}>
                        {t('sidebar.newFileHere')}
                      </button>
                      <button className="menu-item enabled" onClick={() => {
                        if (parentDir) startCreating('folder', parentDir)
                        setContextMenu(null)
                      }}>
                        {t('sidebar.newFolderHere')}
                      </button>
                    </>
                  )
                })()}
                <div className="border-t border-[var(--border-default)] my-1 mx-1.5 opacity-80" />
                <button className="menu-item enabled" onClick={() => { startRenaming(menu.path, menu.type); setContextMenu(null) }}>
                  {t('sidebar.rename')}
                </button>
                <button className="menu-item enabled" onClick={() => {
                  navigator.clipboard.writeText(menu.path)
                  setContextMenu(null)
                }}>
                  {t('sidebar.copyPath')}
                </button>
                <div className="border-t border-[var(--border-default)] my-1 mx-1.5 opacity-80" />
                <button className="menu-item enabled" onClick={() => {
                  const isPinned = state.pinnedLocalPaths.some(p => normalizePath(p) === normalizePath(menu.path))
                  if (isPinned) unpinLocalPath(menu.path)
                  else pinLocalPath(menu.path)
                  setContextMenu(null)
                }}>
                  {state.pinnedLocalPaths.some(p => normalizePath(p) === normalizePath(menu.path)) ? t('sidebar.unpin') : t('sidebar.pin')}
                </button>
                <div className="border-t border-[var(--border-default)] my-1 mx-1.5 opacity-80" />
                <button className="menu-item enabled" style={{ color: 'var(--text-danger)' }} onClick={() => { deleteItem(menu.path, menu.type, menu.name); setContextMenu(null) }}>
                  {t('common.delete')}
                </button>
                <div className="border-t border-[var(--border-default)] my-1 mx-1.5 opacity-80" />
                <button className="menu-item enabled" onClick={() => { showInExplorer(menu.path); setContextMenu(null) }}>
                  {t('sidebar.showInExplorer')}
                </button>
              </>
            )}
          </div>
        )
      })()}

      {/* Context menu — online articles */}
      {onlineMenuMounted && (onlineMenu || savedOnlineMenu) && (() => {
        const menu = onlineMenu || savedOnlineMenu!
        const isAuthor = !menu.article.my_roles || menu.article.my_roles.includes('author')
        const isPinned = state.pinnedOnlineArticleIds.includes(menu.article.id)
        return (
          <div
            className={`fixed bg-[var(--bg-elevated)] backdrop-blur-xl border border-[var(--border-strong)] rounded-lg shadow-xl z-50 py-0.5 flex flex-col text-[12px] text-[var(--text-secondary)] ${
              onlineMenu ? 'animate-in fade-in zoom-in-95 duration-100 ease-out' : 'animate-out fade-out zoom-out-95 duration-100 ease-in fill-mode-forwards'
            }`}
            style={{ top: menu.y, left: menu.x, minWidth: '150px' }}
            onContextMenu={(e) => e.preventDefault()}
          >
            <button className="menu-item enabled" onClick={() => {
              if (isPinned) unpinOnlineArticle(menu.article.id)
              else pinOnlineArticle(menu.article.id)
              setOnlineMenu(null)
            }}>
              {isPinned ? t('sidebar.unpin') : t('sidebar.pin')}
            </button>
            <button className="menu-item enabled" onClick={() => {
              startCreating('file')
              setOnlineMenu(null)
            }}>
              {t('sidebar.createArticle')}
            </button>
            <div className="border-t border-[var(--border-default)] my-1 mx-1.5 opacity-80" />
            {isAuthor && (
              <button className="menu-item enabled" onClick={() => {
                startRenaming(`__online__/${menu.article.id}`, 'file')
                setOnlineMenu(null)
              }}>
                {t('sidebar.rename')}
              </button>
            )}
            <button className="menu-item enabled" onClick={() => {
              const authorNick = menu.article.author_nickname || onlineUsername
              navigator.clipboard.writeText(`${config.siteUrl}/${authorNick}/${menu.article.slug}`)
              setOnlineMenu(null)
            }}>
              {t('sidebar.copyLink')}
            </button>
            {isAuthor && (
              <button className="menu-item enabled" onClick={() => {
                duplicateOnlineArticle(menu.article.id)
                setOnlineMenu(null)
              }}>
                {t('sidebar.duplicate')}
              </button>
            )}
            {isAuthor && (
              <>
                <div className="border-t border-[var(--border-default)] my-1 mx-1.5 opacity-80" />
                <button className="menu-item enabled" style={{ color: 'var(--text-danger)' }} onClick={() => {
                  deleteOnlineArticle(menu.article.id)
                  setOnlineMenu(null)
                }}>
                  {t('common.delete')}
                </button>
              </>
            )}
            <div className="border-t border-[var(--border-default)] my-1 mx-1.5 opacity-80" />
            <button className="menu-item enabled" onClick={() => {
              const authorNick = menu.article.author_nickname || onlineUsername
              window.api.openExternal(`${config.siteUrl}/${authorNick}/${menu.article.slug}`)
              setOnlineMenu(null)
            }}>
              {t('sidebar.openInBrowser')}
            </button>
            <button className="menu-item enabled" onClick={async () => {
              try {
                const { articlesApi } = await import('../api')
                const article = await articlesApi.get(menu.article.id)
                await window.api.saveFileAs(
                  article.content,
                  menu.article.title + '.md'
                )
              } catch (err) { console.error('Ошибка скачивания:', err) }
              setOnlineMenu(null)
            }}>
              {t('sidebar.download')}
            </button>
          </div>
        )
      })()}
    </div>
  )
}

// ── Online Article Item ──

function OnlineArticleItem({ article, activeTabArticleId, activeToc, onOpen, onContextMenu, onRename }: {
  article: ArticleListItem
  activeTabArticleId: number | undefined
  activeToc: TocItem[]
  onOpen: () => void
  onContextMenu: (e: React.MouseEvent) => void
  onRename: (title: string) => void
}) {
  const { state, dispatch, t } = useEditor()
  const isActive = activeTabArticleId === article.id
  const isRenaming = state.renaming?.path === `__online__/${article.id}`
  const [isTocOpen, setIsTocOpen] = useState(true)

  if (isRenaming) {
    return (
      <InlineRenameInput
        initialValue={article.title}
        depth={0}
        iconType="globe"
        onSubmit={(name) => { onRename(name); dispatch({ type: 'STOP_RENAMING' }) }}
        onCancel={() => dispatch({ type: 'STOP_RENAMING' })}
      />
    )
  }

  return (
    <div>
      <div className={`w-full flex items-center gap-1.5 text-[13px] rounded transition-colors group ${
        isActive ? 'bg-[var(--bg-hover)] text-[var(--text-primary)]' : 'text-[var(--text-muted)] hover:bg-[var(--bg-hover)]'
      }`} style={{ paddingLeft: isActive && state.tocLayoutMode === 'separate' && activeToc.length > 0 ? '8px' : '26px', paddingRight: '8px' }}>
        {isActive && state.tocLayoutMode === 'separate' && activeToc.length > 0 && (
          <button onClick={() => setIsTocOpen(!isTocOpen)} className="p-1 rounded hover:bg-[var(--border-default)]">
            <svg width="10" height="10" viewBox="0 0 12 12" className={`transition-transform text-[var(--text-dim)] ${isTocOpen ? 'rotate-90' : ''}`} fill="currentColor">
              <path d="M4 2l4 4-4 4z" />
            </svg>
          </button>
        )}
        <button
          onContextMenu={onContextMenu}
          onClick={onOpen}
          className="flex-1 flex items-center gap-1.5 overflow-hidden"
          style={{ paddingTop: '5px', paddingBottom: '5px' }}
          title={`${article.title}\n${article.author_nickname && article.slug ? `${config.siteUrl}/${article.author_nickname}/${article.slug}` : `${config.siteUrl}/articles/${article.id}`}`}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0 text-[var(--accent)]">
            <circle cx="12" cy="12" r="10" />
            <line x1="2" y1="12" x2="22" y2="12" />
            <path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" />
          </svg>
          <span className="truncate">{article.title}</span>
          {article.my_roles?.includes('co_author') && (
            <span className="role-badge co_author ml-auto flex-shrink-0">{t('role.co_author')}</span>
          )}
          {!article.my_roles?.includes('co_author') && article.my_roles?.includes('editor') && (
            <span className="role-badge editor ml-auto flex-shrink-0">{t('role.editor')}</span>
          )}
        </button>
      </div>
      <div className={`grid transition-all duration-200 ease-out ${isActive && state.tocLayoutMode === 'separate' && isTocOpen && activeToc.length > 0 ? 'grid-rows-[1fr] opacity-100 mt-0.5' : 'grid-rows-[0fr] opacity-0'}`}>
        <div className="overflow-hidden">
          {activeToc.map((toc) => (
            <button
              key={toc.id}
              onClick={() => window.dispatchEvent(new CustomEvent('editor-scroll-to', { detail: { pos: toc.pos } }))}
              className="w-full text-left truncate text-[12px] text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] rounded transition-colors"
              style={{
                paddingTop: '3px', paddingBottom: '3px',
                paddingLeft: `${26 + (toc.level - 1) * 12}px`,
                paddingRight: '8px'
              }}
              title={toc.text}
            >
              {toc.text}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Online Create Input ──

function OnlineCreateInput({ onSubmit, onCancel }: {
  onSubmit: (name: string) => void; onCancel: () => void
}) {
  const { t } = useEditor()
  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => { inputRef.current?.focus() }, [])
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') { const name = e.currentTarget.value.trim(); if (name) onSubmit(name); else onCancel() }
    else if (e.key === 'Escape') onCancel()
  }
  return (
    <div className="flex items-center gap-1.5 rounded" style={{ paddingTop: '2px', paddingBottom: '2px', paddingLeft: '26px', paddingRight: '8px' }}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0 text-[var(--accent)]">
        <circle cx="12" cy="12" r="10" />
        <line x1="2" y1="12" x2="22" y2="12" />
        <path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" />
      </svg>
      <input ref={inputRef} type="text"
        className="flex-1 bg-[var(--bg-hover)] text-[var(--text-primary)] text-[13px] border border-[var(--accent)] rounded px-1.5 py-0.5 outline-none"
        placeholder={t('sidebar.articleTitlePlaceholder')}
        onKeyDown={handleKeyDown} onBlur={onCancel}
      />
    </div>
  )
}

// ── Shared Components ──

function EmptyState({ onOpenFolder, onCreateFile, isFolderOpen, isOnline, onCreateArticle }: {
  onOpenFolder?: () => void; onCreateFile?: () => void; isFolderOpen?: boolean;
  isOnline?: boolean; onCreateArticle?: () => void;
}) {
  const { t } = useEditor()
  if (isOnline) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center" style={{ gap: '20px', padding: '0 24px' }}>
        <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-disabled)' }}>
          <circle cx="12" cy="12" r="10" />
          <line x1="2" y1="12" x2="22" y2="12" />
          <path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" />
        </svg>
        <p style={{ fontSize: '13px', color: 'var(--text-dim)', margin: 0 }}>{t('sidebar.noArticles')}</p>
        {onCreateArticle && (
          <button
            onClick={onCreateArticle}
            style={{
              padding: '8px 20px', fontSize: '13px', fontWeight: 500,
              background: 'var(--accent)', color: 'white', border: 'none',
              borderRadius: '6px', cursor: 'pointer', transition: 'background 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--accent-hover)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'var(--accent)')}
          >
            {t('sidebar.createArticle')}
          </button>
        )}
      </div>
    )
  }
  return (
    <div className="flex flex-col items-center justify-center h-full text-center" style={{ gap: '20px', padding: '0 24px' }}>
      <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-disabled)' }}>
        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
      </svg>
      <p style={{ fontSize: '13px', color: 'var(--text-dim)', margin: 0 }}>
        {isFolderOpen ? t('sidebar.folderEmpty') : t('sidebar.noOpenFolder')}
      </p>
      <button
        onClick={isFolderOpen ? onCreateFile : onOpenFolder}
        style={{
          padding: '8px 20px', fontSize: '13px', fontWeight: 500,
          background: 'var(--accent)', color: 'white', border: 'none',
          borderRadius: '6px', cursor: 'pointer', transition: 'background 0.15s',
        }}
        onMouseEnter={e => (e.currentTarget.style.background = 'var(--accent-hover)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'var(--accent)')}
      >
        {isFolderOpen ? t('sidebar.createFile') : t('sidebar.openFolder')}
      </button>
    </div>
  )
}

function InlineRenameInput({ initialValue, depth, iconType = 'file', onSubmit, onCancel }: {
  initialValue: string; depth: number; iconType?: 'file' | 'folder' | 'globe'; onSubmit: (name: string) => void; onCancel: () => void
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
      {iconType === 'folder' ? (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0 text-[var(--text-dim)]">
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
        </svg>
      ) : iconType === 'globe' ? (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0 text-[var(--accent)]">
          <circle cx="12" cy="12" r="10" />
          <line x1="2" y1="12" x2="22" y2="12" />
          <path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" />
        </svg>
      ) : (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0 text-[var(--accent)]">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
        </svg>
      )}
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
  const { t } = useEditor()
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
        placeholder={type === 'folder' ? t('sidebar.folderNamePlaceholder') : t('sidebar.fileNamePlaceholder')}
        onKeyDown={handleKeyDown} onBlur={onCancel}
      />
    </div>
  )
}

function FileTreeItem({ entry, depth, onFileClick, onContextMenu, activeFilePath, activeToc, expandedFolders, toggleFolderExpanded, isPinned = false }: {
  entry: FileEntry; depth: number;
  onFileClick: (filePath: string, fileName: string) => void;
  onContextMenu: (e: React.MouseEvent, path: string, type: 'file' | 'folder', name: string) => void;
  activeFilePath: string | null;
  activeToc: TocItem[];
  expandedFolders: Record<string, boolean>;
  toggleFolderExpanded: (path: string, defaultOpen: boolean) => void;
  isPinned?: boolean;
}) {
  const { state, dispatch, createFile, createFolder, setActiveExplorerPath, renameItem, moveItem } = useEditor()
  const defaultOpen = depth < 1
  const isOpen = expandedFolders[entry.path] ?? defaultOpen
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
    if (state.creating?.targetPath === entry.path && !isOpen) {
      toggleFolderExpanded(entry.path, defaultOpen)
    }
  }, [state.creating?.targetPath, entry.path, isOpen, toggleFolderExpanded, defaultOpen])

  const isRenaming = state.renaming?.path === entry.path

  if (entry.isDirectory) {
    return (
      <div>
        {isRenaming ? (
          <InlineRenameInput
            initialValue={entry.name}
            depth={depth}
            iconType="folder"
            onSubmit={(name) => renameItem(entry.path, name, 'folder')}
            onCancel={() => dispatch({ type: 'STOP_RENAMING' })}
          />
        ) : (
          <button
            draggable={!isPinned}
            onDragStart={!isPinned ? handleDragStart : undefined}
            onDragOver={!isPinned ? handleDragOver : undefined}
            onDragEnter={!isPinned ? handleDragEnter : undefined}
            onDragLeave={!isPinned ? handleDragLeave : undefined}
            onDrop={!isPinned ? handleDrop : undefined}
            onContextMenu={(e) => onContextMenu(e, entry.path, 'folder', entry.name)}
            onClick={() => {
              setActiveExplorerPath(entry.path)
              toggleFolderExpanded(entry.path, defaultOpen)
            }}
            className={`w-full flex items-center gap-1.5 text-[13px] rounded transition-colors ${
               isDragOver ? 'bg-[var(--accent)] text-white' : isFolderActive ? 'bg-[var(--bg-hover)] text-[var(--text-primary)]' : 'text-[var(--text-muted)] hover:bg-[var(--bg-hover)]'
              }`}
            style={{ paddingTop: '5px', paddingBottom: '5px', paddingLeft: `${depth * 12 + 8}px`, paddingRight: '8px' }}
            title={`${entry.name}\n${entry.path}`}
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
              <FileTreeItem
                key={child.path}
                entry={child}
                depth={depth + 1}
                onFileClick={onFileClick}
                onContextMenu={onContextMenu}
                activeFilePath={activeFilePath}
                activeToc={activeToc}
                expandedFolders={expandedFolders}
                toggleFolderExpanded={toggleFolderExpanded}
              />
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
          iconType="file"
          onSubmit={(name) => renameItem(entry.path, name, 'file')}
          onCancel={() => dispatch({ type: 'STOP_RENAMING' })}
        />
      ) : (
        <div 
          draggable={!isPinned}
          data-sidebar-file={entry.path}
          onDragStart={!isPinned ? handleDragStart : undefined}
          onDragOver={!isPinned ? handleDragOver : undefined}
          onDragEnter={!isPinned ? handleDragEnter : undefined}
          onDragLeave={!isPinned ? handleDragLeave : undefined}
          onDrop={!isPinned ? handleDrop : undefined}
          className={`w-full flex items-center gap-1.5 text-[13px] rounded transition-colors group ${
            isDragOver ? 'bg-[var(--accent)] text-white' : isActiveFile ? 'bg-[var(--bg-hover)] text-[var(--text-primary)]' : 'text-[var(--text-muted)] hover:bg-[var(--bg-hover)]'
          }`} style={{ paddingLeft: `${depth * 12 + (isActiveFile && state.tocLayoutMode === 'separate' && activeToc.length > 0 ? 8 : 26)}px`, paddingRight: '8px' }}>
          {isActiveFile && state.tocLayoutMode === 'separate' && activeToc.length > 0 && (
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
            title={`${entry.name}\n${entry.path}`}
          >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`flex-shrink-0 ${isDragOver ? 'text-white' : 'text-[var(--accent)]'}`}>
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
          <span className="truncate">{entry.name}</span>
        </button>
      </div>
      )}
      <div className={`grid transition-all duration-200 ease-out ${isActiveFile && state.tocLayoutMode === 'separate' && isTocOpen && activeToc.length > 0 ? 'grid-rows-[1fr] opacity-100 mt-0.5' : 'grid-rows-[0fr] opacity-0'}`}>
        <div className="overflow-hidden">
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
              {toc.text}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
