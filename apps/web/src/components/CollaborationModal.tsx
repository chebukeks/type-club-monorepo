import { useState, useEffect } from "react"
import { X, Copy, Check, Trash2 } from "lucide-react"
import { collaborationApi, Collaborator, ShareLink } from "../api"

interface CollaborationModalProps {
  articleId: number | null
  onClose: () => void
  onBack?: () => void
}

export default function CollaborationModal({
  articleId,
  onClose,
  onBack,
}: CollaborationModalProps) {
  const [editors, setEditors] = useState<Collaborator[]>([])
  const [coAuthors, setCoAuthors] = useState<Collaborator[]>([])
  const [editorInput, setEditorInput] = useState("")
  const [coAuthorInput, setCoAuthorInput] = useState("")
  const [shareLink, setShareLink] = useState<ShareLink | null>(null)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!articleId) return
    collaborationApi.list(articleId).then((list) => {
      setEditors(list.filter((c) => c.role === "editor"))
      setCoAuthors(list.filter((c) => c.role === "co_author"))
    }).catch(() => {})
  }, [articleId])

  if (!articleId) return null

  const invite = async (nickname: string, role: "editor" | "co_author", clearInput: () => void) => {
    const trimmed = nickname.trim()
    if (!trimmed) return
    setError("")
    setLoading(true)
    try {
      const c = await collaborationApi.invite(articleId, trimmed, role)
      if (role === "editor") setEditors((prev) => [...prev, c])
      else setCoAuthors((prev) => [...prev, c])
      clearInput()
    } catch (err: any) {
      setError(err.message || "Invite failed")
    } finally {
      setLoading(false)
    }
  }

  const remove = async (userId: number, role: "editor" | "co_author") => {
    setError("")
    try {
      await collaborationApi.remove(articleId, userId)
      if (role === "editor") setEditors((prev) => prev.filter((c) => c.user_id !== userId))
      else setCoAuthors((prev) => prev.filter((c) => c.user_id !== userId))
    } catch (err: any) {
      setError(err.message || "Remove failed")
    }
  }

  const generateLink = async () => {
    setError("")
    try {
      const link = await collaborationApi.generateLink(articleId)
      setShareLink(link)
    } catch (err: any) {
      setError(err.message || "Failed to generate link")
    }
  }

  const copyLink = () => {
    if (!shareLink) return
    navigator.clipboard.writeText(shareLink.url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const inputClass = "flex-1 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded px-2 py-1 text-sm text-gray-700 dark:text-gray-300 outline-none focus:border-gray-400"
  const btnClass = "px-2 py-1 rounded text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 shrink-0"
  const sectionClass = "mb-4"
  const labelClass = "text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-tight mb-2"

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md p-6 mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            {onBack && (
              <button onClick={onBack} className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-sm">
                ←
              </button>
            )}
            <h2 className="text-lg font-bold">Совместная работа</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
            <X size={18} />
          </button>
        </div>

        {error && (
          <div className="mb-3 p-2 rounded bg-red-50 dark:bg-red-950 border border-red-400 dark:border-red-600 text-red-600 dark:text-red-500 text-xs">
            {error}
          </div>
        )}

        <div className={sectionClass}>
          <div className={labelClass}>Редакторы</div>
          <div className="flex gap-2 mb-2">
            <input
              className={inputClass}
              placeholder="Никнейм пользователя"
              value={editorInput}
              onChange={(e) => setEditorInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && invite(editorInput, "editor", () => setEditorInput(""))}
            />
            <button
              className={btnClass}
              disabled={loading || !editorInput.trim()}
              onClick={() => invite(editorInput, "editor", () => setEditorInput(""))}
            >Пригласить</button>
          </div>
          {editors.map((c) => (
            <div key={c.user_id} className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-gray-50 dark:hover:bg-gray-800 text-sm">
              <span className="text-gray-700 dark:text-gray-300">{c.nickname}</span>
              <button
                className="p-0.5 rounded hover:bg-red-50 dark:hover:bg-red-950 text-gray-400 hover:text-red-500"
                onClick={() => remove(c.user_id, "editor")}
              ><Trash2 size={14} /></button>
            </div>
          ))}
          {editors.length === 0 && (
            <div className="text-xs text-gray-400 dark:text-gray-500 px-2 py-1">Нет приглашённых</div>
          )}
        </div>

        <div className={sectionClass}>
          <div className={labelClass}>Соавторы</div>
          <div className="flex gap-2 mb-2">
            <input
              className={inputClass}
              placeholder="Никнейм пользователя"
              value={coAuthorInput}
              onChange={(e) => setCoAuthorInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && invite(coAuthorInput, "co_author", () => setCoAuthorInput(""))}
            />
            <button
              className={btnClass}
              disabled={loading || !coAuthorInput.trim()}
              onClick={() => invite(coAuthorInput, "co_author", () => setCoAuthorInput(""))}
            >Пригласить</button>
          </div>
          {coAuthors.map((c) => (
            <div key={c.user_id} className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-gray-50 dark:hover:bg-gray-800 text-sm">
              <span className="text-gray-700 dark:text-gray-300">{c.nickname}</span>
              <button
                className="p-0.5 rounded hover:bg-red-50 dark:hover:bg-red-950 text-gray-400 hover:text-red-500"
                onClick={() => remove(c.user_id, "co_author")}
              ><Trash2 size={14} /></button>
            </div>
          ))}
          {coAuthors.length === 0 && (
            <div className="text-xs text-gray-400 dark:text-gray-500 px-2 py-1">Нет приглашённых</div>
          )}
        </div>

        <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-4">
          <div className={labelClass}>Приглашение по ссылке</div>
          {shareLink ? (
            <div className="flex gap-2 items-center mt-2">
              <input
                className={`${inputClass} text-xs`}
                value={shareLink.url}
                readOnly
                onFocus={(e) => e.target.select()}
              />
              <button
                className={`${btnClass} flex items-center gap-1`}
                onClick={copyLink}
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
                {copied ? "Скопировано" : "Копировать"}
              </button>
            </div>
          ) : (
            <button
              className="mt-2 w-full py-1.5 rounded bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 text-sm hover:bg-gray-200 dark:hover:bg-gray-700"
              onClick={generateLink}
            >Сгенерировать ссылку</button>
          )}
          {shareLink && (
            <button
              className="mt-2 w-full py-1.5 rounded text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              onClick={generateLink}
            >Сгенерировать новую ссылку (старая перестанет работать)</button>
          )}
        </div>
      </div>
    </div>
  )
}
