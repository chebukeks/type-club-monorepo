import { useState, useRef, useEffect } from 'react'
import { useEditor } from '../context/EditorContext'
import { generateExportHtml } from '../editor/markdownConfig'
import type { Tab } from '../types'

export function MenuBar() {
  const { state } = useEditor()
  const { activeTabId, tabs } = state
  const [openMenu, setOpenMenu] = useState<string | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  // Закрытие меню при клике вне
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpenMenu(null)
      }
    }
    if (openMenu) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [openMenu])

  const toggleMenu = (menuName: string) => {
    if (openMenu === menuName) {
      setOpenMenu(null)
    } else {
      setOpenMenu(menuName)
    }
  }

  const handleExportHtml = async () => {
    setOpenMenu(null)
    if (!activeTabId) return
    const activeTab = tabs.find((t: Tab) => t.id === activeTabId)
    if (!activeTab) return

    const htmlContent = generateExportHtml(activeTab.content)
    const defaultName = activeTab.fileName.replace(/\.md$/i, '.html')
    await window.api.exportHtml(htmlContent, defaultName)
  }

  const handleExportPdf = async () => {
    setOpenMenu(null)
    if (!activeTabId) return
    const activeTab = tabs.find((t: Tab) => t.id === activeTabId)
    if (!activeTab) return

    const htmlContent = generateExportHtml(activeTab.content)
    const defaultName = activeTab.fileName.replace(/\.md$/i, '.pdf')
    await window.api.exportPdf(htmlContent, defaultName)
  }

  return (
    <div
      className="flex items-center text-[13px] text-[#cccccc] select-none"
      style={{
        WebkitAppRegion: 'no-drag',
        marginLeft: '0px',
      } as React.CSSProperties}
      ref={menuRef}
    >
      {/* Меню File */}
      <div className="relative">
        <button
          onClick={() => toggleMenu('file')}
          className={`rounded transition-colors ${openMenu === 'file' ? 'bg-[#313238] text-white' : 'hover:bg-[#313238]'
            }`}
          style={{ padding: '2px 12px' }}
        >
          File
        </button>

        {openMenu === 'file' && (
          <div className="absolute top-full left-0 mt-1 w-48 py-1 bg-[#252526] border border-[#454545] rounded-md shadow-lg z-50">
            {/* Disabled if no active tab */}
            <div
              className={`px-4 py-1.5 flex justify-between items-center ${activeTabId ? 'hover:bg-[#04395e] hover:text-white cursor-pointer' : 'text-[#6a6e78] cursor-default'}`}
              onClick={activeTabId ? handleExportHtml : undefined}
            >
              <span>Export to HTML...</span>
            </div>
            <div
              className={`px-4 py-1.5 flex justify-between items-center ${activeTabId ? 'hover:bg-[#04395e] hover:text-white cursor-pointer' : 'text-[#6a6e78] cursor-default'}`}
              onClick={activeTabId ? handleExportPdf : undefined}
            >
              <span>Export to PDF...</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
