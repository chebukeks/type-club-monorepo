import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { articlesApi, Article } from "../api";
import { useAuth } from "../context/AuthContext";
import { MarkdownEditor } from "../components/MarkdownEditor";
import ArticleStats from "../components/ArticleStats";
import CommentSection from "../components/CommentSection";
import { Edit, Shield } from "lucide-react";

export default function ReadArticle() {
  const { username, slug } = useParams<{ username: string; slug: string }>();
  const { user } = useAuth();
  const [article, setArticle] = useState<Article | null>(null);
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

  const isAuthor = user?.id === article.author_id;
  const isModerator = user?.role === "moderator";

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
    <div className="max-w-3xl mx-auto px-2 sm:px-4 py-8">
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
        {isAuthor && (
          <Link
            to={`/editor/${article.id}`}
            className="inline-flex items-center gap-1 mt-4 px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-800 text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          >
            <Edit size={14} /> Edit
          </Link>
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

      <div className="min-h-[50vh] border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden bg-[var(--bg-base)]">
        <MarkdownEditor
          content={article.content}
          editorMode="preview"
          onChange={() => {}}
          readOnly
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
  );
}
