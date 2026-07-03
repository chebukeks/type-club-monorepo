import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { articlesApi, ArticleListItem } from "../api";
import { useAuth } from "../context/AuthContext";
import { BookOpen, Download, PenTool } from "lucide-react";
import ArticleCard from "../components/ArticleCard";

export default function Landing() {
  const { user } = useAuth();
  const [articles, setArticles] = useState<ArticleListItem[]>([]);

  useEffect(() => {
    articlesApi.list(1, 5).then(setArticles).catch(() => {});
  }, []);

  return (
    <div>
      {/* Hero */}
      <section className="max-w-6xl mx-auto px-4 py-20 md:py-32 text-center">
        <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-4">
          Type Club
        </h1>
        <p className="text-xl text-gray-500 dark:text-gray-400 max-w-2xl mx-auto mb-8">
          A seamless Markdown editor and article hosting platform. Write beautifully, publish instantly.
        </p>
        <div className="flex flex-wrap justify-center gap-4">
          <Link to="/register" className="px-6 py-3 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 transition-colors text-lg">
            Get Started
          </Link>
          <Link to="/articles" className="px-6 py-3 rounded-xl border border-gray-300 dark:border-gray-700 font-semibold hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors text-lg flex items-center gap-2">
            <BookOpen size={20} /> Browse Articles
          </Link>
        </div>
      </section>

      {/* Desktop App Promo */}
      <section className="max-w-6xl mx-auto px-4 py-16 border-t border-gray-200 dark:border-gray-800">
        <div className="flex flex-col md:flex-row items-center gap-8 md:gap-16">
          <div className="flex-1">
            <h2 className="text-3xl font-bold mb-4">Desktop App Available</h2>
            <p className="text-gray-500 dark:text-gray-400 mb-6 leading-relaxed">
              Download the Type Club desktop app for offline editing, file management,
              and a distraction-free writing experience. All your favorite features
              — LaTeX math, syntax highlighting, focus mode — right on your desktop.
            </p>
            <Link to="/download" className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-gray-900 dark:bg-white dark:text-gray-900 text-white font-semibold hover:opacity-90 transition-opacity">
              <Download size={18} /> Download
            </Link>
          </div>
          <div className="flex-1 bg-gray-100 dark:bg-gray-800 rounded-2xl p-8 text-center">
            <PenTool size={48} className="mx-auto mb-4 text-blue-600" />
            <p className="text-sm text-gray-500">
              Windows · macOS · Linux<br />
              Version 0.3.2
            </p>
          </div>
        </div>
      </section>

      {/* Recent Articles */}
      {articles.length > 0 && (
        <section className="max-w-6xl mx-auto px-4 py-16 border-t border-gray-200 dark:border-gray-800">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl font-bold">Recent Articles</h2>
            <Link to="/articles" className="text-blue-600 hover:underline text-sm font-medium">
              View all →
            </Link>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {articles.map((a) => (
              <ArticleCard key={a.id} article={a} isModerator={user?.role === "moderator"} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
