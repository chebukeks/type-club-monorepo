import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import { X, Copy, Check, ExternalLink } from "lucide-react";
import CollaborationModal from "./CollaborationModal";

interface PublishModalProps {
  currentState: string;
  currentSlug: string;
  articleId?: number | null;
  onApply: (accessState: string, slug: string) => void;
  onClose: () => void;
}

const VALID_SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

function slugError(s: string): string | null {
  if (!s.trim()) return "Slug cannot be empty";
  if (!VALID_SLUG.test(s)) return "Use only a–z, 0–9, and hyphens (not at start/end, no consecutive)";
  if (s.length > 80) return "Slug is too long (max 80)";
  return null;
}

export default function PublishModal({
  currentState,
  currentSlug,
  articleId,
  onApply,
  onClose,
}: PublishModalProps) {
  const { user } = useAuth();
  const { t } = useLanguage();
  const username = user?.nickname || "username";
  const [accessState, setAccessState] = useState(currentState);
  const [slug, setSlug] = useState(currentSlug || generateRandomSlug());
  const [copied, setCopied] = useState(false);
  const [showCollab, setShowCollab] = useState(false);

  const states = [
    { value: "private", label: t('publish.private'), desc: t('publish.privateDesc') },
    { value: "link", label: t('publish.link'), desc: t('publish.linkDesc') },
    { value: "public", label: t('publish.public'), desc: t('publish.publicDesc') },
  ];

  const handleSlugChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const filtered = raw.toLowerCase().replace(/[^a-z0-9-]/g, "").replace(/--+/g, "-");
    if (filtered.length <= 80) setSlug(filtered);
  };

  const finalSlug = slug.trim() || generateRandomSlug();
  const error = slugError(finalSlug);

  const handleApply = () => {
    if (error) return;
    onApply(accessState, finalSlug);
    onClose();
  };

  const handleCopy = () => {
    const url = `https://type-club.ru/${username}/${finalSlug}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-150" onClick={onClose}>
      <div
        className="bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl border border-gray-200/80 dark:border-gray-800/80 rounded-2xl shadow-2xl w-full max-w-md p-6 mx-4 animate-in fade-in zoom-in-95 duration-150 ease-out"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold">{t('publish.title')}</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-3 mb-6">
          {states.map((s) => (
            <button
              key={s.value}
              onClick={() => setAccessState(s.value)}
              className={`w-full text-left p-3 rounded-xl border transition-colors ${
                accessState === s.value
                  ? "border-blue-500 bg-blue-50 dark:bg-blue-950 dark:border-blue-600"
                  : "border-gray-200 dark:border-gray-700 hover:border-gray-300"
              }`}
            >
              <div className="font-medium text-sm">{s.label}</div>
              <div className="text-xs text-gray-500 mt-0.5">{s.desc}</div>
            </button>
          ))}
        </div>

        <div className="mb-6">
          <label className="block text-sm font-medium mb-1">{t('publish.slug')}</label>
          <div className="flex items-center gap-1 text-sm text-gray-400">
            <span>type-club.ru/{username}/</span>
            <input
              type="text"
              value={slug}
              onChange={handleSlugChange}
              className={`flex-1 px-2 py-1 rounded border bg-transparent text-gray-900 dark:text-gray-100 outline-none transition-colors ${
                error ? "border-red-400 dark:border-red-600" : "border-gray-200 dark:border-gray-700 focus:border-blue-500"
              }`}
              placeholder="my-article"
            />
          </div>
          {error && (
            <p className="text-red-500 text-xs mt-1">{error}</p>
          )}
        </div>

        <div className="flex gap-2 mb-4">
          <Link
            to={`/${username}/${finalSlug}`}
            target="_blank"
            className="flex-1 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-medium text-center hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors inline-flex items-center justify-center gap-1.5"
          >
            <ExternalLink size={14} /> {t('publish.viewArticle')}
          </Link>
          <button
            onClick={handleCopy}
            className="flex-1 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors inline-flex items-center justify-center gap-1.5"
          >
            {copied ? <><Check size={14} className="text-green-500" /> {t('publish.copied')}</> : <><Copy size={14} /> {t('publish.copyLink')}</>}
          </button>
        </div>

        <button
          onClick={handleApply}
          disabled={!!error}
          className="w-full py-2.5 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {t('publish.apply')}
        </button>

        {articleId && (
          <button
            onClick={() => setShowCollab(true)}
            className="w-full mt-2 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            {t('publish.collabBtn')}
          </button>
        )}
      </div>
      {showCollab && articleId && (
        <CollaborationModal
          articleId={articleId}
          onClose={() => setShowCollab(false)}
          onBack={() => setShowCollab(false)}
        />
      )}
    </div>
  );
}

export function generateRandomSlug(): string {
  return Math.random().toString(36).substring(2, 10);
}

function _slugify(text: string): string {
  const cleaned = text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[-\s]+/g, "-");
  return cleaned || generateRandomSlug();
}
