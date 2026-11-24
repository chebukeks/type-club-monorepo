import { describe, it } from 'node:test'
import assert from 'node:assert'
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { replaceAppImage } from '../../../electron/appImageUpdate.ts'
import {
  isNewerVersion,
  validateUpdateUrl,
  sanitizeUpdateFileName,
  verifySha256Checksum,
} from '../updaterSecurity.ts'

it('stages an AppImage before replacing the installed file', async (t) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'typeclub-update-test-'))
  const target = path.join(directory, 'Type Club.AppImage')
  const download = path.join(directory, 'download.AppImage')
  t.after(async () => {
    await fs.unlink(target)
    await fs.unlink(download).catch(() => {})
    await fs.rmdir(directory)
  })

  await fs.writeFile(target, 'old release')
  await assert.rejects(replaceAppImage(download, target), { code: 'ENOENT' })
  assert.strictEqual(await fs.readFile(target, 'utf8'), 'old release')
  assert.deepStrictEqual(await fs.readdir(directory), ['Type Club.AppImage'])

  await fs.writeFile(download, 'new release')
  await replaceAppImage(download, target)
  assert.strictEqual(await fs.readFile(target, 'utf8'), 'new release')
  assert.strictEqual(await fs.readFile(download, 'utf8'), 'new release')
  if (process.platform !== 'win32') assert.strictEqual((await fs.stat(target)).mode & 0o777, 0o755)
})

describe('OWASP ASVS V10.3 & Top 10 (A08:2021) — Software Updater Security', () => {
  describe('Downgrade & Rollback Attack Protection (ASVS V10.3.3)', () => {
    it('should allow valid monotonic version upgrades', () => {
      assert.strictEqual(isNewerVersion('0.9.9', '0.9.8'), true)
      assert.strictEqual(isNewerVersion('1.0.0', '0.9.8'), true)
      assert.strictEqual(isNewerVersion('0.10.0', '0.9.8'), true)
      assert.strictEqual(isNewerVersion('v0.9.9', 'v0.9.8'), true)
    })

    it('should reject rollback/downgrade to older versions', () => {
      assert.strictEqual(isNewerVersion('0.9.7', '0.9.8'), false)
      assert.strictEqual(isNewerVersion('0.8.9', '0.9.8'), false)
      assert.strictEqual(isNewerVersion('0.1.0', '1.0.0'), false)
    })

    it('should reject identical versions', () => {
      assert.strictEqual(isNewerVersion('0.9.8', '0.9.8'), false)
      assert.strictEqual(isNewerVersion('v1.0.0', '1.0.0'), false)
    })
  })

  describe('Secure Transport & SSRF Guard (ASVS V10.3.1)', () => {
    it('should accept HTTPS URLs for remote endpoints', () => {
      const url = validateUpdateUrl('https://type-club.ru/downloads/latest.json', true)
      assert.strictEqual(url.protocol, 'https:')
    })

    it('should reject unencrypted HTTP for packaged production remote downloads', () => {
      assert.throws(() => {
        validateUpdateUrl('http://insecure-mirror.com/downloads/latest.json', true)
      }, /Insecure transport/)
    })

    it('should allow HTTP for local testing on localhost and 127.0.0.1', () => {
      const local1 = validateUpdateUrl('http://localhost:8765/downloads/latest.json', false)
      assert.strictEqual(local1.hostname, 'localhost')

      const local2 = validateUpdateUrl('http://127.0.0.1:8765/downloads/latest.json', false)
      assert.strictEqual(local2.hostname, '127.0.0.1')
    })

    it('should reject dangerous URI schemes (file, gopher, javascript)', () => {
      assert.throws(() => {
        validateUpdateUrl('file:///etc/passwd', true)
      }, /rejected by security policy|Insecure transport/)

      assert.throws(() => {
        validateUpdateUrl('javascript:alert(1)', true)
      }, /rejected by security policy|Invalid URL format/)
    })

    it('should reject cloud metadata service IP (SSRF guard)', () => {
      assert.throws(() => {
        validateUpdateUrl('http://169.254.169.254/latest/meta-data', false)
      }, /rejected by security policy/)
    })
  })

  describe('Path Traversal & Command Injection Prevention (CWE-22, CWE-78)', () => {
    it('should accept legitimate platform release filenames', () => {
      assert.strictEqual(sanitizeUpdateFileName('TypeClub-Windows-0.9.9.exe'), 'TypeClub-Windows-0.9.9.exe')
      assert.strictEqual(sanitizeUpdateFileName('TypeClub-Windows-0.9.9.zip'), 'TypeClub-Windows-0.9.9.zip')
      assert.strictEqual(sanitizeUpdateFileName('TypeClub-Linux-0.9.9.AppImage'), 'TypeClub-Linux-0.9.9.AppImage')
      assert.strictEqual(sanitizeUpdateFileName('TypeClub-Mac-0.9.9.dmg'), 'TypeClub-Mac-0.9.9.dmg')
    })

    it('should reject path traversal in filenames (../, /)', () => {
      assert.throws(() => {
        sanitizeUpdateFileName('../../malicious.exe')
      }, /Security violation/)

      assert.throws(() => {
        sanitizeUpdateFileName('/etc/shadow')
      }, /Security violation/)

      assert.throws(() => {
        sanitizeUpdateFileName('..\\..\\malicious.exe')
      }, /Security violation/)
    })

    it('should reject shell injection and metacharacters', () => {
      assert.throws(() => {
        sanitizeUpdateFileName('update.exe;calc.exe')
      }, /Security violation/)

      assert.throws(() => {
        sanitizeUpdateFileName('update.exe & calc.exe')
      }, /Security violation/)

      assert.throws(() => {
        sanitizeUpdateFileName('test"$(whoami)"')
      }, /Security violation/)
    })
  })

  describe('Cryptographic Integrity & Checksum Verification (A08:2021 & ASVS V10.3.2)', () => {
    const validHash = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'

    it('should confirm matching SHA-256 hash (case-insensitive)', () => {
      assert.strictEqual(verifySha256Checksum(validHash, validHash), true)
      assert.strictEqual(verifySha256Checksum(validHash.toUpperCase(), validHash), true)
    })

    it('should reject tampered file hash mismatch', () => {
      const tamperedHash = 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff'
      assert.strictEqual(verifySha256Checksum(tamperedHash, validHash), false)
    })

    it('should gracefully allow updates without hash when manifest omits it', () => {
      assert.strictEqual(verifySha256Checksum(validHash, ''), true)
    })
  })
})
