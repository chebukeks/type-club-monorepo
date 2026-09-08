import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import { PenTool, BookOpen, User, LogOut, LogIn, Menu, X, Bell, MessageSquare, Users } from "lucide-react";
import { useState, useEffect, useRef, useCallback } from "react";
import ThemeSwitcher from "./ThemeSwitcher";
import { notificationsApi, NotificationItem, formatNotificationItem } from "../api";

interface SiteHeaderProps {
  onLogoClick?: () => void;
}

export default function SiteHeader({ onLogoClick }: SiteHeaderProps) {
  const { user, logout } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const notifRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    try {
      const res = await notificationsApi.list({ page: 1, size: 8 });
      setNotifications(res.items);
      setUnreadCount(res.unread_count);
    } catch {
      // silent
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 45000);
    const onFocus = () => fetchNotifications();
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, [user, fetchNotifications]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    };
    if (notifOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [notifOpen]);

  const handleMarkAllRead = async () => {
    try {
      await notificationsApi.markAllRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true, read: true })));
      setUnreadCount(0);
    } catch {
      // silent
    }
  };

  const handleItemClick = async (item: NotificationItem) => {
    const isRead = item.is_read ?? item.read ?? false;
    if (!isRead) {
      try {
        await notificationsApi.markRead(item.id);
        setNotifications((prev) =>
          prev.map((n) => (n.id === item.id ? { ...n, is_read: true, read: true } : n))
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
      } catch {
        // silent
      }
    }
    setNotifOpen(false);
    const formatted = formatNotificationItem(item, t);
    if (formatted.link || item.link) {
      navigate(formatted.link || item.link!);
    }
  };

  const navLinks = [
    { to: "/articles", label: t('nav.articles'), icon: BookOpen },
  ];

  if (user) {
    navLinks.push({ to: "/my-articles", label: t('nav.myArticles'), icon: PenTool });
  }

  const LogoContent = (
    <span className="flex items-center gap-2 text-xl font-bold tracking-tight">
      <img src="/icons/icon_48x48.png" alt="Type Club" className="h-8 w-8" />
      Type Club
    </span>
  );

  return (
    <header className="border-b border-gray-200 dark:border-gray-800 bg-white/80 dark:bg-gray-950/80 backdrop-blur sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
        {onLogoClick ? (
          <button onClick={onLogoClick} className="hover:opacity-80">
            {LogoContent}
          </button>
        ) : (
          <Link to="/" className="hover:opacity-80">
            {LogoContent}
          </Link>
        )}

        <div className="flex items-center gap-1">
          <button className="md:hidden p-1" onClick={() => setMenuOpen(!menuOpen)}>
            {menuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>

          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map((l) => (
              <Link
                key={l.to}
                to={l.to}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${location.pathname === l.to ? "bg-gray-100 dark:bg-gray-800" : "hover:bg-gray-100 dark:hover:bg-gray-800"}`}
              >
                {l.label}
              </Link>
            ))}

            {user ? (
              <>
                <Link
                  to="/editor"
                  className="px-4 py-2 ml-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
                >
                  {t('nav.newArticle')}
                </Link>

                {/* Notifications Dropdown */}
                <div className="relative" ref={notifRef}>
                  <button
                    type="button"
                    onClick={() => setNotifOpen(!notifOpen)}
                    className="relative p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-gray-700 dark:text-gray-300"
                    title={t('notifications.title')}
                  >
                    <Bell size={18} />
                    {unreadCount > 0 && (
                      <span className="absolute top-1 right-1 flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white leading-none">
                        {unreadCount > 99 ? "99+" : unreadCount}
                      </span>
                    )}
                  </button>

                  {notifOpen && (
                    <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-xl z-50 overflow-hidden text-sm animate-in fade-in zoom-in-95 duration-100">
                      <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-200 dark:border-gray-800 bg-gray-50/70 dark:bg-gray-950/70">
                        <span className="font-semibold text-gray-900 dark:text-gray-100 text-xs">
                          {t('notifications.title')}
                        </span>
                        {unreadCount > 0 && (
                          <button
                            type="button"
                            onClick={handleMarkAllRead}
                            className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                          >
                            {t('notifications.markAllRead')}
                          </button>
                        )}
                      </div>
                      <div className="max-h-80 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-800/60">
                        {notifications.length === 0 ? (
                          <div className="py-8 text-center text-xs text-gray-400">
                            {t('notifications.empty')}
                          </div>
                        ) : (
                          notifications.map((n) => {
                            const isRead = n.is_read ?? n.read ?? false;
                            const { title, message } = formatNotificationItem(n, t);
                            return (
                              <div
                                key={n.id}
                                onClick={() => handleItemClick(n)}
                                className={`p-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors flex gap-2.5 ${
                                  !isRead ? "bg-blue-50/40 dark:bg-blue-950/20" : ""
                                }`}
                              >
                                <div className="mt-0.5 shrink-0">
                                  {n.type === "comment" ? (
                                    <MessageSquare size={16} className="text-blue-500" />
                                  ) : n.type === "collab_invite" ? (
                                    <Users size={16} className="text-emerald-500" />
                                  ) : (
                                    <Bell size={16} className="text-purple-500" />
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center justify-between gap-1">
                                    <span
                                      className={`text-xs truncate ${
                                        !isRead
                                          ? "font-semibold text-gray-900 dark:text-gray-100"
                                          : "text-gray-700 dark:text-gray-300"
                                      }`}
                                    >
                                      {title}
                                    </span>
                                    {!isRead && (
                                      <span className="w-1.5 h-1.5 rounded-full bg-blue-600 shrink-0" />
                                    )}
                                  </div>
                                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">
                                    {message}
                                  </p>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                      <div className="p-2 border-t border-gray-200 dark:border-gray-800 text-center bg-gray-50/70 dark:bg-gray-950/70">
                        <Link
                          to={`/${user.nickname}?tab=notifications`}
                          onClick={() => setNotifOpen(false)}
                          className="text-xs text-blue-600 dark:text-blue-400 hover:underline block py-0.5"
                        >
                          {t('notifications.all')}
                        </Link>
                      </div>
                    </div>
                  )}
                </div>

                <Link
                  to={`/${user.nickname}`}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${location.pathname === `/${user.nickname}` ? "bg-gray-100 dark:bg-gray-800" : "hover:bg-gray-100 dark:hover:bg-gray-800"}`}
                  title={t('nav.profile')}
                >
                  <User size={18} />
                </Link>
                <button
                  onClick={() => { logout(); navigate("/"); }}
                  className="px-3 py-2 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-950 transition-colors"
                  title={t('auth.logout')}
                >
                  <LogOut size={18} />
                </button>
              </>
            ) : (
              <Link
                to="/login"
                className="px-4 py-2 ml-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors flex items-center gap-1"
              >
                <LogIn size={16} /> {t('auth.login')}
              </Link>
            )}
          </nav>

          <ThemeSwitcher />
        </div>
      </div>

      {menuOpen && (
        <div className="md:hidden border-t border-gray-200 dark:border-gray-800 p-4 bg-white dark:bg-gray-950">
          {navLinks.map((l) => (
            <Link key={l.to} to={l.to} onClick={() => setMenuOpen(false)}
              className="block px-3 py-2 rounded-lg text-sm font-medium hover:bg-gray-100 dark:hover:bg-gray-800">
              {l.label}
            </Link>
          ))}
          {user ? (
            <>
              <Link to="/editor" onClick={() => setMenuOpen(false)}
                className="block px-3 py-2 mt-1 rounded-lg bg-blue-600 text-white text-sm font-medium">
                {t('nav.newArticle')}
              </Link>
              <Link to={`/${user.nickname}`} onClick={() => setMenuOpen(false)}
                className="block px-3 py-2 rounded-lg text-sm font-medium hover:bg-gray-100 dark:hover:bg-gray-800">
                {t('nav.profile')}
              </Link>
              <button onClick={() => { logout(); navigate("/"); setMenuOpen(false); }}
                className="block w-full text-left px-3 py-2 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-950">
                {t('auth.logout')}
              </button>
            </>
          ) : (
            <Link to="/login" onClick={() => setMenuOpen(false)}
              className="block px-3 py-2 mt-1 rounded-lg bg-blue-600 text-white text-sm font-medium">
              {t('auth.login')}
            </Link>
          )}
        </div>
      )}
    </header>
  );
}
