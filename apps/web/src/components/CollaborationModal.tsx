import { useState, useEffect, useCallback } from "react"
import { X, Copy, Check, Trash2 } from "lucide-react"
import { collaborationApi, Collaborator, ShareLink } from "../api"
import UserAutocompleteInput from "./UserAutocompleteInput"

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
  const [editorLink, setEditorLink] = useState<ShareLink | null>(null)
  const [coAuthorLink, setCoAuthorLink] = useState<ShareLink | null>(null)
  const [copied, setCopied] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [refresh, setRefresh] = useState(0)

  const loadCollaborators = useCallback(() => {
    if (!articleId) return
    collaborationApi.list(articleId).then((list) => {
      setEditors(list.filter((c) => c.role === "editor"))
      setCoAuthors(list.filter((c) => c.role === "co_author"))
    }).catch(() => {})
  }, [articleId])

  useEffect(() => {
    loadCollaborators()
  }, [loadCollaborators, refresh])

  if (!articleId) return null

  const invite = async (nickname: string, role: "editor" | "co_author", clearInput: () => void) => {
    const trimmed = nickname.trim()
    if (!trimmed) return
    setError("")
    setLoading(true)
    try {
      await collaborationApi.invite(articleId, trimmed, role)
      clearInput()
      setRefresh((r) => r + 1)
    } catch (err: any) {
      setError(err.message || "Invite failed")
    } finally {
      setLoading(false)
    }
  }

  const remove = async (userId: number) => {
    setError("")
    try {
      await collaborationApi.remove(articleId, userId)
      setRefresh((r) => r + 1)
    } catch (err: any) {
      setError(err.message || "Remove failed")
    }
  }

  const generateLink = async (role: "editor" | "co_author") => {
    setError("")
    try {
      const link = await collaborationApi.generateLink(articleId, role)
      if (role === "editor") setEditorLink(link)
      else setCoAuthorLink(link)
    } catch (err: any) {
      setError(err.message || "Failed to generate link")
    }
  }

  const copyLink = (url: string) => {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(url)
      setTimeout(() => setCopied(""), 2000)
    })
  }

  const inputClass = "flex-1 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded px-2 py-1 text-sm text-gray-700 dark:text-gray-300 outline-none focus:border-gray-400"
  const btnClass = "px-2.5 py-1 rounded text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 shrink-0"
  const sectionTitleClass = "text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-2"
  const subLabelClass = "text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-tight mt-3 mb-1.5"

  const memberList = (members: Collaborator[]) => members.map((c) => (
    <div key={c.user_id} className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-gray-50 dark:hover:bg-gray-800 text-sm">
      <span className="text-gray-700 dark:text-gray-300">{c.nickname}</span>
      <button
        className="p-0.5 rounded hover:bg-red-50 dark:hover:bg-red-950 text-gray-400 hover:text-red-500"
        onClick={() => remove(c.user_id)}
      ><Trash2 size={14} /></button>
    </div>
  ))

  const linkSection = (label: string, role: "editor" | "co_author", link: ShareLink | null) => (
    <div className="mt-2">
      <div className={subLabelClass}>Приглашение по ссылке</div>
      {link ? (
        <div className="flex gap-2 items-center mt-1">
          <input
            className={`${inputClass} text-xs`}
            value={link.url}
            readOnly
            onFocus={(e) => e.target.select()}
          />
          <button
            className={`${btnClass} flex items-center gap-1`}
            onClick={() => copyLink(link.url)}
          >
            {copied === link.url ? <Check size={14} /> : <Copy size={14} />}
            {copied === link.url ? "Скопировано" : "Копировать"}
          </button>
        </div>
      ) : (
        <button
          className="mt-1 w-full py-1.5 rounded bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 text-sm hover:bg-gray-200 dark:hover:bg-gray-700"
          onClick={() => generateLink(role)}
        >Сгенерировать ссылку</button>
      )}
      {link && (
        <button
          className="mt-1 w-full py-1.5 rounded text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          onClick={() => generateLink(role)}
        >Сгенерировать новую (старая перестанет работать)</button>
      )}
    </div>
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md p-6 mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold">Совместная работа</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
            <X size={18} />
          </button>
        </div>

        {error && (
          <div className="mb-3 p-2 rounded bg-red-50 dark:bg-red-950 border border-red-400 dark:border-red-600 text-red-600 dark:text-red-500 text-xs">
            {error}
          </div>
        )}

        {/* --- Block 1: Editors --- */}
        <div>
          <h3 className={sectionTitleClass}>Редакторы</h3>
          <div className="flex gap-2 mb-2">
            <UserAutocompleteInput
              value={editorInput}
              onChange={setEditorInput}
              onSubmit={() => invite(editorInput, "editor", () => setEditorInput(""))}
              placeholder="Никнейм пользователя"
            />
            <button
              className={btnClass}
              disabled={loading || !editorInput.trim()}
              onClick={() => invite(editorInput, "editor", () => setEditorInput(""))}
            >Пригласить</button>
          </div>
          {editors.length > 0 ? memberList(editors) : (
            <div className="text-xs text-gray-400 dark:text-gray-500 px-2 py-1">Нет приглашённых</div>
          )}
          {linkSection("редакторов", "editor", editorLink)}
        </div>

        {/* Separator line between Editors and Co-authors */}
        <div className="border-t border-gray-200 dark:border-gray-700 my-4" />

        {/* --- Block 2: Co-authors --- */}
        <div>
          <h3 className={sectionTitleClass}>Соавторы</h3>
          <div className="flex gap-2 mb-2">
            <UserAutocompleteInput
              value={coAuthorInput}
              onChange={setCoAuthorInput}
              onSubmit={() => invite(coAuthorInput, "co_author", () => setCoAuthorInput(""))}
              placeholder="Никнейм пользователя"
            />
            <button
              className={btnClass}
              disabled={loading || !coAuthorInput.trim()}
              onClick={() => invite(coAuthorInput, "co_author", () => setCoAuthorInput(""))}
            >Пригласить</button>
          </div>
          {coAuthors.length > 0 ? memberList(coAuthors) : (
            <div className="text-xs text-gray-400 dark:text-gray-500 px-2 py-1">Нет приглашённых</div>
          )}
          {linkSection("соавторов", "co_author", coAuthorLink)}
        </div>
      </div>
    </div>
  )
}
