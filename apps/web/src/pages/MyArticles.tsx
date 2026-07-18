import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { articlesApi, ArticleListItem } from "../api";
import Pagination from "../components/Pagination";
import SearchInput from "../components/SearchInput";
import { useListQuery } from "../hooks/useListQuery";
import { Trash2, Edit } from "lucide-react";

const PAGE_SIZE = 20;
const ALL_ROLES = ["author", "co_author", "editor"] as const;
type Role = (typeof ALL_ROLES)[number];

const ROLE_LABELS: Record<Role, string> = {
  author: "Author",
  co_author: "Co-author",
  editor: "Editor",
};

function parseRoles(param: string | null): Role[] {
  if (param === null) return [...ALL_ROLES];
  return ALL_ROLES.filter((r) => param.split(",").includes(r));
}

export default function MyArticles() {
  const [articles, setArticles] = useState<ArticleListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const { searchParams, page, q, searchInput, setSearchInput, setPage, setParam } = useListQuery();
  const selectedRoles = parseRoles(searchParams.get("roles"));

  const rolesKey = selectedRoles.join(",");

  const fetchArticles = useCallback(() => {
    setLoading(true);
    articlesApi
      .myListPaged({ page, size: PAGE_SIZE, q, roles: rolesKey ? rolesKey.split(",") : [] })
      .then(({ items, total }) => {
        setArticles(items);
        setTotal(total);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [page, q, rolesKey]);

  useEffect(() => {
    fetchArticles();
  }, [fetchArticles]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  useEffect(() => {
    if (!loading && page > totalPages) setPage(totalPages);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, page, totalPages]);

  const toggleRole = (role: Role) => {
    const next = selectedRoles.includes(role)
      ? selectedRoles.filter((r) => r !== role)
      : [...selectedRoles, role];
    if (next.length === ALL_ROLES.length) setParam("roles", null);
    else if (next.length === 0) setParam("roles", "none");
    else setParam("roles", next.join(","));
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this article?")) return;
    await articlesApi.delete(id);
    fetchArticles();
  };

  const hasFilters = Boolean(q) || selectedRoles.length < ALL_ROLES.length;

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">My Articles</h1>
        <Link to="/editor" className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700">
          New Article
        </Link>
      </div>
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-6">
        <SearchInput value={searchInput} onChange={setSearchInput} />
        <div className="flex items-center gap-4 shrink-0">
          {ALL_ROLES.map((role) => (
            <label key={role} className="flex items-center gap-1.5 text-sm cursor-pointer select-none">
              <input
                type="checkbox"
                checked={selectedRoles.includes(role)}
                onChange={() => toggleRole(role)}
                className="w-4 h-4 accent-blue-600 cursor-pointer"
              />
              {ROLE_LABELS[role]}
            </label>
          ))}
        </div>
      </div>
      {loading ? (
        <div className="text-center py-20 text-gray-400">Loading...</div>
      ) : articles.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          {hasFilters ? (
            "Nothing found. Try different search or filters."
          ) : (
            <>
              You haven't written any articles yet.{" "}
              <Link to="/editor" className="text-blue-600 hover:underline">Write one now</Link>
            </>
          )}
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {articles.map((a) => {
              const isAuthor = !a.my_roles || a.my_roles.includes("author");
              return (
                <div key={a.id} className="flex items-center gap-4 p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
                  <div className="flex-1 min-w-0">
                    <Link to={`/${a.author_nickname}/${a.slug}`} className="font-semibold hover:text-blue-600 line-clamp-1">
                      {a.title}
                    </Link>
                    <div className="text-sm text-gray-500 mt-0.5 flex items-center flex-wrap gap-x-2 gap-y-1">
                      <span>{new Date(a.updated_at).toLocaleDateString()}</span>
                      <span>·</span>
                      <span className="capitalize text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800">
                        {a.access_state}
                      </span>
                      {(a.my_roles ?? []).map((role) => (
                        <span key={role} className="text-xs px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950 text-blue-600">
                          {ROLE_LABELS[role as Role] ?? role}
                        </span>
                      ))}
                      {!isAuthor && <span className="text-xs">by {a.author_nickname}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Link to={`/editor/${a.id}`}
                      className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                      title="Edit">
                      <Edit size={16} />
                    </Link>
                    {isAuthor && (
                      <button onClick={() => handleDelete(a.id)}
                        className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-950 text-red-500 transition-colors"
                        title="Delete">
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <Pagination page={page} totalPages={totalPages} onChange={setPage} />
        </>
      )}
    </div>
  );
}
