import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { articlesApi, ArticleListItem } from "../api";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import {
  Search,
  FileText,
  Download,
  ArrowRight,
  Eye,
  MessageCircle,
  PenTool,
  Plus,
} from "lucide-react";

export default function Home() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();

  const [communityArticles, setCommunityArticles] = useState<ArticleListItem[]>([]);
  const [myRecentArticles, setMyRecentArticles] = useState<ArticleListItem[]>([]);
  const [loadingCommunity, setLoadingCommunity] = useState(true);
  const [loadingMy, setLoadingMy] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    articlesApi
      .list(1, 8)
      .then((items) => setCommunityArticles(items))
      .catch(() => {})
      .finally(() => setLoadingCommunity(false));
  }, []);

  useEffect(() => {
    if (!user) return;
    setLoadingMy(true);
    articlesApi
      .myList(1, 4)
      .then((items) => setMyRecentArticles(items))
      .catch(() => {})
      .finally(() => setLoadingMy(false));
  }, [user]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/articles?q=${encodeURIComponent(searchQuery.trim())}`);
    } else {
      navigate("/articles");
    }
  };

  const formatDate = (isoString?: string) => {
    if (!isoString) return "";
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
    } catch {
      return isoString;
    }
  };

  const getAccessStateLabel = (state: string) => {
    switch (state) {
      case "draft":
        return t('home.stateDraft');
      case "private":
        return t('home.statePrivate');
      case "unlisted":
        return t('home.stateUnlisted');
      case "public":
      case "published":
        return t('home.statePublic');
      case "blocked":
        return t('home.stateBlocked');
      default:
        return state;
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-10">
      {/* Top Welcome Banner Card */}
      <section className="bg-gray-50/80 dark:bg-gray-900/40 border border-gray-200 dark:border-gray-800 rounded-2xl p-7 md:p-8">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          {/* Left: Greeting and Search */}
          <div className="space-y-5 flex-1 min-w-0">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
                {user ? `${t('home.welcomeBack')}, ${user.nickname}` : t('home.welcomeGuest')}
              </h1>
              <p className="text-sm sm:text-base text-gray-500 dark:text-gray-400 mt-1">
                {t('home.subtitle')}
              </p>
            </div>

            {/* Quick Search */}
            <form onSubmit={handleSearchSubmit} className="max-w-2xl">
              <div className="relative flex items-center">
                <Search size={17} className="absolute left-3.5 text-gray-400 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t('home.searchArticles')}
                  className="w-full pl-10 pr-20 py-2.5 text-sm rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-gray-400 shadow-xs"
                />
                <button
                  type="submit"
                  className="absolute right-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                >
                  {t('common.edit') === 'Редактировать' ? 'Найти' : 'Search'}
                </button>
              </div>
            </form>
          </div>

          {/* Right: Quick Action Buttons */}
          <div className="flex flex-col gap-2 w-full sm:w-[244px] shrink-0">
            {/* Primary Big Blue Button */}
            <Link
              to="/editor"
              className="w-full h-12 flex items-center justify-center rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-[15px] transition-colors shadow-sm"
            >
              {t('home.newArticle')}
            </Link>

            {/* Secondary Actions Row */}
            <div className="flex items-center gap-2 w-full">
              <Link
                to={user ? "/my-articles" : "/login"}
                className="flex-1 h-[38px] px-2 flex items-center justify-center gap-1.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-[13px] font-medium text-gray-800 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors shadow-xs"
                title={user ? t('home.myArticles') : t('auth.login')}
              >
                <FileText size={14} className="text-gray-400 shrink-0" />
                <span className="truncate">{user ? t('home.myArticles') : t('auth.login')}</span>
              </Link>

              <Link
                to="/download"
                className="flex-1 h-[38px] px-2 flex items-center justify-center gap-1.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-[13px] font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors shadow-xs"
                title={t('nav.download')}
              >
                <Download size={14} className="text-gray-400 shrink-0" />
                <span className="truncate">{t('nav.download')}</span>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Main Two-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Community Feed (2/3 width) */}
        <section className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
              {t('home.recentCommunity')}
            </h2>
            <Link
              to="/articles"
              className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
            >
              {t('home.allCommunity')} <ArrowRight size={13} />
            </Link>
          </div>

          {loadingCommunity ? (
            <div className="py-12 text-center text-xs text-gray-400">{t('common.loading')}</div>
          ) : communityArticles.length === 0 ? (
            <div className="p-8 text-center rounded-xl border border-dashed border-gray-200 dark:border-gray-800 text-xs text-gray-400">
              {t('articles.noPublishedArticles')}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {communityArticles.map((art) => (
                <Link
                  key={art.id}
                  to={`/${art.author_nickname}/${art.slug}`}
                  className="group p-5 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 hover:border-gray-300 dark:hover:border-gray-700 transition-all flex flex-col justify-between min-h-[140px] shadow-xs"
                >
                  <div>
                    <h3 className="font-semibold text-base text-gray-900 dark:text-gray-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors line-clamp-2 mb-1.5">
                      {art.title}
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {t('articles.byAuthor', { author: art.author_nickname })} · {formatDate(art.updated_at || art.created_at)}
                    </p>
                  </div>

                  <div className="flex items-center gap-4 text-xs text-gray-400 pt-3 border-t border-gray-100 dark:border-gray-800/60 mt-3">
                    <span className="flex items-center gap-1">
                      <Eye size={13} />
                      {art.view_count ?? 0}
                    </span>
                    <span className="flex items-center gap-1">
                      <MessageCircle size={13} />
                      {art.comment_count ?? 0}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* Right Column: Your Articles (1/3 width) */}
        <section className="lg:col-span-1 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
              {t('home.yourArticles')}
            </h2>
            <Link
              to="/my-articles"
              className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
            >
              {t('home.allCommunity')} <ArrowRight size={13} />
            </Link>
          </div>

          {!user ? (
            <div className="p-5 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-center space-y-3">
              <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                {t('home.guestPrompt')}
              </p>
              <div className="flex items-center justify-center gap-2 pt-1">
                <Link
                  to="/login"
                  className="px-3.5 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition-colors"
                >
                  {t('auth.login')}
                </Link>
                <Link
                  to="/register"
                  className="px-3.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-800 text-xs font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  {t('auth.register')}
                </Link>
              </div>
            </div>
          ) : loadingMy ? (
            <div className="py-12 text-center text-xs text-gray-400">{t('common.loading')}</div>
          ) : myRecentArticles.length === 0 ? (
            <div className="p-6 text-center rounded-xl border border-dashed border-gray-300 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/20">
              <p className="text-xs text-gray-500 mb-3">{t('home.emptyArticles')}</p>
              <Link
                to="/editor"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition-colors"
              >
                <Plus size={13} /> {t('home.newArticle')}
              </Link>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {myRecentArticles.map((art) => (
                <div
                  key={art.id}
                  className="group p-5 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 hover:border-gray-300 dark:hover:border-gray-700 transition-all flex flex-col justify-between min-h-[140px] shadow-xs"
                >
                  <div>
                    <Link
                      to={`/editor/${art.id}`}
                      className="font-semibold text-base text-gray-900 dark:text-gray-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors line-clamp-2 mb-1.5 block"
                    >
                      {art.title || t('common.untitled')}
                    </Link>
                    <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                      <span className="font-medium text-gray-600 dark:text-gray-300">
                        {getAccessStateLabel(art.access_state)}
                      </span>
                      <span>·</span>
                      <span>{formatDate(art.updated_at || art.created_at)}</span>
                    </p>
                  </div>

                  <div className="flex items-center justify-between text-xs text-gray-400 pt-3 border-t border-gray-100 dark:border-gray-800/60 mt-3">
                    <div className="flex items-center gap-4">
                      <span className="flex items-center gap-1">
                        <Eye size={13} />
                        {art.view_count ?? 0}
                      </span>
                      <span className="flex items-center gap-1">
                        <MessageCircle size={13} />
                        {art.comment_count ?? 0}
                      </span>
                    </div>

                    <Link
                      to={`/editor/${art.id}`}
                      className="p-1 -m-1 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                      title={t('common.edit')}
                    >
                      <PenTool size={14} />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
