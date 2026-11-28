import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { articlesApi, ArticleListItem } from "../api";
import { useLanguage } from "../context/LanguageContext";
import Pagination from "../components/Pagination";
import SearchInput from "../components/SearchInput";
import { useListQuery } from "../hooks/useListQuery";
import { Trash2, Edit, Lightbulb, SlidersHorizontal } from "lucide-react";

const PAGE_SIZE = 20;
const ALL_ROLES = ["author", "co_author", "editor"] as const;
const ALL_ACCESS = ["private", "link", "public", "blocked"] as const;
type Role = (typeof ALL_ROLES)[number];
type Access = (typeof ALL_ACCESS)[number];

function parseFilter<T extends string>(options: readonly T[], param: string | null): T[] {
  if (param === null) return [...options];
  const selected = new Set(param.split(","));
  return options.filter((option) => selected.has(option));
}

function nextFilter<T extends string>(options: readonly T[], selected: T[], toggled: T): string | null {
  const next = selected.includes(toggled)
    ? selected.filter((option) => option !== toggled)
    : [...selected, toggled];
  return next.length === options.length ? null : next.join(",") || "none";
}

export default function MyArticles() {
  const { t } = useLanguage();
  const [articles, setArticles] = useState<ArticleListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filtersRef = useRef<HTMLDivElement>(null);
  const filtersButtonRef = useRef<HTMLButtonElement>(null);
  const requestRef = useRef(0);

  const roleLabels: Record<Role, string> = {
    author: t('role.author'),
    co_author: t('role.co_author'),
    editor: t('role.editor'),
  };
  const accessLabels: Record<Access, string> = {
    private: t('publish.private'),
    link: t('publish.link'),
    public: t('publish.public'),
    blocked: t('publish.blocked'),
  };

  const { searchParams, page, q, searchInput, setSearchInput, setPage, setParam } = useListQuery();
  const selectedRoles = parseFilter(ALL_ROLES, searchParams.get("roles"));
  const selectedAccess = parseFilter(ALL_ACCESS, searchParams.get("access"));

  const rolesKey = selectedRoles.join(",");
  const accessKey = selectedAccess.join(",");
  const filterCount = Number(selectedRoles.length < ALL_ROLES.length) + Number(selectedAccess.length < ALL_ACCESS.length);

  const fetchArticles = useCallback(() => {
    const request = ++requestRef.current;
    setLoading(true);
    articlesApi
      .myListPaged({
        page, size: PAGE_SIZE, q,
        roles: rolesKey ? rolesKey.split(",") : [],
        access: accessKey ? accessKey.split(",") : [],
      })
      .then(({ items, total }) => {
        if (request !== requestRef.current) return;
        setArticles(items);
        setTotal(total);
      })
      .catch(() => {})
      .finally(() => {
        if (request === requestRef.current) setLoading(false);
      });
  }, [page, q, rolesKey, accessKey]);

  useEffect(() => {
    fetchArticles();
  }, [fetchArticles]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  useEffect(() => {
    if (!loading && page > totalPages) setPage(totalPages);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, page, totalPages]);

  useEffect(() => {
    if (!filtersOpen) return;
    const dismiss = (event: PointerEvent) => {
      if (!filtersRef.current?.contains(event.target as Node)) setFiltersOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setFiltersOpen(false);
      filtersButtonRef.current?.focus();
    };
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", dismiss);
      document.removeEventListener("keydown", escape);
    };
  }, [filtersOpen]);

  const handleDelete = async (id: number) => {
    if (!confirm(t('articles.deleteConfirm'))) return;
    await articlesApi.delete(id);
    fetchArticles();
  };

  const hasFilters = Boolean(q) || filterCount > 0;

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">{t('myArticles.title')}</h1>
        <Link to="/editor" className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700">
          {t('myArticles.newArticle')}
        </Link>
      </div>
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-6">
        <SearchInput value={searchInput} onChange={setSearchInput} placeholder={t('articles.searchPlaceholder')} />
        <div ref={filtersRef} className="relative shrink-0 self-end sm:self-auto">
          <button
            ref={filtersButtonRef}
            type="button"
            aria-expanded={filtersOpen}
            aria-controls="my-articles-filters"
            onClick={() => setFiltersOpen((open) => !open)}
            className="inline-flex items-center gap-2 rounded-xl border border-gray-200 dark:border-gray-700 px-3 py-2 text-sm font-medium hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <SlidersHorizontal size={15} />
            {t('myArticles.filters')}
            {filterCount > 0 && <span className="text-blue-600 dark:text-blue-400">{filterCount}</span>}
          </button>
          {filtersOpen && (
            <div id="my-articles-filters" className="absolute right-0 top-full z-20 mt-2 w-64 space-y-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-3 shadow-lg">
              <fieldset>
                <legend className="mb-1 text-sm font-semibold">{t('myArticles.filterRoles')}</legend>
                {ALL_ROLES.map((role) => (
                  <label key={role} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800">
                    <input type="checkbox" className="accent-blue-600" checked={selectedRoles.includes(role)}
                      onChange={() => setParam("roles", nextFilter(ALL_ROLES, selectedRoles, role))} />
                    {roleLabels[role]}
                  </label>
                ))}
              </fieldset>
              <fieldset>
                <legend className="mb-1 text-sm font-semibold">{t('myArticles.filterAccess')}</legend>
                {ALL_ACCESS.map((access) => (
                  <label key={access} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800">
                    <input type="checkbox" className="accent-blue-600" checked={selectedAccess.includes(access)}
                      onChange={() => setParam("access", nextFilter(ALL_ACCESS, selectedAccess, access))} />
                    {accessLabels[access]}
                  </label>
                ))}
              </fieldset>
            </div>
          )}
        </div>
      </div>
      {loading ? (
        <div className="text-center py-20 text-gray-400">{t('common.loading')}</div>
      ) : articles.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          {hasFilters ? (
            t('articles.nothingFound')
          ) : (
            <>
              {t('myArticles.noArticlesYet')}{" "}
              <Link to="/editor" className="text-blue-600 hover:underline">{t('myArticles.writeOneNow')}</Link>
            </>
          )}
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {articles.map((a) => {
              const isAuthor = !a.my_roles || a.my_roles.includes("author");
              const canEdit = !a.my_roles || a.my_roles.includes("author") || a.my_roles.includes("co_author");
              const canSuggest = !a.my_roles || a.my_roles.includes("author") || a.my_roles.includes("co_author") || a.my_roles.includes("editor");

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
                      {accessLabels[a.access_state as Access] ?? a.access_state}
                      </span>
                      {(a.my_roles ?? []).map((role) => (
                        <span key={role} className="text-xs px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950 text-blue-600">
                          {roleLabels[role as Role] ?? role}
                        </span>
                      ))}
                      {!isAuthor && <span className="text-xs">{t('articles.byAuthor', { author: a.author_nickname })}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {canSuggest && (
                      <Link to={`/editor/${a.id}?mode=suggest`}
                        className="p-2 rounded-lg hover:bg-amber-50 dark:hover:bg-amber-950 text-amber-600 dark:text-amber-400 transition-colors"
                        title={t('myArticles.suggest')}>
                        <Lightbulb size={16} />
                      </Link>
                    )}
                    {canEdit && (
                      <Link to={`/editor/${a.id}`}
                        className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                        title={t('myArticles.edit')}>
                        <Edit size={16} />
                      </Link>
                    )}
                    {isAuthor && (
                      <button onClick={() => handleDelete(a.id)}
                        className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-950 text-red-500 transition-colors"
                        title={t('common.delete')}>
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
