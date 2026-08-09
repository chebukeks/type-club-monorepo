import { useState, useRef } from "react";
import { useAuth } from "../context/AuthContext";

interface AuthModalProps {
  onClose: () => void;
}

export function AuthModal({ onClose }: AuthModalProps) {
  const { login, register } = useAuth();
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
      setError(err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (password !== confirm) {
      setError("Passwords do not match");
      return;
    }
    setLoading(true);
    try {
      await register(nickname, email, password, confirm);
      onClose();
    } catch (err: any) {
      setError(err.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  const switchTab = (t: "login" | "register") => {
    setTab(t);
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
            Sign In
          </button>
          <button
            onClick={() => switchTab("register")}
            className={`modal-tab ${tab === "register" ? "active" : ""}`}
          >
            Register
          </button>
        </div>

        {error && <div className="modal-error">{error}</div>}

        {tab === "login" ? (
          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <label className="modal-label">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="modal-input"
              />
            </div>
            <div>
              <label className="modal-label">Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="modal-input"
              />
            </div>
            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? "Signing in..." : "Sign In"}
            </button>
          </form>
        ) : (
          <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <label className="modal-label">Nickname</label>
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
              <label className="modal-label">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="modal-input"
              />
            </div>
            <div>
              <label className="modal-label">Password</label>
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
              <label className="modal-label">Confirm Password</label>
              <input
                type="password"
                required
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="modal-input"
              />
            </div>
            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? "Creating account..." : "Create Account"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
