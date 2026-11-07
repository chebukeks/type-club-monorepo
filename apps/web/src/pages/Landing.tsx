import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { articlesApi, ArticleListItem } from "../api";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import ThemeSwitcher from "../components/ThemeSwitcher";
import ArticleCard from "../components/ArticleCard";
import LiveEditorDemo from "../components/LiveEditorDemo";
import DesktopAppPreview from "../components/DesktopAppPreview";
import {
  PenTool,
  Download,
  Users,
  Sigma,
  Laptop,
  Check,
  ArrowRight,
  Terminal,
} from "lucide-react";

declare const __DESKTOP_VERSION__: string;

export default function Landing() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [articles, setArticles] = useState<ArticleListItem[]>([]);
  const [desktopVersion, setDesktopVersion] = useState<string>(
    typeof __DESKTOP_VERSION__ !== "undefined" ? __DESKTOP_VERSION__ : "0.9.9"
  );

  useEffect(() => {
    // Record visit so returning visitors get the Home Hub by default
    try {
      localStorage.setItem("typeclub_visited", "true");
    } catch {
      // ignore
    }

    articlesApi
      .list(1, 4)
      .then(setArticles)
      .catch(() => {});

    fetch("/downloads/latest.json")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (typeof data?.version === "string" && /^[0-9A-Za-z._-]{1,32}$/.test(data.version)) {
          setDesktopVersion(data.version);
        }
      })
      .catch(() => {});
  }, []);

  return (
    <div className="min-h-screen bg-white dark:bg-[#141415] text-gray-900 dark:text-[#ededed] selection:bg-blue-500/20">
      {/* Quiet Minimalist Landing Header */}
      <header className="sticky top-0 z-40 w-full border-b border-gray-200/80 dark:border-white/[0.08] bg-white/80 dark:bg-[#141415]/80 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          {/* Logo & Brand */}
          <Link
            to="/landing"
            className="flex items-center gap-2 text-xl font-bold tracking-tight hover:opacity-80"
          >
            <img src="/icons/icon_48x48.png" alt="Type Club" className="h-8 w-8" />
            Type Club
          </Link>

          {/* Right Action Controls */}
          <div className="flex items-center gap-2">
            {/* Theme & Language Switcher */}
            <ThemeSwitcher />

            {user ? (
              <Link
                to="/"
                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-100 dark:bg-white/[0.08] hover:bg-gray-200 dark:hover:bg-white/[0.12] transition-colors flex items-center gap-1.5 ml-1"
              >
                {t('landing.goToHub')} <ArrowRight size={13} />
              </Link>
            ) : (
              <Link
                to="/login"
                className="px-3 py-1.5 rounded-lg text-xs font-medium text-gray-600 dark:text-[#a1a1a6] hover:text-gray-900 dark:hover:text-white transition-colors ml-1"
              >
                {t('auth.login')}
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-16 pb-12 md:pt-24 md:pb-20 overflow-hidden">
        <div className="max-w-6xl mx-auto px-4 text-center">
          {/* Headline */}
          <h1 className="text-3xl sm:text-5xl md:text-6xl font-bold tracking-tight text-gray-900 dark:text-[#ededed] max-w-3xl mx-auto leading-[1.08] mb-6">
            {t('landing.heroHeadline')}
          </h1>

          {/* Subhead */}
          <p className="text-base sm:text-lg md:text-xl text-gray-600 dark:text-[#a1a1a6] max-w-2xl mx-auto leading-relaxed mb-8">
            {t('landing.heroSub')}
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-wrap items-center justify-center gap-3 mb-14">
            <Link
              to={user ? "/editor" : "/register"}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-blue-600 text-white font-medium text-sm hover:bg-blue-700 transition-colors shadow-sm"
            >
              <PenTool size={16} />
              {t('landing.startWriting')}
            </Link>

            <Link
              to="/download"
              className="inline-flex items-center gap-2 px-5 py-3 rounded-xl border border-gray-200 dark:border-white/[0.1] bg-white dark:bg-[#19191b] text-gray-900 dark:text-[#ededed] font-medium text-sm hover:bg-gray-50 dark:hover:bg-[#232325] transition-colors"
            >
              <Download size={16} className="text-blue-500" />
              {t('landing.download')}
            </Link>

            <Link
              to="/articles"
              className="inline-flex items-center gap-1.5 px-4 py-3 rounded-xl text-sm font-medium text-gray-600 dark:text-[#a1a1a6] hover:text-gray-900 dark:hover:text-white transition-colors"
            >
              {t('landing.browseArticles')} <ArrowRight size={14} />
            </Link>
          </div>

          {/* Visual Hero Moment: Authentic Type Club Editor Mock */}
          <div className="max-w-4xl mx-auto text-left">
            <div className="rounded-2xl border border-gray-200 dark:border-white/[0.1] bg-white dark:bg-[#19191b] shadow-2xl overflow-hidden">
              {/* Window Titlebar */}
              <div className="h-10 px-4 border-b border-gray-200 dark:border-white/[0.08] bg-gray-50 dark:bg-[#141415] flex items-center justify-between text-xs text-gray-500">
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-400/80" />
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-400/80" />
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400/80" />
                  </div>
                  <span className="inline-block ml-3 font-mono text-[11px] text-gray-400">
                    quantum-superposition.md
                  </span>
                </div>
              </div>

              {/* Live editor playground (local only, nothing is saved) */}
              <LiveEditorDemo />
            </div>
          </div>
        </div>
      </section>

      {/* Craft Pillars / Features Section */}
      <section className="py-16 md:py-24 border-t border-gray-200 dark:border-white/[0.08] bg-gray-50/50 dark:bg-[#141415]">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mb-3">
              {t('landing.featurePillarsTitle')}
            </h2>
            <p className="text-sm sm:text-base text-gray-600 dark:text-[#a1a1a6]">
              Никакого лишнего шума — только продуманные типографические инструменты и надежное сохранение.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Pillar 1: Typography & Math */}
            <div className="p-6 rounded-2xl border border-gray-200 dark:border-white/[0.08] bg-white dark:bg-[#19191b] flex flex-col justify-between">
              <div className="space-y-3">
                <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-950/40 border border-purple-100 dark:border-purple-900/60 flex items-center justify-center text-purple-600 dark:text-purple-400">
                  <Sigma size={20} />
                </div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-[#ededed]">
                  {t('landing.feature1Title')}
                </h3>
                <p className="text-sm text-gray-600 dark:text-[#a1a1a6] leading-relaxed">
                  {t('landing.feature1Desc')}
                </p>
              </div>
            </div>

            {/* Pillar 2: Offline Desktop */}
            <div className="p-6 rounded-2xl border border-gray-200 dark:border-white/[0.08] bg-white dark:bg-[#19191b] flex flex-col justify-between">
              <div className="space-y-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900/60 flex items-center justify-center text-blue-600 dark:text-blue-400">
                  <Laptop size={20} />
                </div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-[#ededed]">
                  {t('landing.feature2Title')}
                </h3>
                <p className="text-sm text-gray-600 dark:text-[#a1a1a6] leading-relaxed">
                  {t('landing.feature2Desc')}
                </p>
              </div>
            </div>

            {/* Pillar 3: Real-time Collaboration */}
            <div className="p-6 rounded-2xl border border-gray-200 dark:border-white/[0.08] bg-white dark:bg-[#19191b] flex flex-col justify-between">
              <div className="space-y-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-900/60 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                  <Users size={20} />
                </div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-[#ededed]">
                  {t('landing.feature3Title')}
                </h3>
                <p className="text-sm text-gray-600 dark:text-[#a1a1a6] leading-relaxed">
                  {t('landing.feature3Desc')}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Desktop App Showcase Section */}
      <section className="py-16 md:py-24 border-t border-gray-200 dark:border-white/[0.08]">
        <div className="max-w-6xl mx-auto px-4">
          <div className="rounded-3xl border border-gray-200 dark:border-white/[0.08] bg-gradient-to-b from-gray-50 to-white dark:from-[#19191b] dark:to-[#141415] p-6 sm:p-8 md:p-10">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-center">
              {/* Left Column (5/12): Details & Download Link */}
              <div className="lg:col-span-5 space-y-6">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-mono bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-300 border border-blue-200 dark:border-blue-900">
                  <Terminal size={12} />
                  <span>Desktop Edition · v{desktopVersion}</span>
                </div>

                <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight text-gray-900 dark:text-white">
                  {t('landing.desktopBannerTitle')}
                </h2>

                <p className="text-sm sm:text-base text-gray-600 dark:text-[#a1a1a6] leading-relaxed">
                  {t('landing.desktopBannerDesc')}
                </p>

                <div className="space-y-3 pt-2">
                  <div className="flex items-center gap-3 text-sm text-gray-700 dark:text-gray-300">
                    <Check size={16} className="text-emerald-500 shrink-0" />
                    <span>Быстрое переключение между вкладками и файлами</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-gray-700 dark:text-gray-300">
                    <Check size={16} className="text-emerald-500 shrink-0" />
                    <span>Режим фокуса на абзаце или предложении</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-gray-700 dark:text-gray-300">
                    <Check size={16} className="text-emerald-500 shrink-0" />
                    <span>Экспорт в HTML и печать без потерь форматирования</span>
                  </div>
                </div>

                <div className="pt-4">
                  <Link
                    to="/download"
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-sm font-semibold hover:opacity-90 transition-opacity"
                  >
                    <Download size={16} />
                    {t('landing.download')}
                  </Link>
                </div>
              </div>

              {/* Right Column (7/12): 1:1 Vector Replica of the Desktop Application */}
              <div className="lg:col-span-7">
                <DesktopAppPreview />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Recent Community Articles */}
      {articles.length > 0 && (
        <section className="py-16 md:py-20 border-t border-gray-200 dark:border-white/[0.08]">
          <div className="max-w-6xl mx-auto px-4">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-[#ededed]">
                  {t('landing.recentArticles')}
                </h2>
                <p className="text-xs sm:text-sm text-gray-500 dark:text-[#a1a1a6] mt-0.5">
                  Публикации сообщества Type Club
                </p>
              </div>
              <Link
                to="/articles"
                className="text-xs sm:text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
              >
                {t('landing.viewAll')}
              </Link>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {articles.map((art) => (
                <ArticleCard key={art.id} article={art} isModerator={user?.role === "moderator"} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Quiet Footer */}
      <footer className="border-t border-gray-200 dark:border-white/[0.08] py-10 text-xs text-gray-500 dark:text-[#85858b]">
        <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <img src="/icons/icon_48x48.png" alt="Type Club" className="h-5 w-5 opacity-80" />
            <span>Type Club — Seamless Markdown Editor</span>
          </div>

          <div className="flex items-center gap-4">
            <Link to="/articles" className="hover:text-gray-900 dark:hover:text-white transition-colors">
              {t('nav.articles')}
            </Link>
            <Link to="/download" className="hover:text-gray-900 dark:hover:text-white transition-colors">
              {t('nav.download')}
            </Link>
            <Link to="/login" className="hover:text-gray-900 dark:hover:text-white transition-colors">
              {t('auth.login')}
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
