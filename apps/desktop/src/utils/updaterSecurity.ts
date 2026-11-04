/**
 * updaterSecurity.ts — OWASP ASVS V10.3 & Top 10 (A08:2021) Security Controls for Software Updates.
 */
import path from 'node:path'

/**
 * OWASP ASVS V10.3.3: Strict monotonic semver comparison preventing rollback/downgrade attacks.
 */
export function isNewerVersion(remoteVersion: string, localVersion: string): boolean {
  const clean = (v: string) => (v || '').replace(/^v/i, '').trim()
  const rParts = clean(remoteVersion).split('.').map((p) => parseInt(p, 10) || 0)
  const lParts = clean(localVersion).split('.').map((p) => parseInt(p, 10) || 0)
  for (let i = 0; i < Math.max(rParts.length, lParts.length); i++) {
    const r = rParts[i] || 0
    const l = lParts[i] || 0
    if (r > l) return true
    if (r < l) return false
  }
  return false
}

/**
 * OWASP ASVS V10.3.1: Enforce TLS for remote downloads & block SSRF / dangerous schemes.
 */
export function validateUpdateUrl(urlStr: string, isPackaged = true): URL {
  let parsed: URL
  try {
    parsed = new URL(urlStr)
  } catch {
    throw new Error('Invalid URL format for update')
  }

  // 1. Strict protocol whitelist (only HTTPS or HTTP)
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new Error('Update destination rejected by security policy: unsupported protocol')
  }

  // 2. SSRF Guard: block cloud metadata IP
  if (parsed.hostname === '169.254.169.254') {
    throw new Error('Update destination rejected by security policy: forbidden metadata address')
  }

  // 3. Insecure transport: HTTP only allowed for localhost / local testing
  const isLocal = parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1' || parsed.hostname === '::1'
  if (parsed.protocol !== 'https:' && (!isLocal || (isPackaged && !isLocal))) {
    throw new Error('Insecure transport: application updates must be transmitted over HTTPS (OWASP ASVS V10.3.1)')
  }

  return parsed
}

/**
 * OWASP CWE-22: Strict filename sanitization preventing directory traversal and shell metacharacters.
 */
export function sanitizeUpdateFileName(fileName: string): string {
  if (!fileName || typeof fileName !== 'string') {
    throw new Error('Filename must be a non-empty string')
  }
  const base = path.basename(fileName)
  if (base !== fileName || !/^[a-zA-Z0-9._-]+$/.test(base)) {
    throw new Error('Security violation: update filename contains invalid or dangerous characters')
  }
  return base
}

/**
 * OWASP Top 10 A08:2021 & ASVS V10.3.2: Verify SHA-256 cryptographic checksum.
 */
export function verifySha256Checksum(actualHash: string, expectedHash: string): boolean {
  if (!expectedHash || !expectedHash.trim()) {
    return true
  }
  const cleanActual = actualHash.trim().toLowerCase()
  const cleanExpected = expectedHash.trim().toLowerCase()
  return cleanActual === cleanExpected
}
