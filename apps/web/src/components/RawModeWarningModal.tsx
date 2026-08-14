import { useState } from "react";
import { AlertTriangle, X } from "lucide-react";
import { useLanguage } from "../context/LanguageContext";

interface RawModeWarningModalProps {
  onConfirm: () => void;
  onCancel: () => void;
}

export const STORAGE_KEY_HIDE_RAW_WARNING = "typeclub_hide_raw_collab_warning";

export default function RawModeWarningModal({ onConfirm, onCancel }: RawModeWarningModalProps) {
  const { t } = useLanguage();
  const [dontShowAgain, setDontShowAgain] = useState(false);

  const handleConfirm = () => {
    if (dontShowAgain) {
      localStorage.setItem(STORAGE_KEY_HIDE_RAW_WARNING, "true");
    }
    onConfirm();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onCancel}>
      <div
        className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md p-6 mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 text-amber-600 dark:text-amber-500">
            <AlertTriangle size={22} />
            <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">{t('rawWarning.title')}</h3>
          </div>
          <button onClick={onCancel} className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400">
            <X size={18} />
          </button>
        </div>

        <p className="text-sm text-gray-600 dark:text-gray-300 mb-4 leading-relaxed">
          {t('rawWarning.message1')} {t('rawWarning.message2')}
        </p>

        <label className="flex items-center gap-2 mb-6 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={dontShowAgain}
            onChange={(e) => setDontShowAgain(e.target.checked)}
            className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <span className="text-xs text-gray-500 dark:text-gray-400">{t('rawWarning.dontShowAgain')}</span>
        </label>

        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium rounded-lg border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            {t('common.cancel')}
          </button>
          <button
            onClick={handleConfirm}
            className="px-4 py-2 text-sm font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700"
          >
            {t('rawWarning.confirm')}
          </button>
        </div>
      </div>
    </div>
  );
}
