import React, { useEffect, useState } from "react";
import { apiKeysApi, ApiKeyItem, ApiKeyCreatedItem } from "../api";
import { useLanguage } from "../context/LanguageContext";

export function ApiKeySettings() {
  const { t } = useLanguage();
  const [keys, setKeys] = useState<ApiKeyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createdKey, setCreatedKey] = useState<ApiKeyCreatedItem | null>(null);

  // Form fields
  const [keyName, setKeyName] = useState("");
  const [selectedScopes, setSelectedScopes] = useState<string[]>([
    "articles:read",
    "articles:write",
    "articles:manage",
  ]);
  const [expiresInDays, setExpiresInDays] = useState<number | undefined>(undefined);
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [configFormat, setConfigFormat] = useState<"claude" | "cursor" | "cli">("claude");

  const loadKeys = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await apiKeysApi.list();
      setKeys(data);
    } catch (err: any) {
      setError(err.message || "Failed to load API keys");
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
      setError(err.message || "Failed to create API key");
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (key: ApiKeyItem) => {
    const confirmed = window.confirm(
      t("settings.mcp.revokeConfirm", { name: key.name })
    );
    if (!confirmed) return;
    try {
      await apiKeysApi.delete(key.id);
      loadKeys();
    } catch (err: any) {
      setError(err.message || "Failed to delete API key");
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const currentOrigin =
    typeof window !== "undefined" ? window.location.origin : "https://type-club.ru";

  const getClaudeConfig = (token: string) => {
    return JSON.stringify(
      {
        mcpServers: {
          "type-club": {
            command: "npx",
            args: ["-y", "@type-club/mcp-server"],
            env: {
              TYPECLUB_API_KEY: token,
              TYPECLUB_API_URL: currentOrigin,
            },
          },
        },
      },
      null,
      2
    );
  };

  const getCursorConfig = (token: string) => {
    return JSON.stringify(
      {
        typeClub: {
          command: "npx -y @type-club/mcp-server",
          env: {
            TYPECLUB_API_KEY: token,
            TYPECLUB_API_URL: currentOrigin,
          },
        },
      },
      null,
      2
    );
  };

  return (
    <div className="space-y-6">
      <div className="border-b border-gray-200 dark:border-gray-800 pb-4">
        <h2 className="text-xl font-bold">{t("settings.mcp.title")}</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          {t("settings.mcp.desc")}
        </p>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950 text-red-600 text-sm">
          {error}
        </div>
      )}

      <div className="flex justify-between items-center">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
          {keys.length > 0 ? `Активные ключи (${keys.length})` : ""}
        </span>
        <button
          type="button"
          onClick={() => {
            setShowCreateModal(true);
            setError("");
          }}
          className="px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors"
        >
          {t("settings.mcp.createBtn")}
        </button>
      </div>

      {loading ? (
        <div className="text-center py-8 text-gray-400">{t("settings.uploading")}</div>
      ) : keys.length === 0 ? (
        <div className="text-center py-8 px-4 rounded-xl border border-dashed border-gray-300 dark:border-gray-700 text-gray-500 text-sm">
          {t("settings.mcp.noKeys")}
        </div>
      ) : (
        <div className="space-y-3">
          {keys.map((k) => (
            <div
              key={k.id}
              className="p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-gray-900 dark:text-gray-100">
                    {k.name}
                  </span>
                  <code className="text-xs bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded text-gray-600 dark:text-gray-400">
                    {k.prefix}
                  </code>
                </div>
                <div className="flex flex-wrap gap-1 mt-1">
                  {k.scopes.map((s) => (
                    <span
                      key={s}
                      className="text-[11px] px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400"
                    >
                      {s.replace("articles:", "")}
                    </span>
                  ))}
                </div>
                <div className="text-xs text-gray-400 flex gap-3 pt-1">
                  <span>
                    {t("settings.mcp.lastUsed")}:{" "}
                    {k.last_used_at
                      ? new Date(k.last_used_at).toLocaleDateString()
                      : t("settings.mcp.neverUsed")}
                  </span>
                  {k.expires_at && (
                    <span>
                      {t("settings.mcp.expiresAt")}:{" "}
                      {new Date(k.expires_at).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleDelete(k)}
                className="text-xs text-red-600 hover:text-red-700 dark:hover:text-red-400 font-medium self-end sm:self-center"
              >
                {t("settings.mcp.revoke")}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Create Key Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl max-w-md w-full p-6 shadow-xl border border-gray-200 dark:border-gray-800 space-y-4">
            <h3 className="text-lg font-bold">{t("settings.mcp.createBtn")}</h3>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  {t("settings.mcp.keyName")}
                </label>
                <input
                  type="text"
                  required
                  value={keyName}
                  onChange={(e) => setKeyName(e.target.value)}
                  placeholder={t("settings.mcp.keyNamePlaceholder")}
                  className="w-full px-4 py-2 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  {t("settings.mcp.scopes")}
                </label>
                <div className="space-y-2 text-sm">
                  {[
                    { id: "articles:read", label: t("settings.mcp.scopeRead") },
                    { id: "articles:write", label: t("settings.mcp.scopeWrite") },
                    { id: "articles:manage", label: t("settings.mcp.scopeManage") },
                    { id: "articles:delete", label: t("settings.mcp.scopeDelete") },
                  ].map((s) => (
                    <label
                      key={s.id}
                      className="flex items-center gap-2 cursor-pointer select-none"
                    >
                      <input
                        type="checkbox"
                        checked={selectedScopes.includes(s.id)}
                        onChange={() => handleScopeToggle(s.id)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span>{s.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  {t("settings.mcp.expires")}
                </label>
                <select
                  value={expiresInDays || ""}
                  onChange={(e) =>
                    setExpiresInDays(e.target.value ? Number(e.target.value) : undefined)
                  }
                  className="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">{t("settings.mcp.expiresNever")}</option>
                  <option value="30">{t("settings.mcp.expires30")}</option>
                  <option value="90">{t("settings.mcp.expires90")}</option>
                  <option value="365">{t("settings.mcp.expires365")}</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-xl text-sm text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                >
                  {t("common.cancel")}
                </button>
                <button
                  type="submit"
                  disabled={creating || !keyName.trim() || selectedScopes.length === 0}
                  className="px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {creating ? t("settings.uploading") : t("settings.mcp.createBtn")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Success Modal (Token & Config Snippet) */}
      {createdKey && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-gray-200 dark:border-gray-800 space-y-4">
            <h3 className="text-lg font-bold text-green-600 dark:text-green-400 flex items-center gap-2">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
              {t("settings.mcp.createdSuccess")}
            </h3>

            <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800/50 text-amber-800 dark:text-amber-200 text-xs">
              ⚠️ {t("settings.mcp.copyWarning")}
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1">
                API Token
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={createdKey.token}
                  className="w-full px-3 py-2 font-mono text-xs rounded-xl border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-950 select-all"
                />
                <button
                  type="button"
                  onClick={() => handleCopy(createdKey.token)}
                  className="px-3 py-2 text-xs font-semibold rounded-xl bg-blue-600 text-white hover:bg-blue-700 shrink-0"
                >
                  {copied ? t("settings.mcp.copied") : "Copy"}
                </button>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                  {t("settings.mcp.configSnippet")}
                </label>
                <div className="flex gap-1 text-xs">
                  <button
                    type="button"
                    onClick={() => setConfigFormat("claude")}
                    className={`px-2 py-0.5 rounded ${
                      configFormat === "claude"
                        ? "bg-blue-600 text-white"
                        : "bg-gray-100 dark:bg-gray-800 text-gray-500"
                    }`}
                  >
                    Claude Desktop
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfigFormat("cursor")}
                    className={`px-2 py-0.5 rounded ${
                      configFormat === "cursor"
                        ? "bg-blue-600 text-white"
                        : "bg-gray-100 dark:bg-gray-800 text-gray-500"
                    }`}
                  >
                    Cursor / Other
                  </button>
                </div>
              </div>

              <div className="relative">
                <pre className="p-3 rounded-xl bg-gray-950 text-gray-100 text-[11px] font-mono overflow-x-auto max-h-44 border border-gray-800">
                  {configFormat === "claude"
                    ? getClaudeConfig(createdKey.token)
                    : getCursorConfig(createdKey.token)}
                </pre>
                <button
                  type="button"
                  onClick={() =>
                    handleCopy(
                      configFormat === "claude"
                        ? getClaudeConfig(createdKey.token)
                        : getCursorConfig(createdKey.token)
                    )
                  }
                  className="absolute top-2 right-2 px-2 py-1 text-[10px] font-medium rounded-lg bg-gray-800 hover:bg-gray-700 text-white"
                >
                  {copied ? t("settings.mcp.copied") : "Copy JSON"}
                </button>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setCreatedKey(null)}
                className="px-5 py-2 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700"
              >
                {t("common.close")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
