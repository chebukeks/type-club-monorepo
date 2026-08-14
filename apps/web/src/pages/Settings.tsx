import { useState, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import { authApi, usersApi } from "../api";

function nickError(n: string, t: (k: any) => string): string | null {
  const tr = n.trim();
  if (!tr) return t('settings.nickEmpty');
  if (tr.length < 2) return t('settings.nickMinLength');
  if (tr.length > 30) return t('settings.nickMaxLength');
  return null;
}

function passError(p: string, t: (k: any) => string): string | null {
  if (!p) return null;
  if (p.length < 6) return t('auth.passwordMinLength');
  if (p.length > 128) return t('auth.passwordMaxLength');
  return null;
}

export default function Settings() {
  const { user, refresh } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [nickname, setNickname] = useState(user?.nickname || "");
  const [bio, setBio] = useState(user?.bio || "");
  const [avatarUrl, setAvatarUrl] = useState(user?.avatar_url || "");
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [oldPassword, setOldPassword] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!user) return null;

  const ne = nickError(nickname, t);
  const pe = showPassword ? passError(password, t) : null;
  const ce = showPassword && password && password !== confirm ? t('auth.passwordsDoNotMatch') : null;
  const canSubmit =
    !ne &&
    !pe &&
    !ce &&
    (nickname !== user.nickname || bio !== (user.bio || "") || avatarUrl !== (user.avatar_url || "") || (showPassword && password));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg("");
    setError("");
    if (!canSubmit) return;
    setLoading(true);
    try {
      const data: any = {};
      if (nickname.trim() !== user.nickname) data.nickname = nickname.trim();
      if (bio.trim() !== (user.bio || "")) data.bio = bio.trim();
      if (avatarUrl !== (user.avatar_url || "")) data.avatar_url = avatarUrl;
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
      setMsg(t('settings.profileUpdated'));
    } catch (err: any) {
      setError(err.message || t('settings.uploadFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarUploading(true);
    setError("");
    try {
      const result = await usersApi.uploadAvatar(file);
      setAvatarUrl(result.avatar_url);
    } catch (err: any) {
      setError(err.message || t('settings.uploadFailed'));
    } finally {
      setAvatarUploading(false);
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
      setError(err.message || t('auth.resetFailed'));
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="max-w-md mx-auto px-4 py-12">
      <div className="flex items-center gap-2 mb-8">
        <button
          onClick={() => navigate(`/${user.nickname}`)}
          className="text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
        >
          {t('settings.backToProfile')}
        </button>
        <h1 className="text-2xl font-bold">{t('titlebar.settings')}</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {msg && <div className="p-3 rounded-lg bg-green-50 dark:bg-green-950 text-green-600 text-sm">{msg}</div>}
        {error && <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950 text-red-600 text-sm">{error}</div>}

        <div>
          <label className="block text-sm font-medium mb-1">{t('settings.avatar')}</label>
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden flex-shrink-0">
              {avatarUrl ? (
                <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-400 text-xl font-bold">
                  {user.nickname[0].toUpperCase()}
                </div>
              )}
            </div>
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleAvatarUpload}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={avatarUploading}
                className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
              >
                {avatarUploading ? t('settings.uploading') : t('settings.uploadNew')}
              </button>
            </div>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">{t('settings.nickname')}</label>
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
          <label className="block text-sm font-medium mb-1">{t('settings.bio')}</label>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={3}
            maxLength={1000}
            placeholder={t('settings.bioPlaceholder')}
            className="w-full px-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
          <p className="text-xs text-gray-400 mt-1">{bio.length}/1000</p>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">{t('settings.email')}</label>
          <input type="email" value={user.email} disabled
            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800 text-gray-400 cursor-not-allowed" />
          <p className="text-xs text-gray-400 mt-1">
            {user.email_verified ? t('settings.verified') : t('settings.notVerified')}
          </p>
          {!user.email_verified && (
            <button
              type="button"
              onClick={handleResend}
              disabled={resending}
              className="mt-2 text-sm text-blue-600 hover:underline disabled:opacity-50"
            >
              {resending ? t('auth.sending') : t('auth.resendVerification')}
            </button>
          )}
        </div>

        {!showPassword ? (
          <button
            type="button"
            onClick={() => setShowPassword(true)}
            className="w-full py-2.5 rounded-xl border border-gray-300 dark:border-gray-700 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            {t('settings.changePassword')}
          </button>
        ) : (
          <>
            <div>
              <label className="block text-sm font-medium mb-1">{t('settings.currentPassword')}</label>
              <input
                type="password"
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-400 mt-1">
                <Link to="/forgot-password" className="text-blue-600 hover:underline">{t('settings.dontRememberPassword')}</Link>
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">{t('auth.newPassword')}</label>
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
              <label className="block text-sm font-medium mb-1">{t('settings.confirmNewPassword')}</label>
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
              {t('common.cancel')}
            </button>
          </>
        )}

        <button
          type="submit"
          disabled={loading || !canSubmit}
          className="w-full py-2.5 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {loading ? t('settings.uploading') : t('settings.saveChanges')}
        </button>
      </form>
    </div>
  );
}
