import { useState, useRef } from 'react'
import { AlertTriangle, X } from 'lucide-react'

interface RawModeWarningModalProps {
  onConfirm: () => void
  onCancel: () => void
}

export const STORAGE_KEY_HIDE_RAW_WARNING = 'typeclub_hide_raw_collab_warning'

export function RawModeWarningModal({ onConfirm, onCancel }: RawModeWarningModalProps) {
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
            <h3 className="modal-title" style={{ fontSize: '15px', fontWeight: 600 }}>Переход в Raw-режим</h3>
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
          В Raw-режиме совместная работа приостанавливается: ваши изменения зафиксируются локально и отправятся соавторам только после возврата в режим <strong style={{ color: 'var(--text-primary)' }}>Seamless</strong> или <strong style={{ color: 'var(--text-primary)' }}>Preview</strong>.
          Изменения соавторов, сделанные в это время, могут быть перезаписаны.
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
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Больше не показывать</span>
        </label>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
          <button className="btn-secondary" onClick={onCancel} style={{ padding: '8px 16px', minWidth: '80px' }}>
            Отмена
          </button>
          <button className="btn-primary" onClick={handleConfirm} style={{ width: 'auto', padding: '8px 20px' }}>
            Перейти в Raw
          </button>
        </div>
      </div>
    </div>
  )
}
