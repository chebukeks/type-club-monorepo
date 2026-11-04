import { useState, useEffect } from "react";
import {
  DownloadCloud,
  X,
  CheckCircle2,
  RefreshCw,
  AlertCircle,
  Sparkles,
  ArrowRight,
  HardDrive,
  ShieldCheck,
} from "lucide-react";
import { useEditor } from "../context/EditorContext";

interface UpdateInfo {
  updateAvailable: boolean;
  currentVersion: string;
  latestVersion: string;
  releaseDate?: string;
  installType?: "portable" | "installer" | "appimage" | "dmg";
  fileInfo?: { file: string; size: number; sha256?: string } | null;
  downloadUrl?: string | null;
  error?: string;
}

interface UpdateModalProps {
  updateInfo: UpdateInfo | null;
  onRefreshUpdateInfo: () => Promise<UpdateInfo>;
  onClose: () => void;
}

function formatBytes(bytes: number): string {
  if (!bytes || isNaN(bytes)) return "0 МБ";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " КБ";
  return (bytes / (1024 * 1024)).toFixed(1) + " МБ";
}

export function UpdateModal({
  updateInfo: initialUpdateInfo,
  onRefreshUpdateInfo,
  onClose,
}: UpdateModalProps) {
  const { t } = useEditor();
  const [info, setInfo] = useState<UpdateInfo | null>(initialUpdateInfo);
  const [status, setStatus] = useState<"idle" | "checking" | "downloading" | "ready" | "error">(
    !initialUpdateInfo ? "checking" : "idle"
  );
  const [progress, setProgress] = useState<{ bytesDownloaded: number; totalBytes: number; percent: number }>({
    bytesDownloaded: 0,
    totalBytes: 0,
    percent: 0,
  });
  const [downloadedFilePath, setDownloadedFilePath] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && status !== "downloading") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, status]);

  useEffect(() => {
    if (!initialUpdateInfo) {
      handleCheckAgain();
    }
  }, []);

  const handleCheckAgain = async () => {
    try {
      setStatus("checking");
      setErrorMessage(null);
      const res = await onRefreshUpdateInfo();
      setInfo(res);
      setStatus("idle");
    } catch (err: any) {
      setStatus("error");
      setErrorMessage(err.message || t("update.failed"));
    }
  };

  const handleStartDownload = async () => {
    if (!info?.downloadUrl || !info.fileInfo) return;
    try {
      setStatus("downloading");
      setErrorMessage(null);

      const cleanupListener = window.api.onUpdateProgress((p) => {
        setProgress(p);
      });

      const res = await window.api.downloadUpdate(info.downloadUrl, info.fileInfo.file, info.fileInfo.sha256);
      cleanupListener();

      if (res.success && res.filePath) {
        setDownloadedFilePath(res.filePath);
        setStatus("ready");
      } else {
        throw new Error("Download failed");
      }
    } catch (err: any) {
      setStatus("error");
      setErrorMessage(err.message || t("update.failed"));
    }
  };

  const handleApplyUpdate = async () => {
    if (!downloadedFilePath || !info?.installType) return;
    try {
      await window.api.installUpdate(downloadedFilePath, info.installType);
    } catch (err: any) {
      setStatus("error");
      setErrorMessage(err.message || t("update.failed"));
    }
  };

  const getFormatLabel = () => {
    switch (info?.installType) {
      case "portable":
        return t("update.formatPortable");
      case "installer":
        return t("update.formatInstaller");
      case "appimage":
        return t("update.formatLinux");
      case "dmg":
        return t("update.formatMac");
      default:
        return "Desktop";
    }
  };

  return (
    <div
      className="modal-overlay"
      onClick={() => {
        if (status !== "downloading") onClose();
      }}
      style={{ zIndex: 110 }}
    >
      <div
        className="modal-panel"
        style={{
          width: "100%",
          maxWidth: "460px",
          padding: 0,
          overflow: "hidden",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "16px 20px 14px",
            borderBottom: "1px solid var(--border-default)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <DownloadCloud style={{ width: 17, height: 17, color: "var(--accent)" }} />
            <span style={{ fontWeight: 600, fontSize: "13.5px", color: "var(--text-primary)" }}>
              {t("update.modalTitle")}
            </span>
          </div>
          {status !== "downloading" && (
            <button
              onClick={onClose}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "var(--text-dim)",
                padding: "4px",
                borderRadius: "6px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <X size={15} />
            </button>
          )}
        </div>

        {/* Body Content */}
        <div style={{ padding: "20px" }}>
          {status === "checking" && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "12px",
                padding: "24px 0",
                textAlign: "center",
              }}
            >
              <RefreshCw className="animate-spin" style={{ width: 26, height: 26, color: "var(--accent)" }} />
              <span style={{ fontSize: "12.5px", color: "var(--text-secondary)" }}>
                {t("update.checking")}
              </span>
            </div>
          )}

          {status === "error" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px", padding: "8px 0" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "10px",
                  padding: "12px",
                  borderRadius: "10px",
                  backgroundColor: "rgba(239, 68, 68, 0.1)",
                  border: "1px solid rgba(239, 68, 68, 0.25)",
                }}
              >
                <AlertCircle style={{ width: 18, height: 18, color: "rgb(239, 68, 68)", flexShrink: 0 }} />
                <span style={{ fontSize: "12px", color: "var(--text-primary)" }}>
                  {errorMessage || t("update.failed")}
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
                <button
                  type="button"
                  onClick={onClose}
                  className="btn-secondary"
                  style={{ fontSize: "12px", padding: "6px 14px" }}
                >
                  {t("common.close")}
                </button>
                <button
                  type="button"
                  onClick={handleCheckAgain}
                  className="btn-primary"
                  style={{ fontSize: "12px", padding: "6px 14px" }}
                >
                  {t("update.checkAgain")}
                </button>
              </div>
            </div>
          )}

          {status !== "checking" && status !== "error" && info && !info.updateAvailable && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "14px",
                padding: "16px 0",
                textAlign: "center",
              }}
            >
              <div
                style={{
                  width: "48px",
                  height: "48px",
                  borderRadius: "50%",
                  backgroundColor: "rgba(34, 197, 94, 0.12)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#22c55e",
                }}
              >
                <CheckCircle2 size={26} />
              </div>
              <div>
                <h4 style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "4px" }}>
                  {t("update.latestVersionInstalled")}
                </h4>
                <p style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                  v{info.currentVersion} ({getFormatLabel()})
                </p>
              </div>
              <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
                <button
                  type="button"
                  onClick={handleCheckAgain}
                  className="btn-secondary"
                  style={{ fontSize: "12px", padding: "6px 14px" }}
                >
                  {t("update.checkAgain")}
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="btn-primary"
                  style={{ fontSize: "12px", padding: "6px 16px" }}
                >
                  {t("common.close")}
                </button>
              </div>
            </div>
          )}

          {status !== "checking" && status !== "error" && info && info.updateAvailable && (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {/* Version Comparison Card */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "14px 16px",
                  borderRadius: "12px",
                  backgroundColor: "var(--bg-surface)",
                  border: "1px solid var(--border-default)",
                }}
              >
                <div>
                  <span style={{ fontSize: "11px", color: "var(--text-dim)", display: "block", marginBottom: "2px" }}>
                    {t("update.currentVersion")}
                  </span>
                  <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-secondary)" }}>
                    v{info.currentVersion}
                  </span>
                </div>

                <div style={{ color: "var(--accent)", display: "flex", alignItems: "center" }}>
                  <ArrowRight size={16} />
                </div>

                <div style={{ textAlign: "right" }}>
                  <span style={{ fontSize: "11px", color: "var(--accent)", display: "block", marginBottom: "2px", fontWeight: 500 }}>
                    {t("update.newVersion")}
                  </span>
                  <span style={{ fontSize: "14px", fontWeight: 700, color: "var(--accent)" }}>
                    v{info.latestVersion}
                  </span>
                </div>
              </div>

              {/* Meta details */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  fontSize: "11.5px",
                  color: "var(--text-muted)",
                  padding: "0 4px",
                }}
              >
                <span style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                  <HardDrive size={13} />
                  <span>{getFormatLabel()}</span>
                </span>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  {info.fileInfo?.sha256 && (
                    <span
                      style={{ display: "flex", alignItems: "center", gap: "3px", color: "var(--accent)", fontSize: "11px" }}
                      title={`SHA-256: ${info.fileInfo.sha256}`}
                    >
                      <ShieldCheck size={13} />
                      <span>SHA-256</span>
                    </span>
                  )}
                  {info.fileInfo?.size ? (
                    <span>{formatBytes(info.fileInfo.size)}</span>
                  ) : null}
                </div>
              </div>

              {/* Description or Progress */}
              {status === "idle" && (
                <p style={{ fontSize: "12px", color: "var(--text-secondary)", lineHeight: 1.5, margin: 0 }}>
                  {t("update.availableDesc")}
                </p>
              )}

              {status === "downloading" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px", padding: "6px 0" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11.5px", color: "var(--text-secondary)" }}>
                    <span>{t("update.downloading")}</span>
                    <span style={{ fontWeight: 600, color: "var(--accent)" }}>{progress.percent}%</span>
                  </div>
                  <div
                    style={{
                      width: "100%",
                      height: "7px",
                      borderRadius: "4px",
                      backgroundColor: "var(--bg-surface)",
                      overflow: "hidden",
                      border: "1px solid var(--border-default)",
                    }}
                  >
                    <div
                      style={{
                        height: "100%",
                        width: `${Math.max(3, progress.percent)}%`,
                        backgroundColor: "var(--accent)",
                        borderRadius: "4px",
                        transition: "width 0.2s ease-out",
                      }}
                    />
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10.5px", color: "var(--text-dim)" }}>
                    <span>{formatBytes(progress.bytesDownloaded)}</span>
                    <span>{formatBytes(progress.totalBytes)}</span>
                  </div>
                </div>
              )}

              {status === "ready" && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    padding: "12px",
                    borderRadius: "10px",
                    backgroundColor: "rgba(34, 197, 94, 0.1)",
                    border: "1px solid rgba(34, 197, 94, 0.25)",
                  }}
                >
                  <Sparkles size={18} style={{ color: "#22c55e", flexShrink: 0 }} />
                  <div>
                    <h5 style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "2px" }}>
                      {t("update.readyToInstall")}
                    </h5>
                    <p style={{ fontSize: "11px", color: "var(--text-secondary)", margin: 0 }}>
                      {t("update.readyDesc")}
                    </p>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "4px" }}>
                {status === "idle" && (
                  <>
                    <button
                      type="button"
                      onClick={onClose}
                      className="btn-secondary"
                      style={{ fontSize: "12px", padding: "6px 14px" }}
                    >
                      {t("update.later")}
                    </button>
                    <button
                      type="button"
                      onClick={handleStartDownload}
                      className="btn-primary"
                      style={{ fontSize: "12px", padding: "6px 16px" }}
                    >
                      {t("update.downloadBtn")}
                    </button>
                  </>
                )}

                {status === "downloading" && (
                  <button
                    type="button"
                    disabled
                    className="btn-primary"
                    style={{ fontSize: "12px", padding: "6px 16px", opacity: 0.7 }}
                  >
                    <RefreshCw className="animate-spin" size={13} style={{ display: "inline", marginRight: "6px" }} />
                    {t("update.downloading")}
                  </button>
                )}

                {status === "ready" && (
                  <>
                    <button
                      type="button"
                      onClick={onClose}
                      className="btn-secondary"
                      style={{ fontSize: "12px", padding: "6px 14px" }}
                    >
                      {t("update.later")}
                    </button>
                    <button
                      type="button"
                      onClick={handleApplyUpdate}
                      className="btn-primary"
                      style={{ fontSize: "12px", padding: "6px 16px" }}
                    >
                      {t("update.restartBtn")}
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
