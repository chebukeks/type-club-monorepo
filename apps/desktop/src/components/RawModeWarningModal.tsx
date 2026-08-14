import { useState, useRef } from 'react'
import { AlertTriangle, X } from 'lucide-react'
import { useEditor } from '../context/EditorContext'

interface RawModeWarningModalProps {
  onConfirm: () => void
  onCancel: () => void
}

export const STORAGE_KEY_HIDE_RAW_WARNING = 'typeclub_hide_raw_collab_warning'

export function RawModeWarningModal({ onConfirm, onCancel }: RawModeWarningModalProps) {
  const { t } = useEditor()
  const [dontShowAgain, setDontShowAgain] = useState(false)
  const overlayMouseDownRef = useRef(false)

  const handleOverlayMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    overlayMouseDownRef.current = (e.target === e.currentTarget)
  }

  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget && overlayMouseDownRef.current) {
      onCancel()
    }
    overlayMouseDownRef.current = false
  }

  const handleConfirm = async () => {
    if (dontShowAgain) {
      try {
        await window.api.storeSet(STORAGE_KEY_HIDE_RAW_WARNING, true)
      } catch {
        localStorage.setItem(STORAGE_KEY_HIDE_RAW_WARNING, 'true')
      }
    }
    onConfirm()
  }

  return (
    <div className="modal-overlay" style={{ zIndex: 99999 }} onMouseDown={handleOverlayMouseDown} onClick={handleOverlayClick}>
      <div className="modal-panel" style={{ maxWidth: '440px' }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header" style={{ marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#f59e0b' }}>
            <AlertTriangle size={20} />
            <h3 className="modal-title" style={{ fontSize: '15px', fontWeight: 600 }}>{t('rawWarning.title')}</h3>
          </div>
          <button onClick={onCancel} className="modal-close">
            <X size={18} />
          </button>
        </div>

        <p style={{
          fontSize: '13px',
          color: 'var(--text-secondary)',
          lineHeight: '1.6',
          marginBottom: '16px',
        }}>
          {t('rawWarning.message1')} {t('rawWarning.message2')}
        </p>

        <label style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          marginBottom: '20px',
          cursor: 'pointer',
          userSelect: 'none',
        }}>
          <input
            type="checkbox"
            checked={dontShowAgain}
            onChange={(e) => setDontShowAgain(e.target.checked)}
            style={{ width: '15px', height: '15px', accentColor: 'var(--accent)', cursor: 'pointer' }}
          />
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{t('rawWarning.dontShowAgain')}</span>
        </label>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
          <button className="btn-secondary" onClick={onCancel} style={{ padding: '8px 16px', minWidth: '80px' }}>
            {t('common.cancel')}
          </button>
          <button className="btn-primary" onClick={handleConfirm} style={{ width: 'auto', padding: '8px 20px' }}>
            {t('rawWarning.confirm')}
          </button>
        </div>
      </div>
    </div>
  )
}
