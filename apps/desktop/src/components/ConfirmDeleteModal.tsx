/**
 * ConfirmDeleteModal.tsx — Кастомное модальное окно подтверждения удаления файла/папки.
 * Заменяет дефолтный системный диалог ОС согласно DESIGN.md.
 */
import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Trash2, AlertCircle } from 'lucide-react'
import { useEditor } from '../context/EditorContext'

interface ConfirmDeleteModalProps {
  isOpen: boolean
  itemName: string
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDeleteModal({
  isOpen,
  itemName,
  onConfirm,
  onCancel,
}: ConfirmDeleteModalProps) {
  const { t } = useEditor()
  const modalRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        onCancel()
      } else if (e.key === 'Enter') {
        e.preventDefault()
        e.stopPropagation()
        onConfirm()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onConfirm, onCancel])

  if (!isOpen) return null

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-xs select-none animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel()
      }}
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        className="w-[400px] max-w-[90vw] bg-[var(--bg-elevated)] backdrop-blur-xl border border-[var(--border-strong)] rounded-2xl shadow-2xl flex flex-col animate-in zoom-in-95 duration-150"
        style={{ padding: '22px 24px', gap: '18px' }}
      >
        {/* Header */}
        <div className="flex items-center" style={{ gap: '14px' }}>
          <div
            className="rounded-xl bg-red-500/10 text-[var(--text-danger)] flex items-center justify-center flex-shrink-0 border border-red-500/20"
            style={{ width: '40px', height: '40px' }}
          >
            <Trash2 size={20} />
          </div>
          <div>
            <h3 className="text-[15px] font-semibold text-[var(--text-primary)] leading-tight">
              {t('dialog.delete.title')}
            </h3>
            <p className="text-[12px] text-[var(--text-muted)] mt-1">
              {t('dialog.delete.detail')}
            </p>
          </div>
        </div>

        {/* Message */}
        <div
          className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-xl text-[13px] text-[var(--text-secondary)] break-all flex items-start"
          style={{ padding: '12px 14px', gap: '10px' }}
        >
          <AlertCircle size={16} className="text-[var(--text-muted)] flex-shrink-0 mt-0.5" />
          <span className="leading-snug">
            {t('dialog.delete.message', { name: itemName })}
          </span>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end" style={{ gap: '10px', paddingTop: '4px' }}>
          <button
            onClick={onCancel}
            className="rounded-lg text-[13px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] border border-transparent transition-colors cursor-pointer"
            style={{ padding: '8px 16px' }}
          >
            {t('common.cancel')}
          </button>
          <button
            onClick={onConfirm}
            className="rounded-lg text-[13px] font-medium bg-[var(--text-danger)] text-white hover:opacity-90 active:scale-[0.98] transition-all shadow-xs cursor-pointer"
            style={{ padding: '8px 18px' }}
          >
            {t('common.delete')}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
