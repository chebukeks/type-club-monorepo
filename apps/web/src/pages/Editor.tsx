import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { articlesApi, collaborationApi, Article } from "../api";
import { MarkdownEditor, EditorMode } from "../components/MarkdownEditor";
import EditorHeader from "../components/EditorHeader";
import SiteHeader from "../components/SiteHeader";
import PublishModal, { generateRandomSlug } from "../components/PublishModal";
import TableOfContents from "../components/TableOfContents";
import { useAuth } from "../context/AuthContext";
import { useCollaboration } from "../hooks/useCollaboration";
import type { TocItem, SuggestionItem } from "@type-club/editor";

export default function Editor() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const isNew = !id;
  const initialSuggest = searchParams.get("mode") === "suggest";

  const [articleId, setArticleId] = useState<number | null>(id ? parseInt(id) : null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [editorMode, setEditorMode] = useState<EditorMode>("seamless");
  const [autosave, setAutosave] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showPublish, setShowPublish] = useState(false);
  const [accessState, setAccessState] = useState("private");
  const [slug, setSlug] = useState("");
  const [authorNickname, setAuthorNickname] = useState("");
  const [loaded, setLoaded] = useState(id ? false : true);
  const [userRole, setUserRole] = useState<"author" | "co_author" | "editor" | null>(null);
  const [suggestionModeActive, setSuggestionModeActive] = useState(initialSuggest);
  const [toc, setToc] = useState<TocItem[]>([]);
  const [suggestions, setSuggestions] = useState<SuggestionItem[]>([]);

  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const docScale = 1.0;
  const docHalfWidth = 430 * docScale;
  const leftPos = containerWidth / 2 + docHalfWidth + 16;
  const rightPos = 24;
  const availableWidth = containerWidth - rightPos - leftPos;

  const showRightSidebar = availableWidth >= 180 && containerWidth >= 900;

  const { user } = useAuth();
  const collab = useCollaboration(articleId, user ?? null, userRole);
  // Collaboration is active for any saved article; the collab-server then owns
  // content persistence, so the client only manages metadata (title/slug/state).
  const collabActive = collab.config !== null;

  const autosaveRef = useRef(autosave);
  autosaveRef.current = autosave;
  const contentRef = useRef(content);
  contentRef.current = content;
  const titleRef = useRef(title);
  titleRef.current = title;

  // Load existing article & determine user role
  useEffect(() => {
    if (!articleId || !user) return;
    articlesApi.get(articleId).then((a) => {
      setTitle(a.title);
      setContent(a.content);
      setAccessState(a.access_state);
      setSlug(a.slug || generateRandomSlug());
      setAuthorNickname(a.author_nickname || "");
      setLoaded(true);

      if (a.author_id === user.id) {
        setUserRole("author");
      } else {
        collaborationApi.list(articleId).then((list) => {
          const me = list.find((c) => c.user_id === user.id);
          setUserRole((me?.role as any) ?? null);
        }).catch(() => {});
      }
    }).catch(() => navigate("/my-articles"));
  }, [articleId, user, navigate]);

  // Autosave
  const loadedRef = useRef(loaded);
  loadedRef.current = loaded;
  useEffect(() => {
    const interval = setInterval(async () => {
      if (!autosaveRef.current) return;
      if (articleId && !loadedRef.current) return;
      if (!titleRef.current.trim() && !contentRef.current.trim()) return;
      try {
        if (articleId) {
          // Content is owned and persisted by the collab-server. Only sync
          // metadata (title) from the client to avoid clobbering the live doc.
          await articlesApi.update(articleId, { title: titleRef.current });
        } else {
          const defaultSlug = generateRandomSlug();
          const res = await articlesApi.create({ title: titleRef.current || "Untitled", content: contentRef.current, slug: defaultSlug });
          setArticleId(res.id);
          setSlug(res.slug || defaultSlug);
          navigate(`/editor/${res.id}`, { replace: true });
        }
      } catch {
        // silently fail on autosave
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [articleId, navigate]);

  const handleSave = useCallback(async () => {
    if (articleId) {
      // Collaborative content is saved continuously by the server. Best-effort
      // flush of the title (metadata); ignore permission errors for editors.
      try {
        await articlesApi.update(articleId, { title });
      } catch {
        /* ignore — content is persisted server-side */
      }
      return;
    }
    setSaving(true);
    try {
      const res = await articlesApi.create({ title: title || "Untitled", content });
      setArticleId(res.id);
      navigate(`/editor/${res.id}`, { replace: true });
    } catch (err: any) {
      alert(err.message || "Save failed");
    } finally {
      setSaving(false);
    }
  }, [articleId, title, content, navigate]);

  const handlePublish = useCallback(
    async (newState: string, newSlug: string) => {
      if (!articleId) {
        const res = await articlesApi.create({ title: title || "Untitled", content, slug: newSlug });
        setArticleId(res.id);
        navigate(`/editor/${res.id}`, { replace: true });
        await articlesApi.update(res.id, { access_state: newState, slug: newSlug });
        setAccessState(newState);
        setSlug(newSlug);
      } else {
        await articlesApi.update(articleId, { access_state: newState, slug: newSlug });
        setAccessState(newState);
        setSlug(newSlug);
      }
    },
    [articleId, title, content, navigate]
  );

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <EditorHeader
        title={title}
        setTitle={setTitle}
        editorMode={editorMode}
        setEditorMode={(m) => {
          setEditorMode(m);
          if (m !== "seamless") setSuggestionModeActive(false);
        }}
        onPublish={() => {
          if (userRole === "author" || isNew || !userRole) {
            setShowPublish(true);
          }
        }}
        isNew={isNew}
        articleId={articleId}
        slug={slug}
        authorNickname={authorNickname}
        collabActive={collabActive}
        collabSynced={collab.synced}
        userRole={userRole}
        suggestionModeActive={suggestionModeActive}
        onToggleSuggestionMode={(active) => {
          setSuggestionModeActive(active);
          if (active) setEditorMode("seamless");
        }}
      />

      <div ref={containerRef} className="flex-1 relative flex flex-col overflow-hidden">
        <MarkdownEditor
          content={content}
          editorMode={editorMode}
          onChange={setContent}
          textZoom={100}
          documentZoom={100}
          collaboration={collab.config ?? undefined}
          userRole={userRole}
          userId={user?.id}
          userNickname={user?.nickname}
          suggestionModeActive={suggestionModeActive}
          onTocUpdate={(t, s) => {
            setToc(t);
            if (s) setSuggestions(s);
          }}
        />

        {showRightSidebar ? (
          <div
            style={{
              left: `${leftPos}px`,
              right: "24px",
              top: "16px",
              bottom: "24px",
            }}
            className="absolute z-30 pointer-events-auto"
          >
            <TableOfContents variant="sidebar" toc={toc} suggestions={suggestions} isEditor={true} />
          </div>
        ) : (
          <TableOfContents variant="floating" toc={toc} suggestions={suggestions} isEditor={true} />
        )}
      </div>

      {showPublish && (
        <PublishModal
          currentState={accessState}
          currentSlug={slug}
          articleId={articleId}
          onApply={handlePublish}
          onClose={() => setShowPublish(false)}
        />
      )}
    </div>
  );
}
