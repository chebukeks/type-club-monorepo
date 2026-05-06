import { Link } from "react-router-dom";
import { ArticleListItem } from "../api";

export default function ArticleCard({ article }: { article: ArticleListItem }) {
  return (
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
            <span className="capitalize text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800">
              {article.access_state}
            </span>
          </>
        )}
      </div>
    </Link>
  );
}
