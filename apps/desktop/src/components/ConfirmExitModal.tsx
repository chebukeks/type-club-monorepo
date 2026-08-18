/**
 * ConfirmExitModal.tsx — Кастомное модальное окно подтверждения выхода при несохранённых изменениях.
 * Заменяет дефолтный диалог Windows / Electron согласно DESIGN.md.
 */
import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { AlertTriangle, FileText } from 'lucide-react'
import { useEditor } from '../context/EditorContext'

interface ConfirmExitModalProps {
  isOpen: boolean
  fileNames: string[]
  onSave: () => void
  onDiscard: () => void
  onCancel: () => void
}

export function ConfirmExitModal({
  isOpen,
  fileNames,
  onSave,
  onDiscard,
  onCancel,
}: ConfirmExitModalProps) {
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
        onSave()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onSave, onCancel])

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
        className="w-[430px] max-w-[90vw] bg-[var(--bg-elevated)] backdrop-blur-xl border border-[var(--border-strong)] rounded-2xl shadow-2xl flex flex-col animate-in zoom-in-95 duration-150"
        style={{ padding: '22px 24px', gap: '18px' }}
      >
        {/* Header */}
        <div className="flex items-center" style={{ gap: '14px' }}>
          <div
            className="rounded-xl bg-[var(--accent)]/10 text-[var(--accent)] flex items-center justify-center flex-shrink-0 border border-[var(--accent)]/20"
            style={{ width: '40px', height: '40px' }}
          >
            <AlertTriangle size={20} />
          </div>
          <div>
            <h3 className="text-[15px] font-semibold text-[var(--text-primary)] leading-tight">
              {t('dialog.exit.title')}
            </h3>
            <p className="text-[12px] text-[var(--text-muted)] mt-1">
              {t('dialog.exit.question')}
            </p>
          </div>
        </div>

        {/* Unsaved Files List */}
        <div className="flex flex-col" style={{ gap: '6px' }}>
          <span className="text-[12px] font-medium text-[var(--text-muted)]">
            {t('dialog.exit.message')}
          </span>
          <div
            className="max-h-36 overflow-y-auto bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-xl flex flex-col"
            style={{ padding: '6px', gap: '4px' }}
          >
            {fileNames.map((fn, idx) => (
              <div
                key={idx}
                className="flex items-center rounded-lg text-[12.5px] text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors"
                style={{ padding: '6px 10px', gap: '8px' }}
              >
                <FileText size={14} className="text-[var(--accent)] flex-shrink-0" />
                <span className="truncate flex-1 font-medium">{fn}</span>
                <span className="w-2 h-2 rounded-full bg-[var(--accent)] flex-shrink-0" />
              </div>
            ))}
          </div>
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
            onClick={onDiscard}
            className="rounded-lg text-[13px] font-medium bg-[var(--bg-surface)] border border-[var(--border-default)] text-[var(--text-danger)] hover:bg-[var(--bg-hover)] active:scale-[0.98] transition-all cursor-pointer"
            style={{ padding: '8px 16px' }}
          >
            {t('dialog.exit.discard')}
          </button>
          <button
            onClick={onSave}
            className="rounded-lg text-[13px] font-medium bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)] active:scale-[0.98] transition-all shadow-xs cursor-pointer"
            style={{ padding: '8px 18px' }}
          >
            {t('common.save')}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
