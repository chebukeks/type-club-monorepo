/**
 * PublishModal.tsx — Share article to type-club.ru from desktop app.
 * Uses shared modal CSS classes from index.css.
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
  const articleContent = activeTab?.content || "";
  const defaultTitle = activeTab?.fileName?.replace(/\.md$/, "") || "Untitled";

  const [title, setTitle] = useState(defaultTitle);
  const [accessState, setAccessState] = useState("private");
  const [slug, setSlug] = useState(_slugify(defaultTitle));
  const [copied, setCopied] = useState(false);
  const [status, setStatus] = useState<"idle" | "publishing" | "done" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const titleError = !title.trim() ? "Title cannot be empty" : null;

  const handleSlugChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const filtered = raw
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "")
      .replace(/--+/g, "-");
    if (filtered.length <= 80) setSlug(filtered);
  };

  const finalSlug = slug.trim() || _slugify(title);
  const serr = slugError(finalSlug);

  const handlePublish = async () => {
    if (serr || titleError) return;
    setStatus("publishing");
    setErrorMsg("");
    try {
      const res = await articlesApi.create({
        title: title.trim(),
        content: articleContent,
        slug: finalSlug,
      });
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
      <div className="modal-overlay" onClick={onClose}>
        <div
          className="modal-panel"
          style={{ textAlign: "center" }}
          onClick={(e) => e.stopPropagation()}
        >
          <div style={{ fontSize: "28px", marginBottom: "12px", color: "var(--accent)" }}>✓</div>
          <h2 className="modal-title" style={{ marginBottom: "8px" }}>Published!</h2>
          <p style={{ fontSize: "13px", color: "var(--text-muted)", marginBottom: "16px" }}>
            {`type-club.ru/${username}/${finalSlug}`}
          </p>
          <div style={{ display: "flex", gap: "8px", justifyContent: "center" }}>
            <button onClick={handleCopy} className="btn-primary" style={{ width: "auto" }}>
              {copied ? "Copied!" : "Copy Link"}
            </button>
            <button onClick={onClose} className="btn-secondary">
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-panel"
        style={{ maxWidth: "430px" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2 className="modal-title">Share to Type Club</h2>
          <button onClick={onClose} className="modal-close">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {status === "error" && <div className="modal-error">{errorMsg}</div>}

        <div style={{ marginBottom: "16px" }}>
          <label className="modal-label">Title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className={`modal-input ${titleError ? "error" : ""}`}
            placeholder="Article title"
          />
          {titleError && <p className="modal-field-error">{titleError}</p>}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "20px" }}>
          {states.map((s) => (
            <button
              key={s.value}
              onClick={() => setAccessState(s.value)}
              className={`modal-option ${accessState === s.value ? "selected" : ""}`}
            >
              <div style={{ fontSize: "13px", fontWeight: 500, color: "var(--text-primary)" }}>
                {s.label}
              </div>
              <div style={{ fontSize: "11px", marginTop: "2px", color: "var(--text-dim)" }}>
                {s.desc}
              </div>
            </button>
          ))}
        </div>

        <div style={{ marginBottom: "20px" }}>
          <label className="modal-label">Article slug</label>
          <div style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "12px", color: "var(--text-dim)" }}>
            <span>type-club.ru/{username}/</span>
            <input
              type="text"
              value={slug}
              onChange={handleSlugChange}
              className={`modal-input ${serr ? "error" : ""}`}
              style={{ flex: 1, padding: "6px 8px" }}
              placeholder="my-article"
            />
            <button
              onClick={handleCopy}
              className="modal-close"
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
          {serr && <p className="modal-field-error">{serr}</p>}
        </div>

        <button
          onClick={handlePublish}
          disabled={!!serr || !!titleError || status === "publishing"}
          className="btn-primary"
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
