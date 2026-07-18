import { useCallback, useEffect, useState } from "react";
import { articlesApi, ArticleListItem } from "../api";
import { useAuth } from "../context/AuthContext";
import ArticleCard from "../components/ArticleCard";
import AuthorFilter from "../components/AuthorFilter";
import Pagination from "../components/Pagination";
import SearchInput from "../components/SearchInput";
import { useListQuery } from "../hooks/useListQuery";

const PAGE_SIZE = 20;

export default function Articles() {
  const { user } = useAuth();
  const [articles, setArticles] = useState<ArticleListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const isModerator = user?.role === "moderator";

  const { searchParams, page, q, searchInput, setSearchInput, setPage, setParam } = useListQuery();
  const author = searchParams.get("author");

  const fetchArticles = useCallback(() => {
    setLoading(true);
    articlesApi
      .listPaged({ page, size: PAGE_SIZE, q, author: author ?? undefined })
      .then(({ items, total }) => {
        setArticles(items);
        setTotal(total);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [page, q, author]);

  useEffect(() => {
    fetchArticles();
  }, [fetchArticles]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  useEffect(() => {
    if (!loading && page > totalPages) setPage(totalPages);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, page, totalPages]);

  const hasFilters = Boolean(q || author);

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Articles</h1>
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <SearchInput value={searchInput} onChange={setSearchInput} />
        <AuthorFilter value={author} onChange={(a) => setParam("author", a)} />
      </div>
      {loading ? (
        <div className="text-center py-20 text-gray-400">Loading...</div>
      ) : articles.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          {hasFilters ? "Nothing found. Try different search or filters." : "No published articles yet."}
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            {articles.map((a) => (
              <ArticleCard key={a.id} article={a} isModerator={isModerator} onModerate={fetchArticles} />
            ))}
          </div>
          <Pagination page={page} totalPages={totalPages} onChange={setPage} />
        </>
      )}
    </div>
  );
}
