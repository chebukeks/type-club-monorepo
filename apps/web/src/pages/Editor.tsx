import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { articlesApi, Article } from "../api";
import { MarkdownEditor, EditorMode } from "../components/MarkdownEditor";
import EditorHeader from "../components/EditorHeader";
import SiteHeader from "../components/SiteHeader";
import PublishModal from "../components/PublishModal";

export default function Editor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isNew = !id;

  const [articleId, setArticleId] = useState<number | null>(id ? parseInt(id) : null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [editorMode, setEditorMode] = useState<EditorMode>("seamless");
  const [autosave, setAutosave] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showPublish, setShowPublish] = useState(false);
  const [accessState, setAccessState] = useState("private");
  const [slug, setSlug] = useState("");
  const [showSiteHeader, setShowSiteHeader] = useState(false);
  const [loaded, setLoaded] = useState(id ? false : true);

  const autosaveRef = useRef(autosave);
  autosaveRef.current = autosave;
  const contentRef = useRef(content);
  contentRef.current = content;
  const titleRef = useRef(title);
  titleRef.current = title;

  // Load existing article
  useEffect(() => {
    if (!articleId) return;
    articlesApi.get(articleId).then((a) => {
      setTitle(a.title);
      setContent(a.content);
      setAccessState(a.access_state);
      setSlug(a.slug);
      setLoaded(true);
    }).catch(() => navigate("/my-articles"));
  }, [articleId, navigate]);

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
          await articlesApi.update(articleId, { title: titleRef.current, content: contentRef.current });
        } else {
          const res = await articlesApi.create({ title: titleRef.current || "Untitled", content: contentRef.current });
          setArticleId(res.id);
          navigate(`/editor/${res.id}`, { replace: true });
        }
      } catch {
        // silently fail on autosave
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [articleId, navigate]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      if (articleId) {
        await articlesApi.update(articleId, { title, content });
      } else {
        const res = await articlesApi.create({ title: title || "Untitled", content });
        setArticleId(res.id);
        navigate(`/editor/${res.id}`, { replace: true });
      }
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
      {showSiteHeader ? (
        <SiteHeader onLogoClick={() => setShowSiteHeader(false)} />
      ) : (
        <EditorHeader
          title={title}
          setTitle={setTitle}
          editorMode={editorMode}
          setEditorMode={setEditorMode}
          autosave={autosave}
          setAutosave={setAutosave}
          onSave={handleSave}
          onPublish={() => setShowPublish(true)}
          saving={saving}
          isNew={isNew}
          onToggleHeader={() => setShowSiteHeader(!showSiteHeader)}
        />
      )}

      <MarkdownEditor
        content={content}
        editorMode={editorMode}
        onChange={setContent}
        textZoom={100}
        documentZoom={100}
      />

      {showPublish && (
        <PublishModal
          currentState={accessState}
          currentSlug={slug}
          onApply={handlePublish}
          onClose={() => setShowPublish(false)}
        />
      )}
    </div>
  );
}
