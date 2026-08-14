import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import { authApi } from "../api";

export default function Register() {
  const { register } = useAuth();
  const { t } = useLanguage();
  const [nickname, setNickname] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [registered, setRegistered] = useState(false);
  const [resendMsg, setResendMsg] = useState("");
  const [resending, setResending] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (password !== confirm) {
      setError(t('auth.passwordsDoNotMatch'));
      return;
    }
    setLoading(true);
    try {
      await register(nickname, email, password, confirm);
      setRegistered(true);
    } catch (err: any) {
      setError(err.message || t('auth.registerFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    setResendMsg("");
    try {
      const res = await authApi.resendVerification();
      setResendMsg(res.message);
    } catch (err: any) {
      setResendMsg(err.message || t('auth.resetFailed'));
    } finally {
      setResending(false);
    }
  };

  if (registered) {
    return (
      <div className="max-w-md mx-auto px-4 py-20 text-center">
        <h1 className="text-2xl font-bold mb-4 text-green-600">{t('auth.accountCreated')}</h1>
        <p className="text-gray-500 dark:text-gray-400 mb-2">
          {t('auth.verificationSent', { email })}
        </p>
        <p className="text-gray-500 dark:text-gray-400 mb-6">
          {t('auth.checkInbox')}
        </p>
        {resendMsg && (
          <div className={`p-3 rounded-lg mb-4 text-sm ${
            resendMsg.toLowerCase().includes("fail") || resendMsg.toLowerCase().includes("error")
              ? "bg-red-50 dark:bg-red-950 text-red-600"
              : "bg-green-50 dark:bg-green-950 text-green-600"
          }`}>{resendMsg}</div>
        )}
        <div className="flex flex-col gap-3 items-center">
          <button
            onClick={handleResend}
            disabled={resending}
            className="text-blue-600 hover:underline text-sm disabled:opacity-50"
          >
            {resending ? t('auth.sending') : t('auth.resendVerification')}
          </button>
          <Link to="/" className="px-6 py-3 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700">
            {t('auth.goHome')}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto px-4 py-20">
      <h1 className="text-3xl font-bold mb-8 text-center">{t('auth.createAccount')}</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950 text-red-600 text-sm">{error}</div>}
        <div>
          <label className="block text-sm font-medium mb-1">{t('auth.nickname')}</label>
          <input type="text" required minLength={2} value={nickname} onChange={(e) => setNickname(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">{t('auth.email')}</label>
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">{t('auth.password')}</label>
          <input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">{t('auth.confirmPassword')}</label>
          <input type="password" required value={confirm} onChange={(e) => setConfirm(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <button type="submit" disabled={loading}
          className="w-full py-2.5 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors">
          {loading ? t('auth.creatingAccount') : t('auth.createAccount')}
        </button>
      </form>
      <p className="text-center mt-6 text-sm text-gray-500">
        {t('auth.haveAccount')}{" "}
        <Link to="/login" className="text-blue-600 hover:underline">{t('auth.login')}</Link>
      </p>
    </div>
  );
}
