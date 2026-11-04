import { useState, useRef, useEffect } from "react";
import { X, Link as LinkIcon, Upload, Image as ImageIcon } from "lucide-react";
import { useLanguage } from "../context/LanguageContext";

interface ChangeImageSourceModalProps {
  currentSrc: string;
  onClose: () => void;
  onApply: (newSrc: string) => void;
}

export function ChangeImageSourceModal({
  currentSrc,
  onClose,
  onApply,
}: ChangeImageSourceModalProps) {
  const { t } = useLanguage();
  const [tab, setTab] = useState<"url" | "file">("url");
  const [url, setUrl] = useState(currentSrc.startsWith("data:") ? "" : currentSrc);
  const [previewSrc, setPreviewSrc] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const handleUrlPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const items = e.clipboardData?.items;
    if (items) {
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith("image/")) {
          const file = items[i].getAsFile();
          if (file) {
            e.preventDefault();
            const reader = new FileReader();
            reader.onload = () => {
              const dataUrl = reader.result as string;
              setPreviewSrc(dataUrl);
              setTab("file");
            };
            reader.readAsDataURL(file);
            return;
          }
        }
      }
    }

    const pastedText = e.clipboardData?.getData("text") || "";
    if (pastedText.trim().startsWith("data:image/")) {
      e.preventDefault();
      setPreviewSrc(pastedText.trim());
      setTab("file");
      return;
    }
  };

  const handleApplyUrl = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = url.trim();
    if (trimmed) {
      onApply(trimmed);
      onClose();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setPreviewSrc(result);
    };
    reader.readAsDataURL(file);
  };

  const handleApplyFile = () => {
    if (previewSrc) {
      onApply(previewSrc);
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-xl overflow-hidden animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-2 font-semibold text-sm text-gray-900 dark:text-gray-100">
            <ImageIcon className="w-4 h-4 text-blue-500" />
            <span>{t("image.changeSource.title") || "Change Image Source"}</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/20 px-5 pt-3 gap-2">
          <button
            type="button"
            onClick={() => setTab("url")}
            className={`flex items-center gap-1.5 pb-2.5 px-3 text-xs font-medium border-b-2 transition-colors ${
              tab === "url"
                ? "border-blue-600 text-blue-600 dark:text-blue-400"
                : "border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
            }`}
          >
            <LinkIcon className="w-3.5 h-3.5" />
            <span>{t("image.changeSource.byUrl") || "By URL"}</span>
          </button>
          <button
            type="button"
            onClick={() => setTab("file")}
            className={`flex items-center gap-1.5 pb-2.5 px-3 text-xs font-medium border-b-2 transition-colors ${
              tab === "file"
                ? "border-blue-600 text-blue-600 dark:text-blue-400"
                : "border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            <span>{t("image.changeSource.byFile") || "Upload file"}</span>
          </button>
        </div>

        {/* Content */}
        <div className="p-5">
          {tab === "url" ? (
            <form onSubmit={handleApplyUrl} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  {t("image.changeSource.byUrl") || "Image URL"}
                </label>
                <input
                  type="text"
                  autoFocus
                  required
                  placeholder={t("image.changeSource.urlPlaceholder") || "https://example.com/image.png"}
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  onPaste={handleUrlPaste}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                >
                  {t("image.changeSource.cancel") || "Cancel"}
                </button>
                <button
                  type="submit"
                  disabled={!url.trim()}
                  className="px-4 py-2 rounded-xl text-xs font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {t("image.changeSource.apply") || "Apply"}
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-4">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />

              {previewSrc ? (
                <div className="flex flex-col items-center gap-3">
                  <div className="max-h-48 overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700">
                    <img src={previewSrc} alt="Preview" className="max-h-48 object-contain" />
                  </div>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="text-xs text-blue-600 hover:underline"
                  >
                    Выбрать другой файл
                  </button>
                </div>
              ) : (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-2xl p-6 text-center cursor-pointer hover:border-blue-500 dark:hover:border-blue-500 transition-colors"
                >
                  <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">
                    {t("image.changeSource.chooseFile") || "Choose image file from computer"}
                  </p>
                  <span className="text-[11px] text-gray-400">PNG, JPG, WEBP, GIF, SVG</span>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                >
                  {t("image.changeSource.cancel") || "Cancel"}
                </button>
                <button
                  type="button"
                  disabled={!previewSrc}
                  onClick={handleApplyFile}
                  className="px-4 py-2 rounded-xl text-xs font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {t("image.changeSource.apply") || "Apply"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
