import { useState, useRef, useEffect } from "react";
import { X, Link as LinkIcon, Upload, Image as ImageIcon } from "lucide-react";
import { useEditor } from "../context/EditorContext";

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
  const { t } = useEditor();
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
      className="modal-overlay"
      onClick={onClose}
      style={{ zIndex: 100 }}
    >
      <div
        className="modal-panel"
        style={{ maxWidth: "460px", padding: 0, overflow: "hidden" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "14px 18px",
            borderBottom: "1px solid var(--border-color)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: 600, fontSize: "13px", color: "var(--text-primary)" }}>
            <ImageIcon style={{ width: 16, height: 16, color: "var(--accent)" }} />
            <span>{t("image.changeSource.title") || "Change Image Source"}</span>
          </div>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 4 }}
          >
            <X style={{ width: 16, height: 16 }} />
          </button>
        </div>

        {/* Tabs */}
        <div
          style={{
            display: "flex",
            gap: "12px",
            padding: "10px 18px 0",
            borderBottom: "1px solid var(--border-color)",
            background: "var(--bg-secondary)",
          }}
        >
          <button
            type="button"
            onClick={() => setTab("url")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              paddingBottom: "8px",
              fontSize: "12px",
              fontWeight: 500,
              background: "none",
              border: "none",
              borderBottom: tab === "url" ? "2px solid var(--accent)" : "2px solid transparent",
              color: tab === "url" ? "var(--accent)" : "var(--text-muted)",
              cursor: "pointer",
            }}
          >
            <LinkIcon style={{ width: 13, height: 13 }} />
            <span>{t("image.changeSource.byUrl") || "By URL"}</span>
          </button>
          <button
            type="button"
            onClick={() => setTab("file")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              paddingBottom: "8px",
              fontSize: "12px",
              fontWeight: 500,
              background: "none",
              border: "none",
              borderBottom: tab === "file" ? "2px solid var(--accent)" : "2px solid transparent",
              color: tab === "file" ? "var(--accent)" : "var(--text-muted)",
              cursor: "pointer",
            }}
          >
            <Upload style={{ width: 13, height: 13 }} />
            <span>{t("image.changeSource.byFile") || "Upload file"}</span>
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: "18px" }}>
          {tab === "url" ? (
            <form onSubmit={handleApplyUrl} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div>
                <label style={{ display: "block", fontSize: "11px", fontWeight: 500, color: "var(--text-secondary)", marginBottom: "6px" }}>
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
                  className="modal-input"
                  style={{ width: "100%", fontSize: "12px" }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "8px" }}>
                <button
                  type="button"
                  onClick={onClose}
                  className="btn-secondary"
                  style={{ fontSize: "12px", padding: "6px 14px" }}
                >
                  {t("image.changeSource.cancel") || "Cancel"}
                </button>
                <button
                  type="submit"
                  disabled={!url.trim()}
                  className="btn-primary"
                  style={{ fontSize: "12px", padding: "6px 14px" }}
                >
                  {t("image.changeSource.apply") || "Apply"}
                </button>
              </div>
            </form>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                style={{ display: "none" }}
              />

              {previewSrc ? (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "8px" }}>
                  <div style={{ maxHeight: "180px", overflow: "hidden", borderRadius: "8px", border: "1px solid var(--border-color)" }}>
                    <img src={previewSrc} alt="Preview" style={{ maxHeight: "180px", objectFit: "contain" }} />
                  </div>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    style={{ fontSize: "11px", color: "var(--accent)", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}
                  >
                    Выбрать другой файл
                  </button>
                </div>
              ) : (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    border: "2px dashed var(--border-color)",
                    borderRadius: "12px",
                    padding: "24px 16px",
                    textAlign: "center",
                    cursor: "pointer",
                    transition: "border-color 0.15s ease",
                  }}
                >
                  <Upload style={{ width: 28, height: 28, color: "var(--text-muted)", margin: "0 auto 8px" }} />
                  <p style={{ fontSize: "12px", color: "var(--text-primary)", marginBottom: "4px" }}>
                    {t("image.changeSource.chooseFile") || "Choose image file from computer"}
                  </p>
                  <span style={{ fontSize: "10px", color: "var(--text-muted)" }}>PNG, JPG, WEBP, GIF, SVG</span>
                </div>
              )}

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "8px" }}>
                <button
                  type="button"
                  onClick={onClose}
                  className="btn-secondary"
                  style={{ fontSize: "12px", padding: "6px 14px" }}
                >
                  {t("image.changeSource.cancel") || "Cancel"}
                </button>
                <button
                  type="button"
                  disabled={!previewSrc}
                  onClick={handleApplyFile}
                  className="btn-primary"
                  style={{ fontSize: "12px", padding: "6px 14px" }}
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
