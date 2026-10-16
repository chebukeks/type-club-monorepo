import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import {
  MODERN_WORDS,
  RUSSIAN_PRODUCTIVE_PREFIXES,
  RUSSIAN_NOUN_SUFFIXES,
} from '../../../electron/modernWords.ts'

describe('Desktop Security & Spellcheck Dictionary', () => {
  describe('Path Traversal Guard Logic', () => {
    // Simulating Path Guard from main.ts
    const allowedRoots = new Set<string>([
      'c:\\users\\test\\documents',
      'c:\\projects\\my-workspace',
    ])

    function isPathAllowed(filePath: string): boolean {
      if (!filePath) return false
      try {
        const resolved = path.resolve(filePath).toLowerCase()
        for (const root of allowedRoots) {
          if (resolved.startsWith(root)) return true
        }
        return false
      } catch {
        return false
      }
    }

    function assertPathAllowed(filePath: string): void {
      if (!isPathAllowed(filePath)) {
        throw new Error(`[SECURITY] Access denied: path outside allowed directories (${filePath})`)
      }
    }

    it('should allow legitimate files inside allowed roots', () => {
      assert.equal(isPathAllowed('c:\\projects\\my-workspace\\notes.md'), true)
      assert.equal(isPathAllowed('c:\\projects\\my-workspace\\subfolder\\doc.md'), true)
      assert.equal(isPathAllowed('c:\\users\\test\\documents\\file.md'), true)
      assert.doesNotThrow(() => assertPathAllowed('c:\\projects\\my-workspace\\notes.md'))
    })

    it('should deny paths attempting directory traversal (../)', () => {
      assert.equal(isPathAllowed('c:\\projects\\my-workspace\\..\\..\\windows\\system32'), false)
      assert.equal(isPathAllowed('c:\\projects\\other-folder\\secret.txt'), false)
      assert.throws(() => assertPathAllowed('c:\\projects\\my-workspace\\..\\secret.env'), {
        message: /\[SECURITY\] Access denied/,
      })
    })

    it('should deny null, empty or undefined paths', () => {
      assert.equal(isPathAllowed(''), false)
      assert.equal(isPathAllowed(null as unknown as string), false)
      assert.equal(isPathAllowed(undefined as unknown as string), false)
    })
  })

  describe('Modern Words & Spellcheck Rules', () => {
    it('should contain essential modern development & UI vocabulary', () => {
      const set = new Set(MODERN_WORDS)
      assert.ok(set.has('десктоп'))
      assert.ok(set.has('монорепозиторий'))
      assert.ok(set.has('бэкенд'))
      assert.ok(set.has('фронтенд'))
      assert.ok(set.has('скроллбар'))
      assert.ok(set.has('чекбокс'))
      assert.ok(set.has('модалка'))
      assert.ok(set.has('репозиторий'))
    })

    it('should have Russian productive prefixes configured', () => {
      assert.ok(RUSSIAN_PRODUCTIVE_PREFIXES.length > 0)
      assert.ok(RUSSIAN_PRODUCTIVE_PREFIXES.includes('нейро'))
      assert.ok(RUSSIAN_PRODUCTIVE_PREFIXES.includes('микро'))
      assert.ok(RUSSIAN_PRODUCTIVE_PREFIXES.includes('меж'))
    })

    it('should have Russian noun suffixes configured for adjective derivation', () => {
      assert.ok(RUSSIAN_NOUN_SUFFIXES.length > 0)
      const hasOst = RUSSIAN_NOUN_SUFFIXES.some(([s]) => s === 'ость')
      assert.ok(hasOst)
    })
  })
})
