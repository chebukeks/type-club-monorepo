import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { authApi } from "../api";

export default function Profile() {
  const { user, refresh } = useAuth();
  const [nickname, setNickname] = useState(user?.nickname || "");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (!user) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg("");
    setError("");
    if (password && password !== confirm) {
      setError("Passwords do not match");
      return;
    }
    setLoading(true);
    try {
      const data: any = {};
      if (nickname !== user.nickname) data.nickname = nickname;
      if (password) { data.password = password; data.confirm_password = confirm; }
      if (Object.keys(data).length === 0) {
        setMsg("No changes");
        setLoading(false);
        return;
      }
      await authApi.updateMe(data);
      await refresh();
      setPassword("");
      setConfirm("");
      setMsg("Profile updated");
    } catch (err: any) {
      setError(err.message || "Update failed");
    } finally {
      setLoading(false);
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
          <input type="text" value={nickname} onChange={(e) => setNickname(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Email</label>
          <input type="email" value={user.email} disabled
            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800 text-gray-400 cursor-not-allowed" />
          <p className="text-xs text-gray-400 mt-1">
            {user.email_verified ? "✓ Verified" : "Email not verified"}
          </p>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">New Password</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
            placeholder="Leave empty to keep current"
            className="w-full px-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        {password && (
          <div>
            <label className="block text-sm font-medium mb-1">Confirm New Password</label>
            <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        )}
        <button type="submit" disabled={loading}
          className="w-full py-2.5 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors">
          {loading ? "Saving..." : "Save Changes"}
        </button>
      </form>
    </div>
  );
}
