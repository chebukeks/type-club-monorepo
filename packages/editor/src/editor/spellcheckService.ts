export interface SpellcheckProvider {
  isWordMisspelled?: (word: string) => boolean | Promise<boolean>
  getWordSuggestions?: (word: string) => string[] | Promise<string[]>
  checkWords?: (words: string[]) => string[] | Promise<string[]>
}

class SpellcheckService {
  private customWords = new Set<string>()
  private enabledLanguages = new Set<string>(['ru-RU', 'en-US'])
  private isEnabled = true
  private wordCache = new Map<string, boolean>() // true = correct, false = misspelled
  private provider: SpellcheckProvider | null = null
  private listeners = new Set<() => void>()

  public init(initialCustomWords: string[] = [], initialLangs: string[] = ['ru-RU', 'en-US'], enabled: boolean = true) {
    this.setCustomWords(initialCustomWords)
    this.setLanguages(initialLangs)
    this.setEnabled(enabled)
  }

  public setProvider(provider: SpellcheckProvider | null) {
    this.provider = provider
    this.wordCache.clear()
    this.notify()
  }

  public getProvider(): SpellcheckProvider | null {
    return this.provider
  }

  public setEnabled(enabled: boolean) {
    this.isEnabled = enabled
    this.wordCache.clear()
    this.notify()
  }

  public getEnabled(): boolean {
    return this.isEnabled
  }

  public setLanguages(langs: string[]) {
    this.enabledLanguages = new Set(langs)
    this.wordCache.clear()
    this.notify()
  }

  public getLanguages(): string[] {
    return Array.from(this.enabledLanguages)
  }

  public setCustomWords(words: string[]) {
    this.customWords.clear()
    this.wordCache.clear()
    for (const w of words) {
      const clean = w.trim().toLowerCase()
      if (clean) {
        this.customWords.add(clean)
      }
    }
    this.notify()
  }

  public addCustomWord(word: string) {
    const clean = word.trim().toLowerCase()
    if (!clean) return
    this.customWords.add(clean)
    this.wordCache.set(clean, true)
    this.notify()
  }

  public removeCustomWord(word: string) {
    const clean = word.trim().toLowerCase()
    if (!clean) return
    this.customWords.delete(clean)
    this.wordCache.clear()
    this.notify()
  }

  private isIgnoredWord(rawWord: string): boolean {
    const word = rawWord.trim()
    if (!word || word.length <= 1) return true
    if (this.customWords.has(word.toLowerCase())) return true

    // 1. Числа, спецсимволы, пути файлов, переменные и разметка
    if (/\d/.test(word) || /[._/\\:@#%&*~^|<>=+$]/.test(word)) return true
    if (/^[\d_#*`~+\-=\\/$@%^&()\[\]{}|<>]+$/.test(word)) return true

    // 2. Акронимы и аббревиатуры из заглавных букв (API, JSON, HTTP, URL, CSS, HTML, UI, UX, TS, JS, ID, AI, IT, PDF, SQL)
    if (/^[\p{Lu}]{2,}$/u.test(word)) return true

    // 3. Верблюжий регистр / идентификаторы (TypeScript, JavaScript, GitHub, VSCode, KaTeX, OpenAI, MarkdownEditor)
    if (/[a-z][A-Z]/.test(word) || /[а-яА-Яa-zA-Z][A-Z]/.test(word)) return true

    return false
  }

  public isWordMisspelledCached(rawWord: string): boolean | undefined {
    if (!this.isEnabled) return false
    if (this.isIgnoredWord(rawWord)) return false

    const clean = rawWord.trim().toLowerCase()
    const cached = this.wordCache.get(clean)
    if (cached !== undefined) {
      return !cached // cached is true if correct, false if misspelled
    }
    return undefined
  }

  public async isWordMisspelled(rawWord: string): Promise<boolean> {
    if (!this.isEnabled) return false
    if (this.isIgnoredWord(rawWord)) return false

    const clean = rawWord.trim().toLowerCase()
    const cached = this.wordCache.get(clean)
    if (cached !== undefined) {
      return !cached
    }

    if (this.provider?.isWordMisspelled) {
      try {
        const misspelled = await this.provider.isWordMisspelled(rawWord.trim())
        this.wordCache.set(clean, !misspelled)
        return misspelled
      } catch {
        return false
      }
    }

    return false
  }

  public async getWordSuggestions(rawWord: string): Promise<string[]> {
    if (!this.isEnabled) return []
    const clean = rawWord.trim().toLowerCase()
    if (!clean) return []

    if (this.provider?.getWordSuggestions) {
      try {
        return await this.provider.getWordSuggestions(rawWord.trim())
      } catch {
        return []
      }
    }
    return []
  }

  public async checkWords(words: string[]): Promise<string[]> {
    if (!this.isEnabled || words.length === 0) return []
    const toCheck: string[] = []
    const misspelled: string[] = []

    for (const raw of words) {
      if (this.isIgnoredWord(raw)) continue
      const clean = raw.trim().toLowerCase()

      const cached = this.wordCache.get(clean)
      if (cached !== undefined) {
        if (!cached) misspelled.push(clean)
      } else {
        toCheck.push(raw.trim())
      }
    }

    if (toCheck.length > 0 && this.provider?.checkWords) {
      try {
        const unique = Array.from(new Set(toCheck))
        const foundMisspelled = await this.provider.checkWords(unique)
        const misspelledSet = new Set(foundMisspelled.map((w) => w.toLowerCase()))
        for (const w of unique) {
          const lower = w.toLowerCase()
          const isErr = misspelledSet.has(lower)
          this.wordCache.set(lower, !isErr)
          if (isErr) misspelled.push(lower)
        }
      } catch {
        // ignore
      }
    }

    return misspelled
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private notify() {
    this.listeners.forEach((l) => l())
  }
}

export const spellcheckService = new SpellcheckService()
