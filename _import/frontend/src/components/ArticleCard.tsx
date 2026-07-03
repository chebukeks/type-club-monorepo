import { Link } from "react-router-dom";
import { ArticleListItem, articlesApi } from "../api";

interface Props {
  article: ArticleListItem;
  isModerator?: boolean;
  onModerate?: () => void;
}

export default function ArticleCard({ article, isModerator, onModerate }: Props) {
  const handleBlock = async (e: React.MouseEvent) => {
    e.preventDefault();
    try {
      await articlesApi.moderate(article.id, "block");
      onModerate?.();
    } catch {}
  };

  const handleUnblock = async (e: React.MouseEvent) => {
    e.preventDefault();
    try {
      await articlesApi.moderate(article.id, "unblock");
      onModerate?.();
    } catch {}
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!confirm("Delete this article?")) return;
    try {
      await articlesApi.delete(article.id);
      onModerate?.();
    } catch {}
  };

  return (
    <div className="relative">
      <Link
        to={`/${article.author_nickname}/${article.slug}`}
        className="block p-5 rounded-xl border border-gray-200 dark:border-gray-800 hover:border-blue-300 dark:hover:border-blue-700 transition-colors bg-white dark:bg-gray-900"
      >
        <h3 className="font-semibold text-lg mb-1 line-clamp-2">{article.title}</h3>
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <span>by {article.author_nickname}</span>
          <span>·</span>
          <span>{new Date(article.updated_at).toLocaleDateString()}</span>
          {article.access_state !== "public" && (
            <>
              <span>·</span>
              <span className={`capitalize text-xs px-2 py-0.5 rounded-full ${
                article.access_state === "blocked"
                  ? "bg-red-100 dark:bg-red-950 text-red-600"
                  : "bg-gray-100 dark:bg-gray-800"
              }`}>
                {article.access_state}
              </span>
            </>
          )}
        </div>
      </Link>
      {isModerator && (
        <div className="absolute top-3 right-3 flex gap-1">
          {article.access_state === "blocked" ? (
            <button
              onClick={handleUnblock}
              className="px-2 py-1 text-xs rounded-md bg-green-100 dark:bg-green-950 text-green-700 hover:bg-green-200 dark:hover:bg-green-900 transition-colors"
            >
              Unblock
            </button>
          ) : (
            <button
              onClick={handleBlock}
              className="px-2 py-1 text-xs rounded-md bg-yellow-100 dark:bg-yellow-950 text-yellow-700 hover:bg-yellow-200 dark:hover:bg-yellow-900 transition-colors"
            >
              Block
            </button>
          )}
          <button
            onClick={handleDelete}
            className="px-2 py-1 text-xs rounded-md bg-red-100 dark:bg-red-950 text-red-600 hover:bg-red-200 dark:hover:bg-red-900 transition-colors"
          >
            Delete
          </button>
        </div>
      )}
    </div>
  );
}
