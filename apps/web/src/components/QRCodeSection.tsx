import { useState, useEffect, useRef } from "react";
import { QRCodeSVG } from "qrcode.react";
import { RefreshCw, CheckCircle2, QrCode } from "lucide-react";
import { authApi } from "../api";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";

export function QRCodeSection({ onApproved, rememberMe = true }: { onApproved?: () => void; rememberMe?: boolean }) {
  const { loginWithToken } = useAuth();
  const { t } = useLanguage();
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
    <div className="flex flex-col items-center justify-center p-6 border-t md:border-t-0 md:border-l border-gray-200 dark:border-gray-800 text-center">
      <div className="flex items-center gap-2 mb-2 font-semibold text-gray-900 dark:text-gray-100 text-sm">
        <QrCode className="w-4 h-4 text-blue-500" />
        <span>{t("auth.qrTitle")}</span>
      </div>
      <p className="text-xs text-gray-500 mb-4 max-w-[200px]">
        {t("auth.qrDesc")}
      </p>

      <div className="relative p-3 bg-white rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 w-[180px] h-[180px] flex items-center justify-center">
        {status === "loading" && (
          <div className="animate-spin text-gray-400">
            <RefreshCw className="w-6 h-6" />
          </div>
        )}
        {status === "ready" && session && (
          <QRCodeSVG value={session.url} size={154} level="M" />
        )}
        {status === "expired" && (
          <div className="absolute inset-0 bg-white/90 dark:bg-gray-900/90 rounded-2xl flex flex-col items-center justify-center p-3 gap-2 backdrop-blur-xs">
            <span className="text-xs text-gray-600 dark:text-gray-400">{t("auth.qrExpired")}</span>
            <button
              onClick={initSession}
              type="button"
              className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 flex items-center gap-1.5 transition-colors"
            >
              <RefreshCw className="w-3 h-3" />
              <span>{t("auth.qrRefresh")}</span>
            </button>
          </div>
        )}
        {status === "approved" && (
          <div className="absolute inset-0 bg-green-500/10 dark:bg-green-500/20 rounded-2xl flex flex-col items-center justify-center p-3 gap-2">
            <CheckCircle2 className="w-10 h-10 text-green-500 animate-in zoom-in-75 duration-200" />
            <span className="text-xs font-semibold text-green-600 dark:text-green-400">{t("auth.qrApproved")}</span>
          </div>
        )}
        {status === "error" && (
          <button
            onClick={initSession}
            type="button"
            className="text-xs text-blue-600 hover:underline flex items-center gap-1"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>{t("auth.qrRefresh")}</span>
          </button>
        )}
      </div>
    </div>
  );
}
