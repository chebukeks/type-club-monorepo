import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { authApi } from "../api";

function nickError(n: string): string | null {
  const t = n.trim();
  if (!t) return "Nickname cannot be empty";
  if (t.length < 2) return "Nickname must be at least 2 characters";
  if (t.length > 30) return "Nickname is too long (max 30)";
  return null;
}

function passError(p: string): string | null {
  if (!p) return null;
  if (p.length < 6) return "Password must be at least 6 characters";
  if (p.length > 128) return "Password is too long";
  return null;
}

export default function Profile() {
  const { user, refresh } = useAuth();
  const [nickname, setNickname] = useState(user?.nickname || "");
  const [showPassword, setShowPassword] = useState(false);
  const [oldPassword, setOldPassword] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);

  if (!user) return null;

  const ne = nickError(nickname);
  const pe = showPassword ? passError(password) : null;
  const ce = showPassword && password && password !== confirm ? "Passwords do not match" : null;
  const canSubmit = !ne && !pe && !ce && (nickname !== user.nickname || (showPassword && password));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg("");
    setError("");
    if (!canSubmit) return;
    setLoading(true);
    try {
      const data: any = {};
      if (nickname.trim() !== user.nickname) data.nickname = nickname.trim();
      if (showPassword && password) {
        data.old_password = oldPassword;
        data.password = password;
        data.confirm_password = confirm;
      }
      await authApi.updateMe(data);
      await refresh();
      setOldPassword("");
      setPassword("");
      setConfirm("");
      setShowPassword(false);
      setMsg("Profile updated");
    } catch (err: any) {
      setError(err.message || "Update failed");
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    setMsg("");
    setError("");
    try {
      const res = await authApi.resendVerification();
      setMsg(res.message);
    } catch (err: any) {
      setError(err.message || "Failed to resend");
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="max-w-md mx-auto px-4 py-20">
      <h1 className="text-3xl font-bold mb-8 text-center">Profile</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        {msg && <div className="p-3 rounded-lg bg-green-50 dark:bg-green-950 text-green-600 text-sm">{msg}</div>}
        {error && <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950 text-red-600 text-sm">{error}</div>}

        <div>
          <label className="block text-sm font-medium mb-1">Nickname</label>
          <input
            type="text"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            className={`w-full px-4 py-2.5 rounded-xl border bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              ne && nickname ? "border-red-400 dark:border-red-600" : "border-gray-300 dark:border-gray-700"
            }`}
          />
          {ne && nickname && <p className="text-red-500 text-xs mt-1">{ne}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Email</label>
          <input type="email" value={user.email} disabled
            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800 text-gray-400 cursor-not-allowed" />
          <p className="text-xs text-gray-400 mt-1">
            {user.email_verified ? "✓ Verified" : "Email not verified"}
          </p>
          {!user.email_verified && (
            <button
              type="button"
              onClick={handleResend}
              disabled={resending}
              className="mt-2 text-sm text-blue-600 hover:underline disabled:opacity-50"
            >
              {resending ? "Sending..." : "Resend verification email"}
            </button>
          )}
        </div>

        {!showPassword ? (
          <button
            type="button"
            onClick={() => setShowPassword(true)}
            className="w-full py-2.5 rounded-xl border border-gray-300 dark:border-gray-700 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            Change Password
          </button>
        ) : (
          <>
            <div>
              <label className="block text-sm font-medium mb-1">Current Password</label>
              <input
                type="password"
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-400 mt-1">
                <Link to="/forgot-password" className="text-blue-600 hover:underline">I don't remember my password</Link>
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">New Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={`w-full px-4 py-2.5 rounded-xl border bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  pe && password ? "border-red-400 dark:border-red-600" : "border-gray-300 dark:border-gray-700"
                }`}
              />
              {pe && password && <p className="text-red-500 text-xs mt-1">{pe}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Confirm New Password</label>
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className={`w-full px-4 py-2.5 rounded-xl border bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  ce ? "border-red-400 dark:border-red-600" : "border-gray-300 dark:border-gray-700"
                }`}
              />
              {ce && <p className="text-red-500 text-xs mt-1">{ce}</p>}
            </div>
            <button
              type="button"
              onClick={() => { setShowPassword(false); setOldPassword(""); setPassword(""); setConfirm(""); }}
              className="text-sm text-gray-500 hover:underline w-full text-center"
            >
              Cancel
            </button>
          </>
        )}

        <button
          type="submit"
          disabled={loading || !canSubmit}
          className="w-full py-2.5 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {loading ? "Saving..." : "Save Changes"}
        </button>
      </form>
    </div>
  );
}
