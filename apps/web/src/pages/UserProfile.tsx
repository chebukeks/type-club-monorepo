import { useCallback, useEffect, useState } from "react";
import { useParams, Link, useNavigate, useSearchParams } from "react-router-dom";
import { usersApi, UserProfile as UserProfileType, ArticleListItem, notificationsApi, NotificationItem, formatNotificationItem } from "../api";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import ArticleCard from "../components/ArticleCard";
import Pagination from "../components/Pagination";
import { Settings, User, Bell, MessageSquare, Users, Check, Trash2, CheckCheck } from "lucide-react";

const PAGE_SIZE = 20;
const NOTIF_PAGE_SIZE = 20;

export default function UserProfile() {
  const { username } = useParams<{ username: string }>();
  const { user } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [profile, setProfile] = useState<UserProfileType | null>(null);
  const [articles, setArticles] = useState<ArticleListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const isOwner = user?.nickname === username;
  const currentTab = isOwner && searchParams.get("tab") === "notifications" ? "notifications" : "articles";

  // Notifications state
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [notifTotal, setNotifTotal] = useState(0);
  const [notifUnreadCount, setNotifUnreadCount] = useState(0);
  const [notifLoading, setNotifLoading] = useState(false);
  const [notifPage, setNotifPage] = useState(1);
  const [filterUnread, setFilterUnread] = useState(false);

  const fetchProfile = useCallback(async () => {
    if (!username) return;
    try {
      const p = await usersApi.getProfile(username);
      setProfile(p);
    } catch (err: any) {
      setError(err.message || t('profile.userNotFound'));
    }
  }, [username, t]);

  const fetchArticles = useCallback(async () => {
    if (!username) return;
    setLoading(true);
    try {
      const { items, total: tTotal } = await usersApi.getProfileArticles(username, page, PAGE_SIZE);
      setArticles(items);
      setTotal(tTotal);
    } catch {
    } finally {
      setLoading(false);
    }
  }, [username, page]);

  const fetchNotifications = useCallback(async () => {
    if (!isOwner) return;
    setNotifLoading(true);
    try {
      const res = await notificationsApi.list({
        page: notifPage,
        size: NOTIF_PAGE_SIZE,
        unread_only: filterUnread,
      });
      setNotifications(res.items);
      setNotifTotal(res.total);
      setNotifUnreadCount(res.unread_count);
    } catch {
    } finally {
      setNotifLoading(false);
    }
  }, [isOwner, notifPage, filterUnread]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  useEffect(() => {
    fetchArticles();
  }, [fetchArticles]);

  useEffect(() => {
    if (isOwner) {
      notificationsApi.list({ page: 1, size: 1 }).then((res) => {
        setNotifUnreadCount(res.unread_count);
      }).catch(() => {});
    }
  }, [isOwner]);

  useEffect(() => {
    if (isOwner && currentTab === "notifications") {
      fetchNotifications();
    }
  }, [isOwner, currentTab, fetchNotifications]);

  const handleMarkRead = async (id: number, e?: React.MouseEvent) => {
    e?.stopPropagation();
    try {
      await notificationsApi.markRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true, read: true } : n))
      );
      setNotifUnreadCount((prev) => Math.max(0, prev - 1));
    } catch {}
  };

  const handleMarkAllRead = async () => {
    try {
      await notificationsApi.markAllRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true, read: true })));
      setNotifUnreadCount(0);
    } catch {}
  };

  const handleDeleteNotif = async (id: number, e?: React.MouseEvent) => {
    e?.stopPropagation();
    try {
      await notificationsApi.delete(id);
      const deleted = notifications.find((n) => n.id === id);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      setNotifTotal((prev) => Math.max(0, prev - 1));
      if (deleted && !(deleted.is_read ?? deleted.read)) {
        setNotifUnreadCount((prev) => Math.max(0, prev - 1));
      }
    } catch {}
  };

  const handleNotifClick = (n: NotificationItem) => {
    const isRead = n.is_read ?? n.read ?? false;
    if (!isRead) {
      handleMarkRead(n.id);
    }
    const formatted = formatNotificationItem(n, t);
    if (formatted.link || n.link) {
      navigate(formatted.link || n.link!);
    }
  };

  if (error) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 text-center">
        <h1 className="text-2xl font-bold mb-2">{t('profile.userNotFound')}</h1>
        <p className="text-gray-500 mb-4">{error}</p>
        <Link to="/" className="text-blue-600 hover:underline">{t('auth.goHome')}</Link>
      </div>
    );
  }

  if (!profile) {
    return <div className="max-w-4xl mx-auto px-4 py-20 text-center text-gray-400">{t('common.loading')}</div>;
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex flex-col sm:flex-row items-start gap-6 mb-10">
        <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden flex-shrink-0">
          {profile.avatar_url ? (
            <img src={profile.avatar_url} alt={profile.nickname} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-400 text-3xl font-bold">
              {profile.nickname[0].toUpperCase()}
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-bold break-words">{profile.nickname}</h1>
              {profile.bio && (
                <p className="mt-2 text-gray-600 dark:text-gray-400 whitespace-pre-wrap">{profile.bio}</p>
              )}
            </div>
            {isOwner && (
              <button
                onClick={() => navigate("/settings")}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-700 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors flex-shrink-0"
              >
                <Settings size={14} />
                {t('titlebar.settings')}
              </button>
            )}
          </div>
          <div className="flex items-center gap-5 mt-4 text-sm text-gray-500">
            <span className="flex items-center gap-1">
              <User size={14} />
              {t('articles.articlesCount', { count: profile.article_count })}
            </span>
            <span>{t('articles.viewsCount', { count: profile.total_views })}</span>
            <span>{t('articles.likesCount', { count: profile.total_likes })}</span>
          </div>
        </div>
      </div>

      {isOwner ? (
        <div className="flex items-center gap-6 border-b border-gray-200 dark:border-gray-800 mb-6">
          <button
            onClick={() => setSearchParams({})}
            className={`pb-3 text-base font-semibold border-b-2 transition-colors ${
              currentTab === "articles"
                ? "border-blue-600 text-blue-600 dark:text-blue-400"
                : "border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
            }`}
          >
            {t('profile.allArticles')} ({total})
          </button>
          <button
            onClick={() => setSearchParams({ tab: "notifications" })}
            className={`pb-3 text-base font-semibold border-b-2 transition-colors flex items-center gap-2 ${
              currentTab === "notifications"
                ? "border-blue-600 text-blue-600 dark:text-blue-400"
                : "border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
            }`}
          >
            <span>{t('notifications.title')}</span>
            {notifUnreadCount > 0 && (
              <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-blue-600 text-white">
                {notifUnreadCount}
              </span>
            )}
          </button>
        </div>
      ) : (
        <h2 className="text-lg font-semibold mb-4">
          {t('articles.title')}
        </h2>
      )}

      {currentTab === "notifications" ? (
        <section>
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <button
                onClick={() => { setFilterUnread(false); setNotifPage(1); }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  !filterUnread
                    ? "bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400"
                    : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
                }`}
              >
                {t('notifications.all')}
              </button>
              <button
                onClick={() => { setFilterUnread(true); setNotifPage(1); }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  filterUnread
                    ? "bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400"
                    : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
                }`}
              >
                {t('notifications.unread')} {notifUnreadCount > 0 && `(${notifUnreadCount})`}
              </button>
            </div>

            {notifications.some((n) => !(n.is_read ?? n.read)) && (
              <button
                onClick={handleMarkAllRead}
                className="flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 hover:underline"
              >
                <CheckCheck size={14} />
                {t('notifications.markAllRead')}
              </button>
            )}
          </div>

          {notifLoading ? (
            <div className="text-center py-20 text-gray-400">{t('common.loading')}</div>
          ) : notifications.length === 0 ? (
            <div className="text-center py-20 text-gray-400">{t('notifications.empty')}</div>
          ) : (
            <div className="space-y-2">
              {notifications.map((n) => {
                const isRead = n.is_read ?? n.read ?? false;
                const { title, message } = formatNotificationItem(n, t);
                return (
                <div
                  key={n.id}
                  onClick={() => handleNotifClick(n)}
                  className={`p-4 rounded-xl border transition-colors flex items-start gap-3 cursor-pointer ${
                    !isRead
                      ? "bg-blue-50/40 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900/50"
                      : "bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700"
                  }`}
                >
                  <div className="mt-0.5 shrink-0">
                    {n.type === "comment" ? (
                      <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400">
                        <MessageSquare size={16} />
                      </div>
                    ) : n.type === "collab_invite" ? (
                      <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400">
                        <Users size={16} />
                      </div>
                    ) : (
                      <div className="p-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
                        <Bell size={16} />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <h4 className={`text-sm ${!isRead ? "font-semibold text-gray-900 dark:text-gray-100" : "font-medium text-gray-700 dark:text-gray-300"}`}>
                          {title}
                        </h4>
                        {!isRead && (
                          <span className="w-2 h-2 rounded-full bg-blue-600 shrink-0" />
                        )}
                      </div>
                      <span className="text-xs text-gray-400 whitespace-nowrap">
                        {new Date(n.created_at).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 whitespace-pre-wrap break-words">
                      {message}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0 ml-2" onClick={(e) => e.stopPropagation()}>
                    {!isRead && (
                      <button
                        onClick={(e) => handleMarkRead(n.id, e)}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                      >
                        <Check size={16} />
                      </button>
                    )}
                    <button
                      onClick={(e) => handleDeleteNotif(n.id, e)}
                      title={t('common.delete')}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ); })}
              <Pagination
                page={notifPage}
                totalPages={Math.max(1, Math.ceil(notifTotal / NOTIF_PAGE_SIZE))}
                onChange={setNotifPage}
              />
            </div>
          )}
        </section>
      ) : (
        <section>
          {loading ? (
            <div className="text-center py-20 text-gray-400">{t('common.loading')}</div>
          ) : articles.length === 0 ? (
            <div className="text-center py-20 text-gray-400">
              {isOwner ? t('profile.noArticlesOwner') : t('profile.noArticlesOther')}
            </div>
          ) : (
            <>
              <div className="grid gap-4 md:grid-cols-2">
                {articles.map((a) => (
                  <ArticleCard key={a.id} article={a} isModerator={user?.role === "moderator"} />
                ))}
              </div>
              <Pagination page={page} totalPages={totalPages} onChange={setPage} />
            </>
          )}
        </section>
      )}
    </div>
  );
}
