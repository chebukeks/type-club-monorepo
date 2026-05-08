/**
 * PublishModal.tsx — Share article to type-club.ru from desktop app.
 */
import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useEditor } from "../context/EditorContext";
import { articlesApi } from "../api";

interface PublishModalProps {
  onClose: () => void;
}

const states = [
  { value: "private", label: "Private", desc: "Only you can see it" },
  { value: "link", label: "Link access", desc: "Anyone with the link" },
  { value: "public", label: "Public", desc: "Visible on the articles page" },
];

const VALID_SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

function slugError(s: string): string | null {
  if (!s.trim()) return "Slug cannot be empty";
  if (!VALID_SLUG.test(s)) return "Use only a–z, 0–9, and hyphens (not at start/end, no consecutive)";
  if (s.length > 80) return "Slug is too long (max 80)";
  return null;
}

export function PublishModal({ onClose }: PublishModalProps) {
  const { user } = useAuth();
  const { state } = useEditor();
  const username = user?.nickname || "username";

  const activeTab = state.tabs.find((t) => t.id === state.activeTabId);
  const articleTitle = activeTab?.name?.replace(/\.md$/, "") || "Untitled";
  const articleContent = activeTab?.content || "";

  const [accessState, setAccessState] = useState("private");
  const [slug, setSlug] = useState(_slugify(articleTitle));
  const [copied, setCopied] = useState(false);
  const [status, setStatus] = useState<"idle" | "publishing" | "done" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [articleId, setArticleId] = useState<number | null>(null);

  const handleSlugChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const filtered = raw
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "")
      .replace(/--+/g, "-");
    if (filtered.length <= 80) setSlug(filtered);
  };

  const finalSlug = slug.trim() || _slugify(articleTitle);
  const serr = slugError(finalSlug);

  const handlePublish = async () => {
    if (serr) return;
    setStatus("publishing");
    setErrorMsg("");
    try {
      const res = await articlesApi.create({
        title: articleTitle,
        content: articleContent,
        slug: finalSlug,
      });
      setArticleId(res.id);
      await articlesApi.update(res.id, {
        access_state: accessState,
        slug: finalSlug,
      });
      setStatus("done");
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to publish");
      setStatus("error");
    }
  };

  const handleCopy = () => {
    const url = `https://type-club.ru/${username}/${finalSlug}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  if (status === "done") {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center"
        style={{ background: "rgba(0,0,0,0.5)" }}
        onClick={onClose}
      >
        <div
          className="rounded-xl shadow-2xl w-full p-6 text-center"
          style={{
            maxWidth: "400px",
            margin: "0 16px",
            background: "var(--bg-elevated)",
            border: "1px solid var(--border-strong)",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="text-3xl mb-3">✓</div>
          <h2 className="text-lg font-semibold mb-2" style={{ color: "var(--text-primary)" }}>
            Published!
          </h2>
          <p className="text-sm mb-4" style={{ color: "var(--text-muted)" }}>
            {`type-club.ru/${username}/${finalSlug}`}
          </p>
          <button
            onClick={handleCopy}
            className="px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors mr-2"
            style={{ background: "var(--accent)" }}
          >
            {copied ? "Copied!" : "Copy Link"}
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            style={{
              background: "var(--bg-hover)",
              color: "var(--text-secondary)",
            }}
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.5)" }}
      onClick={onClose}
    >
      <div
        className="rounded-xl shadow-2xl w-full p-6"
        style={{
          maxWidth: "430px",
          margin: "0 16px",
          background: "var(--bg-elevated)",
          border: "1px solid var(--border-strong)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>
            Share to Type Club
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg transition-colors"
            style={{ color: "var(--text-dim)" }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {status === "error" && (
          <div
            className="p-3 rounded-lg text-sm mb-4"
            style={{ background: "rgba(232,17,35,0.1)", color: "#e81123" }}
          >
            {errorMsg}
          </div>
        )}

        <div className="text-xs mb-4" style={{ color: "var(--text-muted)" }}>
          Publishing <strong style={{ color: "var(--text-primary)" }}>{articleTitle}</strong>
        </div>

        <div className="space-y-2 mb-5">
          {states.map((s) => (
            <button
              key={s.value}
              onClick={() => setAccessState(s.value)}
              className="w-full text-left p-3 rounded-lg border transition-colors"
              style={{
                borderColor: accessState === s.value ? "var(--accent)" : "var(--border-default)",
                background:
                  accessState === s.value ? "rgba(108,140,255,0.08)" : "transparent",
              }}
            >
              <div className="font-medium text-sm" style={{ color: "var(--text-primary)" }}>
                {s.label}
              </div>
              <div className="text-xs mt-0.5" style={{ color: "var(--text-dim)" }}>
                {s.desc}
              </div>
            </button>
          ))}
        </div>

        <div className="mb-5">
          <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>
            Article slug
          </label>
          <div className="flex items-center gap-1 text-xs" style={{ color: "var(--text-dim)" }}>
            <span>type-club.ru/{username}/</span>
            <input
              type="text"
              value={slug}
              onChange={handleSlugChange}
              className="flex-1 px-2 py-1 rounded outline-none text-sm transition-colors"
              style={{
                background: "var(--bg-input)",
                border: serr ? "1px solid #e81123" : "1px solid var(--border-default)",
                color: "var(--text-primary)",
              }}
              placeholder="my-article"
            />
            <button
              onClick={handleCopy}
              className="shrink-0 p-1 rounded transition-colors"
              style={{ color: "var(--text-dim)" }}
              title="Copy link"
            >
              {copied ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                  <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                </svg>
              )}
            </button>
          </div>
          {serr && (
            <p className="text-xs mt-1" style={{ color: "#e81123" }}>
              {serr}
            </p>
          )}
        </div>

        <button
          onClick={handlePublish}
          disabled={!!serr || status === "publishing"}
          className="w-full py-2 rounded-lg text-sm font-semibold text-white transition-colors"
          style={{
            background:
              serr || status === "publishing" ? "var(--text-disabled)" : "var(--accent)",
          }}
        >
          {status === "publishing" ? "Publishing..." : "Publish"}
        </button>
      </div>
    </div>
  );
}

function _slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[-\s]+/g, "-");
}
