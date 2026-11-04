import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import { useEditor } from "../context/EditorContext";
import { QRCodeSection } from "./QRCodeSection";

interface AuthModalProps {
  onClose: () => void;
}

const NICKNAME_REGEX = /^[a-zA-Z0-9_-]{2,30}$/;

export function AuthModal({ onClose }: AuthModalProps) {
  const { login, register, verifyEmail, resendVerification } = useAuth();
  const { t } = useEditor();
  const [tab, setTab] = useState<"login" | "register">("login");
  const [step, setStep] = useState<"form" | "verify">("form");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nickname, setNickname] = useState("");
  const [confirm, setConfirm] = useState("");
  const [code, setCode] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState("");
  const [infoMsg, setInfoMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(60);
  const [canResend, setCanResend] = useState(false);

  const overlayMouseDownRef = useRef(false);

  useEffect(() => {
    if (step !== "verify" || cooldown <= 0) {
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
  }, [step, cooldown]);

  const handleOverlayMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    overlayMouseDownRef.current = e.target === e.currentTarget;
  };

  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget && overlayMouseDownRef.current) {
      onClose();
    }
    overlayMouseDownRef.current = false;
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password, rememberMe);
      onClose();
    } catch (err: any) {
      setError(err.message || t('auth.loginFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
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
      setStep("verify");
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
    setLoading(true);
    try {
      await verifyEmail(code, email.trim());
      onClose();
    } catch (err: any) {
      setError(err.message || t('auth.verifyFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!canResend) return;
    setError("");
    setLoading(true);
    try {
      await resendVerification(email.trim());
      setCooldown(60);
      setCanResend(false);
      setInfoMsg(t('auth.codeResent'));
    } catch (err: any) {
      setError(err.message || t('auth.resendFailed'));
    } finally {
      setLoading(false);
    }
  };

  const switchTab = (tName: "login" | "register") => {
    setTab(tName);
    setStep("form");
    setError("");
    setInfoMsg("");
  };

  return (
    <div className="modal-overlay" onMouseDown={handleOverlayMouseDown} onClick={handleOverlayClick}>
      <div
        className="modal-panel"
        style={tab === "login" ? { maxWidth: "620px" } : undefined}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Tabs */}
        <div className="modal-tabs">
          <button
            onClick={() => switchTab("login")}
            className={`modal-tab ${tab === "login" ? "active" : ""}`}
          >
            {t('auth.login')}
          </button>
          <button
            onClick={() => switchTab("register")}
            className={`modal-tab ${tab === "register" ? "active" : ""}`}
          >
            {t('auth.register')}
          </button>
        </div>

        {error && <div className="modal-error">{error}</div>}
        {infoMsg && <div className="p-2 mb-3 rounded text-xs bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">{infoMsg}</div>}

        {tab === "login" ? (
          <div style={{ display: 'flex', flexDirection: 'row', gap: '20px', alignItems: 'stretch' }}>
            <form onSubmit={handleLogin} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label className="modal-label">{t('auth.email')}</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="modal-input"
                />
              </div>
              <div>
                <label className="modal-label">{t('auth.password')}</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="modal-input"
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="checkbox"
                  id="auth-remember-me"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  style={{ cursor: 'pointer' }}
                />
                <label htmlFor="auth-remember-me" style={{ fontSize: '12px', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                  {t('auth.rememberMe')}
                </label>
              </div>

              <button type="submit" disabled={loading} className="btn-primary" style={{ marginTop: '4px' }}>
                {loading ? t('auth.signingIn') : t('auth.login')}
              </button>
            </form>

            <QRCodeSection onApproved={onClose} rememberMe={rememberMe} />
          </div>
        ) : step === "verify" ? (
          <form onSubmit={handleVerify} style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '8px 0' }}>
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
                {t('auth.enterVerificationCode', { email: email.trim() || 'вашу почту' })}
              </p>
            </div>
            <div>
              <input
                type="text"
                required
                maxLength={6}
                autoFocus
                placeholder="000000"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                className="modal-input"
                style={{
                  fontSize: '24px',
                  letterSpacing: '8px',
                  textAlign: 'center',
                  fontWeight: 600,
                  padding: '10px 12px',
                }}
              />
            </div>
            <button type="submit" disabled={loading || code.length < 6} className="btn-primary">
              {loading ? t('common.loading') : t('auth.confirm')}
            </button>
            <div style={{ textAlign: 'center', marginTop: '4px' }}>
              <button
                type="button"
                onClick={handleResend}
                disabled={!canResend || loading}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '12px',
                  color: canResend ? 'var(--accent)' : 'var(--text-muted)',
                  cursor: canResend ? 'pointer' : 'default',
                  textDecoration: canResend ? 'underline' : 'none',
                  padding: '4px 8px',
                }}
              >
                {canResend
                  ? t('auth.resendCode')
                  : t('auth.resendCodeCooldown', { seconds: cooldown })}
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <label className="modal-label">{t('auth.nickname')}</label>
              <input
                type="text"
                required
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder={t('auth.nicknamePlaceholder')}
                className="modal-input"
              />
            </div>
            <div>
              <label className="modal-label">{t('auth.email')}</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="modal-input"
              />
            </div>
            <div>
              <label className="modal-label">{t('auth.password')}</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t('auth.passwordPlaceholder')}
                className="modal-input"
              />
            </div>
            <div>
              <label className="modal-label">{t('auth.confirmPassword')}</label>
              <input
                type="password"
                required
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="modal-input"
              />
            </div>
            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? t('auth.creatingAccount') : t('auth.createAccount')}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
