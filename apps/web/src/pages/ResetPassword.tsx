import { useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { authApi } from "../api";
import { useLanguage } from "../context/LanguageContext";

export default function ResetPassword() {
  const { t } = useLanguage();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  if (!token) {
    return (
      <div className="max-w-md mx-auto px-4 py-20 text-center">
        <h1 className="text-2xl font-bold mb-4 text-red-600">{t('auth.invalidLink')}</h1>
        <p className="text-gray-500 dark:text-gray-400 mb-6">{t('auth.noResetToken')}</p>
        <Link to="/forgot-password" className="text-blue-600 hover:underline">{t('auth.requestNewResetLink')}</Link>
      </div>
    );
  }

  if (done) {
    return (
      <div className="max-w-md mx-auto px-4 py-20 text-center">
        <h1 className="text-2xl font-bold mb-4 text-green-600">{t('auth.passwordResetSuccess')}</h1>
        <p className="text-gray-500 dark:text-gray-400 mb-6">{t('auth.passwordUpdated')}</p>
        <Link to="/login" className="inline-block px-6 py-3 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700">
          {t('auth.login')}
        </Link>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (password !== confirm) {
      setError(t('auth.passwordsDoNotMatch'));
      return;
    }
    if (password.length < 6) {
      setError(t('auth.passwordMinLength'));
      return;
    }
    setLoading(true);
    try {
      await authApi.resetPassword(token, password, confirm);
      setDone(true);
    } catch (err: any) {
      setError(err.message || t('auth.resetFailed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto px-4 py-20">
      <h1 className="text-3xl font-bold mb-8 text-center">{t('auth.resetPasswordTitle')}</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950 text-red-600 text-sm">{error}</div>}
        <div>
          <label className="block text-sm font-medium mb-1">{t('auth.newPassword')}</label>
          <input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">{t('auth.confirmNewPassword')}</label>
          <input type="password" required value={confirm} onChange={(e) => setConfirm(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <button type="submit" disabled={loading}
          className="w-full py-2.5 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors">
          {loading ? t('auth.resetting') : t('auth.resetPasswordBtn')}
        </button>
      </form>
      <p className="text-center mt-6 text-sm text-gray-500">
        <Link to="/login" className="text-blue-600 hover:underline">{t('auth.backToSignIn')}</Link>
      </p>
    </div>
  );
}
