import { useEffect, useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { collaborationApi } from "../api"
import { useAuth } from "../context/AuthContext"
import { useLanguage } from "../context/LanguageContext"

export default function JoinPage() {
  const { token } = useParams<{ token: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { t } = useLanguage()
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!token) {
      navigate("/")
      return
    }
    if (!user) {
      navigate(`/login?redirect=/join/${token}`)
      return
    }
    collaborationApi.joinByToken(token)
      .then((c) => {
        collaborationApi.getByToken(token).then((article) => {
          navigate(`/editor/${article.id}`)
        }).catch(() => {
          setError(t('join.loadArticleError'))
          setLoading(false)
        })
      })
      .catch((err: any) => {
        setError(err.message || t('join.joinError'))
        setLoading(false)
      })
  }, [token, user, navigate, t])

  if (error) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-500 mb-4">{error}</p>
          <button
            onClick={() => navigate("/my-articles")}
            className="px-4 py-2 rounded bg-blue-600 text-white text-sm hover:bg-blue-700"
          >
            {t('join.toMyArticles')}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-[50vh] flex items-center justify-center">
      <p className="text-gray-500">{t('join.joining')}</p>
    </div>
  )
}
