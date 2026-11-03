import React, { useState, useRef } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ChevronLeft, User, Bot, Camera, Shield, CheckCircle2, AlertCircle, ExternalLink, KeyRound } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import { authApi, usersApi } from "../api";
import { ApiKeySettings } from "../components/ApiKeySettings";

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
  const [searchParams, setSearchParams] = useSearchParams();
  const currentTab = searchParams.get("tab") || "profile";

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
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10">
      {/* Top Header */}
      <div className="mb-6 sm:mb-8">
        <button
          onClick={() => navigate(`/${user.nickname}`)}
          className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-900 dark:hover:text-gray-200 transition-colors mb-3 cursor-pointer"
        >
          <ChevronLeft size={15} />
          <span>{t('settings.backToProfile')}</span>
        </button>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
              {t('titlebar.settings')}
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {t('settings.subtitle')}
            </p>
          </div>
          <Link
            to={`/${user.nickname}`}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors self-start sm:self-auto py-1.5 px-3 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 hover:border-gray-300 dark:hover:border-gray-700"
          >
            <span>{t('settings.publicProfile')}</span>
            <ExternalLink size={13} />
          </Link>
        </div>
      </div>

      {/* Tabs Bar */}
      <div className="flex border-b border-gray-200 dark:border-gray-800 mb-8 overflow-x-auto scrollbar-none">
        <button
          type="button"
          onClick={() => setSearchParams({ tab: "profile" })}
          className={`flex items-center gap-2 pb-3 px-4 text-sm font-medium border-b-2 transition-all whitespace-nowrap ${
            currentTab === "profile"
              ? "border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400 font-semibold"
              : "border-transparent text-gray-500 hover:text-gray-800 dark:hover:text-gray-200"
          }`}
        >
          <User size={16} />
          {t('settings.tabProfile')}
        </button>
        <button
          type="button"
          onClick={() => setSearchParams({ tab: "mcp" })}
          className={`flex items-center gap-2 pb-3 px-4 text-sm font-medium border-b-2 transition-all whitespace-nowrap ${
            currentTab === "mcp"
              ? "border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400 font-semibold"
              : "border-transparent text-gray-500 hover:text-gray-800 dark:hover:text-gray-200"
          }`}
        >
          <Bot size={16} />
          {t('settings.tabMcp')}
        </button>
      </div>

      {/* Tab Contents */}
      {currentTab === "mcp" ? (
        <ApiKeySettings />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: Account Overview Card */}
          <div className="lg:col-span-4 space-y-6">
            <div className="p-6 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900/60 shadow-xs space-y-5">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                {t('settings.profileOverview')}
              </h2>

              <div className="flex flex-col items-center text-center">
                <div className="relative group mb-3">
                  <div className="w-24 h-24 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden ring-4 ring-gray-100 dark:ring-gray-800/60 flex-shrink-0">
                    {avatarUrl ? (
                      <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400 text-2xl font-bold">
                        {user.nickname[0].toUpperCase()}
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={avatarUploading}
                    className="absolute inset-0 rounded-full bg-black/40 text-white flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer disabled:opacity-0"
                    title={t('settings.uploadNew')}
                  >
                    <Camera size={20} />
                    <span className="text-[10px] font-medium mt-1">
                      {avatarUploading ? t('settings.uploading') : t('settings.uploadNew')}
                    </span>
                  </button>
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleAvatarUpload}
                  className="hidden"
                />

                <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">
                  {user.nickname}
                </h3>
                <span className="inline-block mt-1 text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300">
                  {user.role === "moderator" ? t('settings.roleModerator') : t('settings.roleAuthor')}
                </span>

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={avatarUploading}
                  className="mt-4 text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline disabled:opacity-50"
                >
                  {avatarUploading ? t('settings.uploading') : t('settings.uploadNew')}
                </button>
              </div>

              <div className="pt-4 border-t border-gray-100 dark:border-gray-800/80 space-y-3">
                <div>
                  <span className="block text-xs text-gray-400 mb-1">{t('settings.email')}</span>
                  <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                    {user.email}
                  </div>
                  <div className="flex items-center gap-1.5 mt-1 text-xs">
                    {user.email_verified ? (
                      <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                        <CheckCircle2 size={13} />
                        {t('settings.verified')}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400 font-medium">
                        <AlertCircle size={13} />
                        {t('settings.notVerified')}
                      </span>
                    )}
                  </div>
                  {!user.email_verified && (
                    <button
                      type="button"
                      onClick={handleResend}
                      disabled={resending}
                      className="mt-2 text-xs text-blue-600 dark:text-blue-400 hover:underline disabled:opacity-50"
                    >
                      {resending ? t('auth.sending') : t('auth.resendVerification')}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Editable Information Form */}
          <div className="lg:col-span-8">
            <form onSubmit={handleSubmit} className="space-y-6">
              {msg && (
                <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/50 text-emerald-800 dark:text-emerald-200 text-sm flex items-center gap-2">
                  <CheckCircle2 size={16} className="shrink-0" />
                  <span>{msg}</span>
                </div>
              )}
              {error && (
                <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/50 text-red-800 dark:text-red-200 text-sm flex items-center gap-2">
                  <AlertCircle size={16} className="shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Basic Info Card */}
              <div className="p-6 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900/60 shadow-xs space-y-4">
                <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                  <User size={18} className="text-gray-400" />
                  {t('settings.editProfile')}
                </h2>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                    {t('settings.nickname')}
                  </label>
                  <input
                    type="text"
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                    className={`w-full px-3.5 py-2.5 rounded-xl border bg-white dark:bg-gray-950 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors ${
                      ne && nickname ? "border-red-400 dark:border-red-600" : "border-gray-300 dark:border-gray-700"
                    }`}
                  />
                  {ne && nickname && <p className="text-red-500 text-xs mt-1.5">{ne}</p>}
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      {t('settings.bio')}
                    </label>
                    <span className="text-xs text-gray-400 font-mono">
                      {bio.length} / 1000
                    </span>
                  </div>
                  <textarea
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    rows={4}
                    maxLength={1000}
                    placeholder={t('settings.bioPlaceholder')}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors resize-none leading-relaxed"
                  />
                </div>
              </div>

              {/* Security & Password Card */}
              <div className="p-6 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900/60 shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                    <Shield size={18} className="text-gray-400" />
                    {t('settings.security')}
                  </h2>
                  {!showPassword && (
                    <button
                      type="button"
                      onClick={() => setShowPassword(true)}
                      className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                    >
                      <KeyRound size={13} />
                      {t('settings.changePassword')}
                    </button>
                  )}
                </div>

                {showPassword ? (
                  <div className="space-y-4 pt-2">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                        {t('settings.currentPassword')}
                      </label>
                      <input
                        type="password"
                        value={oldPassword}
                        onChange={(e) => setOldPassword(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                      />
                      <p className="text-xs text-gray-400 mt-1">
                        <Link to="/forgot-password" className="text-blue-600 dark:text-blue-400 hover:underline">
                          {t('settings.dontRememberPassword')}
                        </Link>
                      </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                          {t('auth.newPassword')}
                        </label>
                        <input
                          type="password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className={`w-full px-3.5 py-2.5 rounded-xl border bg-white dark:bg-gray-950 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 ${
                            pe && password ? "border-red-400 dark:border-red-600" : "border-gray-300 dark:border-gray-700"
                          }`}
                        />
                        {pe && password && <p className="text-red-500 text-xs mt-1">{pe}</p>}
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                          {t('settings.confirmNewPassword')}
                        </label>
                        <input
                          type="password"
                          value={confirm}
                          onChange={(e) => setConfirm(e.target.value)}
                          className={`w-full px-3.5 py-2.5 rounded-xl border bg-white dark:bg-gray-950 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 ${
                            ce ? "border-red-400 dark:border-red-600" : "border-gray-300 dark:border-gray-700"
                          }`}
                        />
                        {ce && <p className="text-red-500 text-xs mt-1">{ce}</p>}
                      </div>
                    </div>

                    <div className="flex justify-end pt-2">
                      <button
                        type="button"
                        onClick={() => {
                          setShowPassword(false);
                          setOldPassword("");
                          setPassword("");
                          setConfirm("");
                        }}
                        className="text-xs text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
                      >
                        {t('common.cancel')}
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                    {t('settings.passwordDesc')}
                  </p>
                )}
              </div>

              {/* Submit Button */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="submit"
                  disabled={loading || !canSubmit}
                  className="px-6 py-2.5 rounded-xl bg-blue-600 text-white font-semibold text-sm hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-xs"
                >
                  {loading ? t('settings.uploading') : t('settings.saveChanges')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
