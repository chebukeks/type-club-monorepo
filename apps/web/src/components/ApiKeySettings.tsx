import React, { useEffect, useState } from "react";
import {
  Key,
  Plus,
  Trash2,
  Copy,
  Check,
  Terminal,
  ShieldCheck,
  AlertTriangle,
  FileCode,
  Sparkles,
  Info,
  ExternalLink,
} from "lucide-react";
import { apiKeysApi, ApiKeyItem, ApiKeyCreatedItem } from "../api";
import { useLanguage } from "../context/LanguageContext";

export function ApiKeySettings() {
  const { t } = useLanguage();
  const [keys, setKeys] = useState<ApiKeyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createdKey, setCreatedKey] = useState<ApiKeyCreatedItem | null>(null);
  const [keyToRevoke, setKeyToRevoke] = useState<ApiKeyItem | null>(null);
  const [revoking, setRevoking] = useState(false);

  // Form fields
  const [keyName, setKeyName] = useState("");
  const [selectedScopes, setSelectedScopes] = useState<string[]>([
    "articles:read",
    "articles:write",
    "articles:manage",
  ]);
  const [expiresInDays, setExpiresInDays] = useState<number | undefined>(undefined);
  const [creating, setCreating] = useState(false);
  const [copiedToken, setCopiedToken] = useState(false);
  const [copiedConfig, setCopiedConfig] = useState(false);
  const [configFormat, setConfigFormat] = useState<"claude" | "cursor" | "antigravity">("claude");
  const [runMode, setRunMode] = useState<"local" | "npx">("local");

  const loadKeys = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await apiKeysApi.list();
      setKeys(data);
    } catch (err: any) {
      setError(err.message || t("settings.mcp.loadFailed"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadKeys();
  }, []);

  const handleScopeToggle = (scope: string) => {
    setSelectedScopes((prev) =>
      prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope]
    );
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyName.trim()) return;
    setCreating(true);
    setError("");
    try {
      const res = await apiKeysApi.create({
        name: keyName.trim(),
        scopes: selectedScopes,
        expires_in_days: expiresInDays,
      });
      setCreatedKey(res);
      setShowCreateModal(false);
      setKeyName("");
      loadKeys();
    } catch (err: any) {
      setError(err.message || t("settings.mcp.createFailed"));
    } finally {
      setCreating(false);
    }
  };

  const confirmRevoke = async () => {
    if (!keyToRevoke) return;
    setRevoking(true);
    setError("");
    try {
      await apiKeysApi.delete(keyToRevoke.id);
      setKeyToRevoke(null);
      loadKeys();
    } catch (err: any) {
      setError(err.message || t("settings.mcp.deleteFailed"));
    } finally {
      setRevoking(false);
    }
  };

  const handleCopyText = (text: string, type: "token" | "config") => {
    navigator.clipboard.writeText(text);
    if (type === "token") {
      setCopiedToken(true);
      setTimeout(() => setCopiedToken(false), 2000);
    } else {
      setCopiedConfig(true);
      setTimeout(() => setCopiedConfig(false), 2000);
    }
  };

  const currentOrigin =
    typeof window !== "undefined" ? window.location.origin : "https://type-club.ru";
  const wsOrigin = currentOrigin.includes("localhost") || currentOrigin.includes("127.0.0.1")
    ? "ws://localhost:8001"
    : currentOrigin.replace(/^http/, "ws") + "/collab";

  const getClaudeConfig = (token: string) => {
    const isLocal = runMode === "local";
    return JSON.stringify(
      {
        mcpServers: {
          "type-club": {
            command: isLocal ? "node" : "npx",
            args: isLocal
              ? ["packages/mcp-server/dist/index.cjs"]
              : ["-y", "@type-club/mcp-server"],
            env: {
              TYPECLUB_API_KEY: token,
              TYPECLUB_API_URL: currentOrigin,
              TYPECLUB_WS_URL: wsOrigin,
            },
          },
        },
      },
      null,
      2
    );
  };

  const getCursorConfig = (token: string) => {
    const isLocal = runMode === "local";
    return JSON.stringify(
      {
        typeClub: {
          command: isLocal
            ? "node packages/mcp-server/dist/index.cjs"
            : "npx -y @type-club/mcp-server",
          env: {
            TYPECLUB_API_KEY: token,
            TYPECLUB_API_URL: currentOrigin,
            TYPECLUB_WS_URL: wsOrigin,
          },
        },
      },
      null,
      2
    );
  };

  const getActiveConfigJson = (token: string) => {
    return configFormat === "cursor" ? getCursorConfig(token) : getClaudeConfig(token);
  };

  const getConfigPathHint = () => {
    if (configFormat === "claude") {
      return t("settings.mcp.pathHintClaude");
    }
    if (configFormat === "cursor") {
      return t("settings.mcp.pathHintCursor");
    }
    return t("settings.mcp.pathHintAntigravity");
  };

  const getScopeMeta = (id: string) => {
    switch (id) {
      case "articles:read":
        return {
          title: t("settings.mcp.scopeReadTitle"),
          tag: "read",
          desc: t("settings.mcp.scopeReadDesc"),
        };
      case "articles:write":
        return {
          title: t("settings.mcp.scopeWriteTitle"),
          tag: "write",
          desc: t("settings.mcp.scopeWriteDesc"),
        };
      case "articles:manage":
        return {
          title: t("settings.mcp.scopeManageTitle"),
          tag: "manage",
          desc: t("settings.mcp.scopeManageDesc"),
        };
      case "articles:delete":
        return {
          title: t("settings.mcp.scopeDeleteTitle"),
          tag: "delete",
          desc: t("settings.mcp.scopeDeleteDesc"),
        };
      default:
        return { title: id, tag: id, desc: "" };
    }
  };

  return (
    <div className="space-y-8">
      {/* Introduction Banner */}
      <div className="p-6 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900/60 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
              <Key size={18} />
            </span>
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
              {t("settings.mcp.title")}
            </h2>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 max-w-2xl leading-relaxed">
            {t("settings.mcp.desc")}
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setShowCreateModal(true);
            setError("");
          }}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors shrink-0 shadow-xs cursor-pointer"
        >
          <Plus size={16} />
          <span>{t("settings.mcp.createBtn")}</span>
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/50 text-red-800 dark:text-red-200 text-sm flex items-center gap-2">
          <AlertTriangle size={16} className="shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Grid: Left = Keys list, Right = Quick Setup Guide */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: API Keys List */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400">
              {t("settings.mcp.activeKeys")} ({keys.length})
            </h3>
          </div>

          {loading ? (
            <div className="p-8 text-center text-sm text-gray-400 bg-white dark:bg-gray-900/40 rounded-2xl border border-gray-200 dark:border-gray-800">
              {t("settings.uploading")}
            </div>
          ) : keys.length === 0 ? (
            <div className="p-8 text-center rounded-2xl border border-dashed border-gray-300 dark:border-gray-800 bg-white/50 dark:bg-gray-900/20 space-y-3">
              <div className="w-12 h-12 mx-auto rounded-full bg-gray-100 dark:bg-gray-800/80 flex items-center justify-center text-gray-400">
                <Key size={20} />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {t("settings.mcp.noKeys")}
                </p>
                <p className="text-xs text-gray-400 max-w-sm mx-auto">
                  {t("settings.mcp.emptyDesc")}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(true)}
                className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
              >
                <Plus size={14} />
                <span>{t("settings.mcp.createFirstKey")}</span>
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {keys.map((k) => (
                <div
                  key={k.id}
                  className="p-5 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900/60 shadow-xs flex flex-col sm:flex-row sm:items-start justify-between gap-4 hover:border-gray-300 dark:hover:border-gray-700 transition-colors"
                >
                  <div className="space-y-2.5 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-sm text-gray-900 dark:text-gray-100">
                        {k.name}
                      </span>
                      <code className="text-[11px] font-mono bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-md text-gray-600 dark:text-gray-300">
                        {k.prefix}
                      </code>
                    </div>

                    {/* Scopes Badges */}
                    <div className="flex flex-wrap gap-1.5">
                      {k.scopes.map((s) => {
                        const meta = getScopeMeta(s);
                        return (
                          <span
                            key={s}
                            className="text-[11px] px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-900/40 font-medium"
                          >
                            {meta.title}
                          </span>
                        );
                      })}
                    </div>

                    {/* Metadata line */}
                    <div className="text-xs text-gray-400 flex flex-wrap gap-x-4 gap-y-1 pt-1 font-mono">
                      <span>
                        {t("settings.mcp.lastUsed")}:{" "}
                        {k.last_used_at
                          ? new Date(k.last_used_at).toLocaleDateString()
                          : t("settings.mcp.neverUsed")}
                      </span>
                      {k.expires_at ? (
                        <span>
                          {t("settings.mcp.expiresAt")}:{" "}
                          {new Date(k.expires_at).toLocaleDateString()}
                        </span>
                      ) : (
                        <span>{t("settings.mcp.expiresNeverBadge")}</span>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setKeyToRevoke(k)}
                    className="inline-flex items-center gap-1.5 text-xs text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 font-medium self-end sm:self-center px-2.5 py-1.5 rounded-lg border border-red-200/60 dark:border-red-900/40 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors cursor-pointer shrink-0"
                    title={t("settings.mcp.revoke")}
                  >
                    <Trash2 size={13} />
                    <span>{t("settings.mcp.revoke")}</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Column: Quick Connect Guide */}
        <div className="lg:col-span-5 space-y-4">
          <div className="p-6 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900/60 shadow-xs space-y-5">
            <div className="flex items-center gap-2">
              <Sparkles size={16} className="text-blue-600 dark:text-blue-400" />
              <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">
                {t("settings.mcp.quickGuide")}
              </h3>
            </div>

            <ol className="space-y-3 text-xs text-gray-600 dark:text-gray-400">
              <li className="flex gap-2.5">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 font-semibold flex items-center justify-center text-[11px]">
                  1
                </span>
                <span>{t("settings.mcp.step1")}</span>
              </li>
              <li className="flex gap-2.5">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 font-semibold flex items-center justify-center text-[11px]">
                  2
                </span>
                <span>{t("settings.mcp.step2")}</span>
              </li>
              <li className="flex gap-2.5">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 font-semibold flex items-center justify-center text-[11px]">
                  3
                </span>
                <span>{t("settings.mcp.step3")}</span>
              </li>
            </ol>

            {/* Client selector tabs */}
            <div className="space-y-2 pt-2 border-t border-gray-100 dark:border-gray-800">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                  {t("settings.mcp.configExample")}
                </span>
                {/* Format switcher */}
                <div className="flex gap-1 text-[11px] p-0.5 rounded-lg bg-gray-100 dark:bg-gray-800">
                  <button
                    type="button"
                    onClick={() => setRunMode("local")}
                    className={`px-2 py-0.5 rounded-md font-medium transition-colors ${
                      runMode === "local"
                        ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-xs"
                        : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                    }`}
                  >
                    {t("settings.mcp.runLocal")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setRunMode("npx")}
                    className={`px-2 py-0.5 rounded-md font-medium transition-colors ${
                      runMode === "npx"
                        ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-xs"
                        : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                    }`}
                  >
                    {t("settings.mcp.runNpx")}
                  </button>
                </div>
              </div>

              {/* Client Choice */}
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => setConfigFormat("claude")}
                  className={`flex-1 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                    configFormat === "claude"
                      ? "border-blue-600 bg-blue-50/60 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 font-semibold"
                      : "border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/60 text-gray-600 dark:text-gray-400"
                  }`}
                >
                  Claude Desktop
                </button>
                <button
                  type="button"
                  onClick={() => setConfigFormat("cursor")}
                  className={`flex-1 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                    configFormat === "cursor"
                      ? "border-blue-600 bg-blue-50/60 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 font-semibold"
                      : "border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/60 text-gray-600 dark:text-gray-400"
                  }`}
                >
                  Cursor
                </button>
              </div>

              {/* Snippet box */}
              <div className="relative group">
                <pre className="p-3.5 rounded-xl bg-gray-950 text-gray-200 font-mono text-[11px] leading-relaxed overflow-x-auto max-h-56 border border-gray-800 selection:bg-blue-600/40">
                  {getActiveConfigJson("YOUR_API_TOKEN_HERE")}
                </pre>
                <button
                  type="button"
                  onClick={() =>
                    handleCopyText(getActiveConfigJson("YOUR_API_TOKEN_HERE"), "config")
                  }
                  className="absolute top-2 right-2 inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded-lg bg-gray-800/90 hover:bg-gray-700 text-gray-200 border border-gray-700 transition-colors shadow-xs cursor-pointer"
                >
                  {copiedConfig ? (
                    <>
                      <Check size={12} className="text-emerald-400" />
                      <span className="text-emerald-400">{t("settings.mcp.copied")}</span>
                    </>
                  ) : (
                    <>
                      <Copy size={12} />
                      <span>{t("settings.mcp.copyJson")}</span>
                    </>
                  )}
                </button>
              </div>

              <div className="pt-1 text-[11px] text-gray-400 space-y-1">
                <p className="font-semibold text-gray-500 dark:text-gray-400">
                  {t("settings.mcp.whereConfig")}
                </p>
                <p className="font-mono break-all text-[10px] text-gray-500">
                  {getConfigPathHint()}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal 1: Create Key Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white dark:bg-gray-900 rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-gray-200 dark:border-gray-800 space-y-5 my-8">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-800">
              <div className="flex items-center gap-2">
                <span className="p-1 rounded-md bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400">
                  <Key size={16} />
                </span>
                <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">
                  {t("settings.mcp.createBtn")}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-lg leading-none cursor-pointer"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                  {t("settings.mcp.keyName")} *
                </label>
                <input
                  type="text"
                  required
                  value={keyName}
                  onChange={(e) => setKeyName(e.target.value)}
                  placeholder={t("settings.mcp.keyNamePlaceholder")}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
                />
              </div>

              {/* Scopes with detailed explanations */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  {t("settings.mcp.scopes")}
                </label>
                <div className="space-y-2">
                  {[
                    "articles:read",
                    "articles:write",
                    "articles:manage",
                    "articles:delete",
                  ].map((scopeId) => {
                    const meta = getScopeMeta(scopeId);
                    const isChecked = selectedScopes.includes(scopeId);
                    return (
                      <div
                        key={scopeId}
                        onClick={() => handleScopeToggle(scopeId)}
                        className={`p-3 rounded-xl border transition-all cursor-pointer select-none flex items-start gap-3 ${
                          isChecked
                            ? "border-blue-500 bg-blue-50/40 dark:bg-blue-950/30"
                            : "border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 hover:border-gray-300 dark:hover:border-gray-700"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {}} // handled by parent onClick
                          className="mt-0.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 pointer-events-none"
                        />
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-gray-900 dark:text-gray-100">
                              {meta.title}
                            </span>
                            <code className="text-[10px] font-mono text-gray-400">
                              {scopeId}
                            </code>
                          </div>
                          <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-normal">
                            {meta.desc}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                  {t("settings.mcp.expires")}
                </label>
                <select
                  value={expiresInDays || ""}
                  onChange={(e) =>
                    setExpiresInDays(e.target.value ? Number(e.target.value) : undefined)
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                >
                  <option value="">{t("settings.mcp.expiresNever")}</option>
                  <option value="30">{t("settings.mcp.expires30")}</option>
                  <option value="90">{t("settings.mcp.expires90")}</option>
                  <option value="365">{t("settings.mcp.expires365")}</option>
                </select>
              </div>

              <div className="flex justify-end gap-2.5 pt-3 border-t border-gray-100 dark:border-gray-800">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
                >
                  {t("common.cancel")}
                </button>
                <button
                  type="submit"
                  disabled={creating || !keyName.trim() || selectedScopes.length === 0}
                  className="px-5 py-2.5 rounded-xl bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors cursor-pointer shadow-xs"
                >
                  {creating ? t("settings.uploading") : t("settings.mcp.createBtn")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Success Modal with Key & Injected Config Snippet */}
      {createdKey && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white dark:bg-gray-900 rounded-2xl max-w-xl w-full p-6 sm:p-7 shadow-2xl border border-gray-200 dark:border-gray-800 space-y-5 my-8">
            <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold text-base">
              <ShieldCheck size={20} />
              <span>{t("settings.mcp.createdSuccess")}</span>
            </div>

            <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/50 text-amber-900 dark:text-amber-200 text-xs flex items-start gap-2.5 leading-relaxed">
              <AlertTriangle size={15} className="shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
              <span>{t("settings.mcp.copyWarning")}</span>
            </div>

            {/* Token box */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                {t("settings.mcp.apiTokenLabel", { name: createdKey.name })}
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={createdKey.token}
                  className="w-full px-3.5 py-2.5 font-mono text-xs rounded-xl border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 select-all focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => handleCopyText(createdKey.token, "token")}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold rounded-xl bg-blue-600 text-white hover:bg-blue-700 shrink-0 cursor-pointer shadow-xs transition-colors"
                >
                  {copiedToken ? (
                    <>
                      <Check size={14} />
                      <span>{t("settings.mcp.copied")}</span>
                    </>
                  ) : (
                    <>
                      <Copy size={14} />
                      <span>{t("settings.mcp.copyToken")}</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Ready config with this key */}
            <div className="space-y-2 pt-2 border-t border-gray-100 dark:border-gray-800">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                  {t("settings.mcp.configSnippet")}
                </label>
                <div className="flex items-center gap-2">
                  {/* Local vs npx */}
                  <div className="flex gap-1 text-[11px] p-0.5 rounded-lg bg-gray-100 dark:bg-gray-800">
                    <button
                      type="button"
                      onClick={() => setRunMode("local")}
                      className={`px-2 py-0.5 rounded font-medium transition-colors ${
                        runMode === "local"
                          ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-xs"
                          : "text-gray-500"
                      }`}
                    >
                      {t("settings.mcp.runLocal")}
                    </button>
                    <button
                      type="button"
                      onClick={() => setRunMode("npx")}
                      className={`px-2 py-0.5 rounded font-medium transition-colors ${
                        runMode === "npx"
                          ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-xs"
                          : "text-gray-500"
                      }`}
                    >
                      {t("settings.mcp.runNpx")}
                    </button>
                  </div>

                  {/* Format */}
                  <div className="flex gap-1 text-[11px] p-0.5 rounded-lg bg-gray-100 dark:bg-gray-800">
                    <button
                      type="button"
                      onClick={() => setConfigFormat("claude")}
                      className={`px-2 py-0.5 rounded font-medium transition-colors ${
                        configFormat === "claude"
                          ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-xs"
                          : "text-gray-500"
                      }`}
                    >
                      Claude
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfigFormat("cursor")}
                      className={`px-2 py-0.5 rounded font-medium transition-colors ${
                        configFormat === "cursor"
                          ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-xs"
                          : "text-gray-500"
                      }`}
                    >
                      Cursor
                    </button>
                  </div>
                </div>
              </div>

              <div className="relative group">
                <pre className="p-3.5 rounded-xl bg-gray-950 text-gray-100 text-[11px] font-mono leading-relaxed overflow-x-auto max-h-52 border border-gray-800 selection:bg-blue-600/40">
                  {getActiveConfigJson(createdKey.token)}
                </pre>
                <button
                  type="button"
                  onClick={() =>
                    handleCopyText(getActiveConfigJson(createdKey.token), "config")
                  }
                  className="absolute top-2 right-2 inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded-lg bg-gray-800/90 hover:bg-gray-700 text-gray-200 border border-gray-700 transition-colors shadow-xs cursor-pointer"
                >
                  {copiedConfig ? (
                    <>
                      <Check size={12} className="text-emerald-400" />
                      <span className="text-emerald-400">{t("settings.mcp.copied")}</span>
                    </>
                  ) : (
                    <>
                      <Copy size={12} />
                      <span>{t("settings.mcp.copyJson")}</span>
                    </>
                  )}
                </button>
              </div>

              <p className="text-[11px] text-gray-400 font-mono pt-1">
                {getConfigPathHint()}
              </p>
            </div>

            <div className="pt-3 border-t border-gray-100 dark:border-gray-800 flex justify-end">
              <button
                type="button"
                onClick={() => setCreatedKey(null)}
                className="px-6 py-2.5 rounded-xl bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition-colors cursor-pointer shadow-xs"
              >
                {t("common.close")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 3: Custom Revoke Confirmation Modal */}
      {keyToRevoke && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white dark:bg-gray-900 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-200 dark:border-gray-800 space-y-4 my-8">
            <div className="flex items-center gap-3">
              <span className="p-2 rounded-xl bg-red-100 dark:bg-red-950/60 text-red-600 dark:text-red-400 shrink-0">
                <Trash2 size={18} />
              </span>
              <div>
                <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">
                  {t("settings.mcp.revokeTitle")}
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                  {keyToRevoke.name} ({keyToRevoke.prefix})
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200/60 dark:border-red-900/40 text-red-800 dark:text-red-300 text-xs leading-relaxed space-y-1.5">
              <p className="font-semibold">
                {t("settings.mcp.revokeQuestion", { name: keyToRevoke.name })}
              </p>
              <p className="text-red-700 dark:text-red-400">
                {t("settings.mcp.revokeWarning")}
              </p>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-gray-100 dark:border-gray-800">
              <button
                type="button"
                disabled={revoking}
                onClick={() => setKeyToRevoke(null)}
                className="px-4 py-2 rounded-xl text-xs font-medium text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
              >
                {t("common.cancel")}
              </button>
              <button
                type="button"
                disabled={revoking}
                onClick={confirmRevoke}
                className="px-4 py-2 rounded-xl bg-red-600 text-white text-xs font-semibold hover:bg-red-700 disabled:opacity-50 transition-colors cursor-pointer shadow-xs"
              >
                {revoking ? t("settings.uploading") : t("settings.mcp.revoke")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
