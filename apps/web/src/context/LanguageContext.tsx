import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { Locale, TranslationKey, createTranslator, applyLanguageToDOM } from '@type-club/editor'

interface LanguageContextType {
  language: Locale
  setLanguage: (lang: Locale) => void
  t: (key: TranslationKey, params?: Record<string, string | number>) => string
}

const STORAGE_KEY = 'typeclub_language'

const LanguageContext = createContext<LanguageContextType | undefined>(undefined)

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Locale>(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === 'en' || saved === 'ru') return saved
    return 'en'
  })

  useEffect(() => {
    applyLanguageToDOM(language)
    localStorage.setItem(STORAGE_KEY, language)
  }, [language])

  const setLanguage = (lang: Locale) => {
    setLanguageState(lang)
  }

  const t = createTranslator(language)

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  const context = useContext(LanguageContext)
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider')
  }
  return context
}
