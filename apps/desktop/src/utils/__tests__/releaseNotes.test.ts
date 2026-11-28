import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readReleaseNotes } from '../releaseNotes.ts'

test('reads optional plain-text release notes from the update manifest', () => {
  assert.equal(readReleaseNotes(undefined), undefined)
  assert.equal(readReleaseNotes('Old format'), undefined)
  assert.equal(readReleaseNotes([null, ' ']), undefined)
  assert.deepEqual(
    readReleaseNotes([false, '  Исправили поиск  ', '<b>Plain text</b>']),
    ['Исправили поиск', '<b>Plain text</b>'],
  )
})

test('limits release notes without splitting Unicode characters', () => {
  const longNote = '📝'.repeat(251)
  const notes = readReleaseNotes(Array(12).fill(longNote))
  assert.equal(notes?.length, 8)
  assert.equal(notes?.[0], '📝'.repeat(249) + '…')
})
