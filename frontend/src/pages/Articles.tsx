import { useCallback, useEffect, useState } from "react";
import { articlesApi, ArticleListItem } from "../api";
import { useAuth } from "../context/AuthContext";
import ArticleCard from "../components/ArticleCard";

export default function Articles() {
  const { user } = useAuth();
  const [articles, setArticles] = useState<ArticleListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const isModerator = user?.role === "moderator";

  const fetchArticles = useCallback(() => {
    articlesApi.list().then(setArticles).catch(() => {}).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchArticles();
  }, [fetchArticles]);

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Articles</h1>
      {loading ? (
        <div className="text-center py-20 text-gray-400">Loading...</div>
      ) : articles.length === 0 ? (
        <div className="text-center py-20 text-gray-400">No published articles yet.</div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {articles.map((a) => (
            <ArticleCard key={a.id} article={a} isModerator={isModerator} onModerate={fetchArticles} />
          ))}
        </div>
      )}
    </div>
  );
}
