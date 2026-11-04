import { useState, useEffect } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import { authApi } from "../api";
import { QrCode, CheckCircle2, XCircle, ShieldCheck, UserCircle, ArrowRight } from "lucide-react";

export default function QrLogin() {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get("session") || "";
  const { user, login } = useAuth();
  const { t } = useLanguage();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [approved, setApproved] = useState(false);
  const [rejected, setRejected] = useState(false);

  const handleApprove = async () => {
    if (!sessionId) return;
    setLoading(true);
    setError("");
    try {
      await authApi.approveQr(sessionId);
      setApproved(true);
    } catch (err: any) {
      setError(err.message || "Failed to approve QR session");
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async () => {
    if (!sessionId) return;
    setLoading(true);
    setError("");
    try {
      await authApi.rejectQr(sessionId);
      setRejected(true);
    } catch (err: any) {
      setError(err.message || "Failed to reject QR session");
    } finally {
      setLoading(false);
    }
  };

  const handleLoginAndApprove = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessionId) return;
    setLoading(true);
    setError("");
    try {
      await login(email, password, true);
      await authApi.approveQr(sessionId);
      setApproved(true);
    } catch (err: any) {
      setError(err.message || t("auth.loginFailed"));
    } finally {
      setLoading(false);
    }
  };

  if (!sessionId) {
    return (
      <div className="max-w-md mx-auto px-4 py-20 text-center">
        <XCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <h1 className="text-xl font-bold mb-2">Недействительная ссылка</h1>
        <p className="text-sm text-gray-500 mb-6">Параметр сессии QR-кода отсутствует или повреждён.</p>
        <Link to="/" className="text-blue-600 hover:underline text-sm font-medium">
          На главную
        </Link>
      </div>
    );
  }

  if (approved) {
    return (
      <div className="max-w-md mx-auto px-4 py-20 text-center animate-in fade-in duration-300">
        <div className="w-16 h-16 bg-green-100 dark:bg-green-950/60 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 className="w-10 h-10 text-green-600 dark:text-green-400" />
        </div>
        <h1 className="text-2xl font-bold mb-2">{t("auth.qrApproved")}</h1>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-8 max-w-sm mx-auto">
          {t("auth.qrSuccess")}
        </p>
        <Link
          to="/"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 text-white font-medium hover:bg-blue-700 transition-colors"
        >
          <span>Перейти на главную</span>
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    );
  }

  if (rejected) {
    return (
      <div className="max-w-md mx-auto px-4 py-20 text-center">
        <div className="w-16 h-16 bg-red-100 dark:bg-red-950/60 rounded-full flex items-center justify-center mx-auto mb-4">
          <XCircle className="w-10 h-10 text-red-600 dark:text-red-400" />
        </div>
        <h1 className="text-xl font-bold mb-2">Вход отклонён</h1>
        <p className="text-sm text-gray-500 mb-6">Запрос на авторизацию устройства был отклонён.</p>
        <Link to="/" className="text-blue-600 hover:underline text-sm font-medium">
          На главную
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto px-4 py-16">
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 sm:p-8 shadow-sm">
        <div className="w-12 h-12 bg-blue-50 dark:bg-blue-950/60 rounded-2xl flex items-center justify-center mx-auto mb-4 text-blue-600 dark:text-blue-400">
          <ShieldCheck className="w-6 h-6" />
        </div>

        <h1 className="text-xl sm:text-2xl font-bold text-center mb-1">
          {t("auth.qrConfirmDevice")}
        </h1>
        <p className="text-xs text-center text-gray-500 mb-6">
          Авторизация в Type Club через QR-код
        </p>

        {error && (
          <div className="p-3 mb-4 rounded-xl bg-red-50 dark:bg-red-950/60 text-red-600 text-xs">
            {error}
          </div>
        )}

        {user ? (
          <div className="space-y-6">
            <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700/60 flex items-center gap-3">
              <UserCircle className="w-10 h-10 text-gray-400 shrink-0" />
              <div className="overflow-hidden text-left">
                <div className="font-semibold text-gray-900 dark:text-gray-100 text-sm truncate">
                  {user.nickname}
                </div>
                <div className="text-xs text-gray-500 truncate">{user.email}</div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={handleApprove}
                disabled={loading}
                className="flex-1 py-2.5 px-4 rounded-xl bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors text-sm"
              >
                {loading ? "Подтверждение..." : t("auth.qrApproveBtn")}
              </button>
              <button
                type="button"
                onClick={handleReject}
                disabled={loading}
                className="py-2.5 px-4 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50 transition-colors text-sm"
              >
                {t("auth.qrRejectBtn")}
              </button>
            </div>
          </div>
        ) : (
          <div>
            <div className="mb-4 text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/50 p-3 rounded-xl border border-amber-200 dark:border-amber-900/60">
              {t("auth.qrPromptLogin")}
            </div>
            <form onSubmit={handleLoginAndApprove} className="space-y-3">
              <div>
                <label className="block text-xs font-medium mb-1">{t("auth.email")}</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">{t("auth.password")}</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full mt-2 py-2.5 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors text-sm"
              >
                {loading ? t("auth.signingIn") : "Войти и подтвердить"}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
