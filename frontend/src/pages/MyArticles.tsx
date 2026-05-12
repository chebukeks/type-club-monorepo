import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { articlesApi, ArticleListItem } from "../api";
import ArticleCard from "../components/ArticleCard";
import { Trash2, Edit } from "lucide-react";

export default function MyArticles() {
  const [articles, setArticles] = useState<ArticleListItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchArticles = () => {
    setLoading(true);
    articlesApi.myList().then(setArticles).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => { fetchArticles(); }, []);

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this article?")) return;
    await articlesApi.delete(id);
    fetchArticles();
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold">My Articles</h1>
        <Link to="/editor" className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700">
          New Article
        </Link>
      </div>
      {loading ? (
        <div className="text-center py-20 text-gray-400">Loading...</div>
      ) : articles.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          You haven't written any articles yet.{" "}
          <Link to="/editor" className="text-blue-600 hover:underline">Write one now</Link>
        </div>
      ) : (
        <div className="space-y-3">
          {articles.map((a) => (
            <div key={a.id} className="flex items-center gap-4 p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
              <div className="flex-1 min-w-0">
                <Link to={`/${a.author_nickname}/${a.slug}`} className="font-semibold hover:text-blue-600 line-clamp-1">
                  {a.title}
                </Link>
                <div className="text-sm text-gray-500 mt-0.5">
                  {new Date(a.updated_at).toLocaleDateString()}
                  <span className="mx-2">·</span>
                  <span className="capitalize text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800">
                    {a.access_state}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Link to={`/editor/${a.id}`}
                  className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  title="Edit">
                  <Edit size={16} />
                </Link>
                <button onClick={() => handleDelete(a.id)}
                  className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-950 text-red-500 transition-colors"
                  title="Delete">
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
