import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import { PenTool, BookOpen, User, LogOut, LogIn, Menu, X } from "lucide-react";
import { useState } from "react";
import ThemeSwitcher from "./ThemeSwitcher";

interface SiteHeaderProps {
  onLogoClick?: () => void;
}

export default function SiteHeader({ onLogoClick }: SiteHeaderProps) {
  const { user, logout } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

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
