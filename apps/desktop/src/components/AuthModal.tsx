import { useState, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import { useEditor } from "../context/EditorContext";

interface AuthModalProps {
  onClose: () => void;
}

export function AuthModal({ onClose }: AuthModalProps) {
  const { login, register } = useAuth();
  const { t } = useEditor();
  const [tab, setTab] = useState<"login" | "register">("login");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nickname, setNickname] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const overlayMouseDownRef = useRef(false);

  const handleOverlayMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    overlayMouseDownRef.current = (e.target === e.currentTarget);
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
      await login(email, password);
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
    if (password !== confirm) {
      setError(t('auth.passwordsDoNotMatch'));
      return;
    }
    setLoading(true);
    try {
      await register(nickname, email, password, confirm);
      onClose();
    } catch (err: any) {
      setError(err.message || t('auth.registerFailed'));
    } finally {
      setLoading(false);
    }
  };

  const switchTab = (tName: "login" | "register") => {
    setTab(tName);
    setError("");
  };

  return (
    <div className="modal-overlay" onMouseDown={handleOverlayMouseDown} onClick={handleOverlayClick}>
      <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
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

        {tab === "login" ? (
          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
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
            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? t('auth.signingIn') : t('auth.login')}
            </button>
          </form>
        ) : (
          <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <label className="modal-label">{t('auth.nickname')}</label>
              <input
                type="text"
                required
                minLength={2}
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
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
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
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
