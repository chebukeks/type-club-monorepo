import { useCallback, useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { usersApi, UserProfile as UserProfileType, ArticleListItem } from "../api";
import { useAuth } from "../context/AuthContext";
import ArticleCard from "../components/ArticleCard";
import Pagination from "../components/Pagination";
import { Settings, User } from "lucide-react";

const PAGE_SIZE = 20;

export default function UserProfile() {
  const { username } = useParams<{ username: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<UserProfileType | null>(null);
  const [articles, setArticles] = useState<ArticleListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const isOwner = user?.nickname === username;

  const fetchProfile = useCallback(async () => {
    if (!username) return;
    try {
      const p = await usersApi.getProfile(username);
      setProfile(p);
    } catch (err: any) {
      setError(err.message || "User not found");
    }
  }, [username]);

  const fetchArticles = useCallback(async () => {
    if (!username) return;
    setLoading(true);
    try {
      const { items, total: t } = await usersApi.getProfileArticles(username, page, PAGE_SIZE);
      setArticles(items);
      setTotal(t);
    } catch {
    } finally {
      setLoading(false);
    }
  }, [username, page]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  useEffect(() => {
    fetchArticles();
  }, [fetchArticles]);

  if (error) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 text-center">
        <h1 className="text-2xl font-bold mb-2">User not found</h1>
        <p className="text-gray-500 mb-4">{error}</p>
        <Link to="/" className="text-blue-600 hover:underline">Go home</Link>
      </div>
    );
  }

  if (!profile) {
    return <div className="max-w-4xl mx-auto px-4 py-20 text-center text-gray-400">Loading...</div>;
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
                Settings
              </button>
            )}
          </div>
          <div className="flex items-center gap-5 mt-4 text-sm text-gray-500">
            <span className="flex items-center gap-1">
              <User size={14} />
              {profile.article_count} articles
            </span>
            <span>{profile.total_views} views</span>
            <span>{profile.total_likes} likes</span>
          </div>
        </div>
      </div>

      <section>
        <h2 className="text-lg font-semibold mb-4">
          {isOwner ? "All articles" : "Articles"}
        </h2>
        {loading ? (
          <div className="text-center py-20 text-gray-400">Loading...</div>
        ) : articles.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            {isOwner ? "You haven't published any articles yet." : "No published articles."}
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
    </div>
  );
}
