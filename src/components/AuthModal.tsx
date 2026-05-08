/**
 * AuthModal.tsx — Login / Register popup for the desktop app.
 * Styles use the desktop app's CSS variable system.
 */
import { useState } from "react";
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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.5)" }}
      onClick={onClose}
    >
      <div
        className="rounded-xl shadow-2xl w-full p-6"
        style={{
          maxWidth: "400px",
          margin: "0 16px",
          background: "var(--bg-elevated)",
          border: "1px solid var(--border-strong)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Tabs */}
        <div
          className="flex rounded-lg p-0.5 mb-6"
          style={{ background: "var(--bg-hover)" }}
        >
          <button
            onClick={() => switchTab("login")}
            className="flex-1 py-1.5 rounded-md text-xs font-medium transition-colors"
            style={{
              background: tab === "login" ? "var(--bg-active)" : "transparent",
              color: tab === "login" ? "var(--text-primary)" : "var(--text-dim)",
            }}
          >
            Sign In
          </button>
          <button
            onClick={() => switchTab("register")}
            className="flex-1 py-1.5 rounded-md text-xs font-medium transition-colors"
            style={{
              background: tab === "register" ? "var(--bg-active)" : "transparent",
              color: tab === "register" ? "var(--text-primary)" : "var(--text-dim)",
            }}
          >
            Register
          </button>
        </div>

        {error && (
          <div
            className="p-3 rounded-lg text-sm mb-4"
            style={{ background: "rgba(232,17,35,0.1)", color: "#e81123" }}
          >
            {error}
          </div>
        )}

        {tab === "login" ? (
          <form onSubmit={handleLogin} className="space-y-3">
            <div>
              <label
                className="block text-xs font-medium mb-1"
                style={{ color: "var(--text-secondary)" }}
              >
                Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 rounded-lg outline-none text-sm transition-colors"
                style={{
                  background: "var(--bg-input)",
                  border: "1px solid var(--border-default)",
                  color: "var(--text-primary)",
                }}
              />
            </div>
            <div>
              <label
                className="block text-xs font-medium mb-1"
                style={{ color: "var(--text-secondary)" }}
              >
                Password
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 rounded-lg outline-none text-sm transition-colors"
                style={{
                  background: "var(--bg-input)",
                  border: "1px solid var(--border-default)",
                  color: "var(--text-primary)",
                }}
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2 rounded-lg text-sm font-semibold text-white transition-colors"
              style={{
                background: loading ? "var(--text-disabled)" : "var(--accent)",
              }}
            >
              {loading ? "Signing in..." : "Sign In"}
            </button>
          </form>
        ) : (
          <form onSubmit={handleRegister} className="space-y-3">
            <div>
              <label
                className="block text-xs font-medium mb-1"
                style={{ color: "var(--text-secondary)" }}
              >
                Nickname
              </label>
              <input
                type="text"
                required
                minLength={2}
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                className="w-full px-3 py-2 rounded-lg outline-none text-sm transition-colors"
                style={{
                  background: "var(--bg-input)",
                  border: "1px solid var(--border-default)",
                  color: "var(--text-primary)",
                }}
              />
            </div>
            <div>
              <label
                className="block text-xs font-medium mb-1"
                style={{ color: "var(--text-secondary)" }}
              >
                Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 rounded-lg outline-none text-sm transition-colors"
                style={{
                  background: "var(--bg-input)",
                  border: "1px solid var(--border-default)",
                  color: "var(--text-primary)",
                }}
              />
            </div>
            <div>
              <label
                className="block text-xs font-medium mb-1"
                style={{ color: "var(--text-secondary)" }}
              >
                Password
              </label>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 rounded-lg outline-none text-sm transition-colors"
                style={{
                  background: "var(--bg-input)",
                  border: "1px solid var(--border-default)",
                  color: "var(--text-primary)",
                }}
              />
            </div>
            <div>
              <label
                className="block text-xs font-medium mb-1"
                style={{ color: "var(--text-secondary)" }}
              >
                Confirm Password
              </label>
              <input
                type="password"
                required
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="w-full px-3 py-2 rounded-lg outline-none text-sm transition-colors"
                style={{
                  background: "var(--bg-input)",
                  border: "1px solid var(--border-default)",
                  color: "var(--text-primary)",
                }}
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2 rounded-lg text-sm font-semibold text-white transition-colors"
              style={{
                background: loading ? "var(--text-disabled)" : "var(--accent)",
              }}
            >
              {loading ? "Creating account..." : "Create Account"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
