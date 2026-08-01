import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { commentsApi, Comment } from "../api";
import { useAuth } from "../context/AuthContext";
import { Send, Trash2, Pencil, Check, X } from "lucide-react";

interface Props {
  articleId: number;
}

const PAGE_SIZE = 20;

export default function CommentSection({ articleId }: Props) {
  const { user } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<"newest" | "oldest">("newest");
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editContent, setEditContent] = useState("");
  const listRef = useRef<HTMLDivElement>(null);

  const fetchComments = useCallback(async () => {
    setLoading(true);
    try {
      const { items, total: t } = await commentsApi.list(articleId, sort, page, PAGE_SIZE);
      setComments(items);
      setTotal(t);
    } catch {
    } finally {
      setLoading(false);
    }
  }, [articleId, sort, page]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || submitting) return;
    setSubmitting(true);
    setError("");
    try {
      const comment = await commentsApi.create(articleId, content.trim());
      setContent("");
      if (sort === "newest") {
        setComments((prev) => [comment, ...prev]);
        setTotal((t) => t + 1);
      } else {
        fetchComments();
      }
    } catch (err: any) {
      setError(err.message || "Failed to post comment");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (commentId: number) => {
    if (!confirm("Delete this comment?")) return;
    try {
      await commentsApi.delete(commentId);
      setComments((prev) => prev.filter((c) => c.id !== commentId));
      setTotal((t) => t - 1);
    } catch {
    }
  };

  const startEdit = (comment: Comment) => {
    setEditingId(comment.id);
    setEditContent(comment.content);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditContent("");
  };

  const saveEdit = async (commentId: number) => {
    if (!editContent.trim()) return;
    try {
      const updated = await commentsApi.update(commentId, editContent.trim());
      setComments((prev) => prev.map((c) => (c.id === commentId ? updated : c)));
      setEditingId(null);
    } catch {
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (days < 1) {
      const hours = Math.floor(diff / (1000 * 60 * 60));
      if (hours < 1) {
        const mins = Math.floor(diff / (1000 * 60));
        return mins < 1 ? "just now" : `${mins}m ago`;
      }
      return `${hours}h ago`;
    }
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-800" ref={listRef}>
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold">
          Comments {total > 0 && <span className="text-gray-400 font-normal">({total})</span>}
        </h3>
        <div className="flex items-center gap-1 text-sm">
          <button
            onClick={() => { setSort("newest"); setPage(1); }}
            className={`px-2 py-1 rounded-md transition-colors ${sort === "newest" ? "bg-gray-100 dark:bg-gray-800" : "hover:bg-gray-100 dark:hover:bg-gray-800"}`}
          >
            Newest
          </button>
          <button
            onClick={() => { setSort("oldest"); setPage(1); }}
            className={`px-2 py-1 rounded-md transition-colors ${sort === "oldest" ? "bg-gray-100 dark:bg-gray-800" : "hover:bg-gray-100 dark:hover:bg-gray-800"}`}
          >
            Oldest
          </button>
        </div>
      </div>

      {user ? (
        <form onSubmit={handleSubmit} className="mb-6">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Write a comment..."
            maxLength={5000}
            rows={3}
            className="w-full px-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none text-sm"
          />
          {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
          <div className="flex items-center justify-between mt-2">
            <span className="text-xs text-gray-400">{content.length}/5000</span>
            <button
              type="submit"
              disabled={!content.trim() || submitting}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              <Send size={14} />
              {submitting ? "Posting..." : "Post"}
            </button>
          </div>
        </form>
      ) : (
        <div className="mb-6 p-4 rounded-xl bg-gray-50 dark:bg-gray-900 text-center text-sm text-gray-500">
          <Link to="/login" className="text-blue-600 hover:underline">Sign in</Link> to leave a comment.
        </div>
      )}

      {loading ? (
        <div className="text-center py-10 text-gray-400 text-sm">Loading comments...</div>
      ) : comments.length === 0 ? (
        <div className="text-center py-10 text-gray-400 text-sm">No comments yet. Be the first!</div>
      ) : (
        <div className="space-y-4">
          {comments.map((comment) => {
            const isAuthor = user?.id === comment.user_id;
            const isModerator = user?.role === "moderator";
            return (
              <div key={comment.id} className="p-4 rounded-xl bg-gray-50 dark:bg-gray-900">
                <div className="flex items-center gap-2 mb-2">
                  <Link
                    to={`/${comment.author_nickname}`}
                    className="text-sm font-medium hover:text-blue-600 transition-colors"
                  >
                    {comment.author_nickname}
                  </Link>
                  <span className="text-xs text-gray-400">{formatDate(comment.updated_at)}</span>
                  {comment.updated_at !== comment.created_at && (
                    <span className="text-xs text-gray-400 italic">(edited)</span>
                  )}
                </div>
                {editingId === comment.id ? (
                  <div>
                    <textarea
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      maxLength={5000}
                      rows={2}
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none text-sm"
                    />
                    <div className="flex items-center gap-2 mt-2">
                      <button
                        onClick={() => saveEdit(comment.id)}
                        disabled={!editContent.trim()}
                        className="flex items-center gap-1 px-3 py-1 rounded-md bg-blue-600 text-white text-xs font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
                      >
                        <Check size={12} /> Save
                      </button>
                      <button
                        onClick={cancelEdit}
                        className="flex items-center gap-1 px-3 py-1 rounded-md border border-gray-300 dark:border-gray-700 text-xs font-medium hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                      >
                        <X size={12} /> Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm whitespace-pre-wrap break-words">{comment.content}</p>
                )}
                {(isAuthor || isModerator) && editingId !== comment.id && (
                  <div className="flex items-center gap-2 mt-2">
                    {isAuthor && (
                      <button
                        onClick={() => startEdit(comment)}
                        className="flex items-center gap-1 text-xs text-gray-400 hover:text-blue-600 transition-colors"
                      >
                        <Pencil size={12} /> Edit
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(comment.id)}
                      className="flex items-center gap-1 text-xs text-gray-400 hover:text-red-600 transition-colors"
                    >
                      <Trash2 size={12} /> Delete
                    </button>
                  </div>
                )}
              </div>
            );
          })}
          {totalPages > 1 && (
            <div className="flex justify-center mt-6">
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={page >= totalPages}
                className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-700 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 transition-colors"
              >
                {page >= totalPages ? "No more comments" : `Load more (page ${page + 1} of ${totalPages})`}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
