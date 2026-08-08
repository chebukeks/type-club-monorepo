import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { articlesApi, collaborationApi, Article } from "../api";
import { useAuth } from "../context/AuthContext";
import { MarkdownEditor } from "../components/MarkdownEditor";
import TableOfContents from "../components/TableOfContents";
import ArticleStats from "../components/ArticleStats";
import CommentSection from "../components/CommentSection";
import { Edit, Lightbulb, Shield } from "lucide-react";
import type { TocItem } from "@type-club/editor";

export default function ReadArticle() {
  const { username, slug } = useParams<{ username: string; slug: string }>();
  const { user } = useAuth();
  const [article, setArticle] = useState<Article | null>(null);
  const [userRole, setUserRole] = useState<"author" | "co_author" | "editor" | null>(null);
  const [toc, setToc] = useState<TocItem[]>([]);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    if (!username || !slug) return;
    articlesApi.getByPath(username, slug)
      .then((a) => setArticle(a))
      .catch((err) => {
        setError(err.message);
        if (err.message === "Not authenticated") navigate("/login");
      });
  }, [username, slug, navigate]);

  useEffect(() => {
    if (!article || !user) {
      setUserRole(null);
      return;
    }
    if (user.id === article.author_id) {
      setUserRole("author");
    } else {
      collaborationApi.list(article.id).then((list) => {
        const me = list.find((c) => c.user_id === user.id);
        setUserRole((me?.role as any) ?? null);
      }).catch(() => setUserRole(null));
    }
  }, [article, user]);

  if (error) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 text-center">
        <h1 className="text-2xl font-bold mb-2">Article not found</h1>
        <p className="text-gray-500 mb-4">{error}</p>
        <Link to="/" className="text-blue-600 hover:underline">Go home</Link>
      </div>
    );
  }

  if (!article) {
    return <div className="max-w-3xl mx-auto px-4 py-20 text-center text-gray-400">Loading...</div>;
  }

  const isModerator = user?.role === "moderator";
  const canEdit = userRole === "author" || userRole === "co_author";
  const canSuggest = userRole === "author" || userRole === "co_author" || userRole === "editor";

  const handleBlock = async () => {
    try {
      await articlesApi.moderate(article.id, "block");
      setArticle({ ...article, access_state: "blocked" });
    } catch {}
  };

  const handleUnblock = async () => {
    try {
      await articlesApi.moderate(article.id, "unblock");
      setArticle({ ...article, access_state: "private" });
    } catch {}
  };

  const handleDelete = async () => {
    if (!confirm("Delete this article?")) return;
    try {
      await articlesApi.delete(article.id);
      navigate("/articles");
    } catch {}
  };

  return (
    <div className="max-w-3xl mx-auto px-2 sm:px-4 py-8 relative">
      <div className="w-full">
        <div className="mb-6">
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
            <Link to={`/${article.author_nickname}`} className="hover:text-blue-600">
              {article.author_nickname}
            </Link>
            <span>·</span>
            <span>{new Date(article.updated_at).toLocaleDateString()}</span>
            {article.access_state !== "public" && (
              <>
                <span>·</span>
                <span className="capitalize text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800">
                  {article.access_state}
                </span>
              </>
            )}
          </div>
          <h1 className="text-3xl md:text-4xl font-bold">{article.title}</h1>
          
          {(canEdit || canSuggest) && (
            <div className="flex items-center gap-2 mt-4">
              {canEdit && (
                <Link
                  to={`/editor/${article.id}`}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-800 text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                >
                  <Edit size={14} /> Edit
                </Link>
              )}
              {canSuggest && (
                <Link
                  to={`/editor/${article.id}?mode=suggest`}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 text-sm font-medium border border-amber-200 dark:border-amber-800 hover:bg-amber-100 dark:hover:bg-amber-900/60 transition-colors"
                >
                  <Lightbulb size={14} className="text-amber-500" /> Suggest
                </Link>
              )}
            </div>
          )}

          {isModerator && (
            <div className="flex items-center gap-2 mt-4">
              <span className="inline-flex items-center gap-1 text-xs text-gray-400">
                <Shield size={12} /> Moderator
              </span>
              {article.access_state === "blocked" ? (
                <button
                  onClick={handleUnblock}
                  className="px-3 py-1.5 rounded-lg bg-green-100 dark:bg-green-950 text-green-700 text-sm font-medium hover:bg-green-200 dark:hover:bg-green-900 transition-colors"
                >
                  Unblock
                </button>
              ) : (
                <button
                  onClick={handleBlock}
                  className="px-3 py-1.5 rounded-lg bg-yellow-100 dark:bg-yellow-950 text-yellow-700 text-sm font-medium hover:bg-yellow-200 dark:hover:bg-yellow-900 transition-colors"
                >
                  Block
                </button>
              )}
              <button
                onClick={handleDelete}
                className="px-3 py-1.5 rounded-lg bg-red-100 dark:bg-red-950 text-red-600 text-sm font-medium hover:bg-red-200 dark:hover:bg-red-900 transition-colors"
              >
                Delete
              </button>
            </div>
          )}
        </div>

        <div className="min-h-[50vh] border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden bg-[var(--bg-base)] mb-8">
          <MarkdownEditor
            content={article.content}
            editorMode="preview"
            onChange={() => {}}
            readOnly
            onTocUpdate={setToc}
          />
        </div>

        <ArticleStats
          articleId={article.id}
          initialViews={article.view_count}
          initialLikes={article.like_count}
          initialLiked={article.liked_by_user}
        />

        <CommentSection articleId={article.id} />
      </div>

      {/* Desktop ToC sidebar in right margin without displacing centered article */}
      <div className="hidden xl:block absolute left-[calc(100%+2.5rem)] top-8 h-full pointer-events-none">
        <div className="sticky top-24 pointer-events-auto">
          <TableOfContents variant="sidebar" toc={toc} />
        </div>
      </div>

      {/* Mobile / Tablet floating ToC button */}
      <TableOfContents variant="floating" toc={toc} className="xl:hidden" />
    </div>
  );
}
