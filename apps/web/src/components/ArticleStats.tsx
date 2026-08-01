import { useEffect, useRef, useState, useCallback } from "react";
import { statsApi } from "../api";
import { useAuth } from "../context/AuthContext";
import { Heart, Eye, Link } from "lucide-react";

interface Props {
  articleId: number;
  initialViews: number;
  initialLikes: number;
  initialLiked: boolean;
}

export default function ArticleStats({ articleId, initialViews, initialLikes, initialLiked }: Props) {
  const { user } = useAuth();
  const [views, setViews] = useState(initialViews);
  const [likes, setLikes] = useState(initialLikes);
  const [liked, setLiked] = useState(initialLiked);
  const [likePending, setLikePending] = useState(false);
  const [copied, setCopied] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const viewRecorded = useRef(false);

  const handleLike = async () => {
    if (!user || likePending) return;
    setLikePending(true);
    try {
      const res = await statsApi.like(articleId);
      setLiked(res.liked);
      setLikes(res.count);
    } catch {
    } finally {
      setLikePending(false);
    }
  };

  const handleCopyLink = async () => {
    await navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const recordView = useCallback(async () => {
    if (viewRecorded.current) return;
    const key = `viewed_${articleId}`;
    if (sessionStorage.getItem(key)) return;
    try {
      const res = await statsApi.view(articleId);
      setViews(res.count);
      sessionStorage.setItem(key, "1");
      viewRecorded.current = true;
    } catch {
    }
  }, [articleId]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          recordView();
        }
      },
      { threshold: 0.1 }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [recordView]);

  return (
    <>
      <div ref={sentinelRef} className="h-px" />
      <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-800">
        <div className="flex items-center gap-5 text-sm text-gray-500">
          <span className="flex items-center gap-1.5">
            <Eye size={16} />
            {views} views
          </span>
          <button
            onClick={handleLike}
            disabled={!user || likePending}
            title={user ? (liked ? "Unlike" : "Like") : "Sign in to like"}
            className={`flex items-center gap-1.5 transition-colors ${
              liked ? "text-red-500" : "text-gray-500"
            } ${user ? "hover:text-red-500 cursor-pointer" : "cursor-default"}`}
          >
            <Heart size={16} fill={liked ? "currentColor" : "none"} />
            {likes}
          </button>
          <button
            onClick={handleCopyLink}
            className="flex items-center gap-1.5 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
            title="Copy link"
          >
            <Link size={16} />
            {copied ? "Copied!" : "Copy link"}
          </button>
        </div>
      </div>
    </>
  );
}
