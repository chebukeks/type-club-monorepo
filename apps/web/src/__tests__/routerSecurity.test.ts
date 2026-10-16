import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

describe('Web App Router & Navigation Security', () => {
  // Helper to validate internal navigation paths (protection against open-redirects / backslash bypasses)
  function isSafeInternalPath(targetPath: string): boolean {
    if (!targetPath || typeof targetPath !== 'string') return false
    // Deny protocol schemes (http:, https:, javascript:, data:, etc.)
    if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(targetPath)) return false
    // Deny protocol-relative URLs (//example.com)
    if (targetPath.startsWith('//')) return false
    // Deny backslash-based relative URLs (/\example.com or \\example.com) - CVE-2025-68470 bypass prevention
    if (targetPath.startsWith('/\\') || targetPath.startsWith('\\') || targetPath.includes('\\\\')) return false
    // Must start with '/' for internal routing
    return targetPath.startsWith('/')
  }

  it('should accept valid internal application routes', () => {
    assert.equal(isSafeInternalPath('/'), true)
    assert.equal(isSafeInternalPath('/login'), true)
    assert.equal(isSafeInternalPath('/articles/123'), true)
    assert.equal(isSafeInternalPath('/settings?tab=profile'), true)
    assert.equal(isSafeInternalPath('/editor?draft=1'), true)
  })

  it('should reject external scheme URLs attempting open redirect', () => {
    assert.equal(isSafeInternalPath('https://evil.com'), false)
    assert.equal(isSafeInternalPath('http://attacker.com/steal'), false)
    assert.equal(isSafeInternalPath('javascript:alert(1)'), false)
    assert.equal(isSafeInternalPath('data:text/html,evil'), false)
  })

  it('should reject protocol-relative URLs (//evil.com)', () => {
    assert.equal(isSafeInternalPath('//evil.com'), false)
    assert.equal(isSafeInternalPath('//google.com/phishing'), false)
  })

  it('should reject backslash bypass attempts (CVE-2025-68470)', () => {
    assert.equal(isSafeInternalPath('/\\evil.com'), false)
    assert.equal(isSafeInternalPath('\\evil.com'), false)
    assert.equal(isSafeInternalPath('/path\\\\evil.com'), false)
  })

  it('should reject non-string or empty path inputs', () => {
    assert.equal(isSafeInternalPath(''), false)
    assert.equal(isSafeInternalPath(null as unknown as string), false)
    assert.equal(isSafeInternalPath(undefined as unknown as string), false)
  })
})
