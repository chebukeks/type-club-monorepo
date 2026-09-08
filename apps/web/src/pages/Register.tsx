import { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";

const NICKNAME_REGEX = /^[a-zA-Z0-9_-]{2,30}$/;

export default function Register() {
  const { register, verifyEmail, resendVerification } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirect = searchParams.get("redirect") || "/";

  const [nickname, setNickname] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [infoMsg, setInfoMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [registered, setRegistered] = useState(false);
  const [cooldown, setCooldown] = useState(60);
  const [canResend, setCanResend] = useState(false);

  useEffect(() => {
    if (!registered || cooldown <= 0) {
      if (cooldown <= 0) setCanResend(true);
      return;
    }
    const timer = setInterval(() => {
      setCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setCanResend(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [registered, cooldown]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const trimmedNick = nickname.trim();
    if (!NICKNAME_REGEX.test(trimmedNick)) {
      setError(t('auth.nicknameInvalid'));
      return;
    }
    if (password.length < 6) {
      setError(t('auth.passwordMinLength'));
      return;
    }
    if (password !== confirm) {
      setError(t('auth.passwordsDoNotMatch'));
      return;
    }
    setLoading(true);
    try {
      await register(trimmedNick, email.trim(), password, confirm);
      setRegistered(true);
      setCooldown(60);
      setCanResend(false);
      setInfoMsg(t('auth.codeResent'));
    } catch (err: any) {
      setError(err.message || t('auth.registerFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setInfoMsg("");
    const trimmedCode = code.trim();
    if (trimmedCode.length < 6) {
      setError(t('auth.enterVerificationCode'));
      return;
    }
    setLoading(true);
    try {
      await verifyEmail(trimmedCode, email.trim());
      navigate(redirect);
    } catch (err: any) {
      setError(err.message || t('auth.invalidCode'));
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!canResend) return;
    setError("");
    setInfoMsg("");
    setLoading(true);
    try {
      await resendVerification(email.trim());
      setInfoMsg(t('auth.codeResent'));
      setCooldown(60);
      setCanResend(false);
    } catch (err: any) {
      setError(err.message || t('auth.resetFailed'));
    } finally {
      setLoading(false);
    }
  };

  if (registered) {
    return (
      <div className="max-w-md mx-auto px-4 py-20 text-center">
        <h1 className="text-2xl font-bold mb-2">{t('auth.verifyEmailTitle')}</h1>
        <p className="text-gray-500 dark:text-gray-400 mb-6 text-sm">
          {t('auth.enterVerificationCode')}{" "}
          <strong className="text-gray-700 dark:text-gray-200">{email}</strong>
        </p>
        {error && (
          <div className="p-3 rounded-lg mb-4 text-sm bg-red-50 dark:bg-red-950 text-red-600">
            {error}
          </div>
        )}
        {infoMsg && (
          <div className="p-3 rounded-lg mb-4 text-sm bg-green-50 dark:bg-green-950 text-green-600">
            {infoMsg}
          </div>
        )}
        <form onSubmit={handleVerify} className="space-y-4 text-left">
          <div>
            <label className="block text-sm font-medium mb-2 text-center text-gray-700 dark:text-gray-300">
              {t('auth.enterVerificationCode', { email: email.trim() || 'вашу почту' })}
            </label>
            <input
              type="text"
              required
              maxLength={6}
              autoFocus
              placeholder="000000"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-center text-2xl font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button
            type="submit"
            disabled={loading || code.length < 6}
            className="w-full py-2.5 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {loading ? t('common.loading') : t('auth.verifyCode')}
          </button>
        </form>
        <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-200 dark:border-gray-800 text-sm">
          <button
            type="button"
            onClick={() => setRegistered(false)}
            className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
          >
            {t('common.back')}
          </button>
          <button
            type="button"
            disabled={!canResend || loading}
            onClick={handleResend}
            className={`transition-colors ${
              canResend
                ? "text-blue-600 hover:underline cursor-pointer"
                : "text-gray-400 cursor-not-allowed opacity-60"
            }`}
          >
            {canResend
              ? t('auth.resendCode')
              : t('auth.resendCodeIn', { seconds: String(cooldown) })}
          </button>
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
          <input
            type="text"
            required
            minLength={2}
            maxLength={30}
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">{t('auth.email')}</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">{t('auth.password')}</label>
          <input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">{t('auth.confirmPassword')}</label>
          <input
            type="password"
            required
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full py-2.5 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {loading ? t('auth.creatingAccount') : t('auth.createAccount')}
        </button>
      </form>
      <p className="text-center mt-6 text-sm text-gray-500">
        {t('auth.haveAccount')}{" "}
        <Link
          to={redirect && redirect !== "/" ? `/login?redirect=${encodeURIComponent(redirect)}` : "/login"}
          className="text-blue-600 hover:underline"
        >
          {t('auth.login')}
        </Link>
      </p>
    </div>
  );
}
