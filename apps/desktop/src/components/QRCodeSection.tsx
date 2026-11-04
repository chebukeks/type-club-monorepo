import { useState, useEffect, useRef } from "react";
import { QRCodeSVG } from "qrcode.react";
import { RefreshCw, CheckCircle2, QrCode } from "lucide-react";
import { authApi } from "../api";
import { useAuth } from "../context/AuthContext";
import { useEditor } from "../context/EditorContext";

export function QRCodeSection({ onApproved, rememberMe = true }: { onApproved?: () => void; rememberMe?: boolean }) {
  const { loginWithToken } = useAuth();
  const { t } = useEditor();
  const [session, setSession] = useState<{ id: string; url: string } | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "expired" | "approved" | "error">("loading");
  const pollTimerRef = useRef<any>(null);

  const initSession = async () => {
    try {
      setStatus("loading");
      const data = await authApi.initQr();
      setSession({ id: data.session_id, url: data.url });
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  };

  useEffect(() => {
    initSession();
    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (status !== "ready" || !session) return;

    pollTimerRef.current = setInterval(async () => {
      try {
        const res = await authApi.getQrStatus(session.id);
        if (res.status === "approved" && res.access_token) {
          clearInterval(pollTimerRef.current);
          setStatus("approved");
          await loginWithToken(res.access_token, rememberMe);
          onApproved?.();
        } else if (res.status === "expired") {
          clearInterval(pollTimerRef.current);
          setStatus("expired");
        }
      } catch {
        // ignore polling network errors
      }
    }, 2000);

    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, [session, status]);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px 20px",
        borderLeft: "1px solid var(--border-color)",
        textAlign: "center",
        minWidth: "200px",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "6px",
          marginBottom: "4px",
          fontSize: "13px",
          fontWeight: 600,
          color: "var(--text-primary)",
        }}
      >
        <QrCode style={{ width: 14, height: 14, color: "var(--accent)" }} />
        <span>{t("auth.qrTitle")}</span>
      </div>
      <p style={{ fontSize: "11px", color: "var(--text-muted)", marginBottom: "12px", maxWidth: "160px" }}>
        {t("auth.qrDesc")}
      </p>

      <div
        style={{
          position: "relative",
          padding: "10px",
          background: "#ffffff",
          borderRadius: "12px",
          width: "150px",
          height: "150px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
        }}
      >
        {status === "loading" && (
          <div className="animate-spin" style={{ color: "#888" }}>
            <RefreshCw style={{ width: 20, height: 20 }} />
          </div>
        )}
        {status === "ready" && session && (
          <QRCodeSVG value={session.url} size={130} level="M" />
        )}
        {status === "expired" && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "rgba(255, 255, 255, 0.95)",
              borderRadius: "12px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              padding: "8px",
            }}
          >
            <span style={{ fontSize: "11px", color: "#444" }}>{t("auth.qrExpired")}</span>
            <button
              onClick={initSession}
              type="button"
              className="btn-primary"
              style={{ fontSize: "11px", padding: "4px 8px", display: "flex", alignItems: "center", gap: "4px" }}
            >
              <RefreshCw style={{ width: 12, height: 12 }} />
              <span>{t("auth.qrRefresh")}</span>
            </button>
          </div>
        )}
        {status === "approved" && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "rgba(220, 252, 231, 0.95)",
              borderRadius: "12px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: "6px",
            }}
          >
            <CheckCircle2 style={{ width: 36, height: 36, color: "#16a34a" }} />
            <span style={{ fontSize: "11px", fontWeight: 600, color: "#16a34a" }}>{t("auth.qrApproved")}</span>
          </div>
        )}
        {status === "error" && (
          <button
            onClick={initSession}
            type="button"
            style={{ fontSize: "11px", color: "var(--accent)", display: "flex", alignItems: "center", gap: "4px", background: "none", border: "none", cursor: "pointer" }}
          >
            <RefreshCw style={{ width: 12, height: 12 }} />
            <span>{t("auth.qrRefresh")}</span>
          </button>
        )}
      </div>
    </div>
  );
}
