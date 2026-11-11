import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { EditorState, TextSelection } from 'prosemirror-state'
import { splitBlock } from 'prosemirror-commands'
import { parseMarkdown, serializeMarkdown } from '../editor/markdownConfig'
import {
  EXTERNAL_SYNC_META,
  createSyncTracker,
  recordEmittedMarkdown,
  resolveExternalContentSync,
} from '../editor/contentSync'

function findTextOffset(state: EditorState, needle: string, after = true): number {
  let found = -1
  state.doc.descendants((node, pos) => {
    if (node.isText && node.text && node.text.includes(needle)) {
      found = pos + node.text.indexOf(needle) + (after ? needle.length : 0)
      return false
    }
  })
  assert.notEqual(found, -1, `Expected to find "${needle}" in document`)
  return found
}

describe('Editor content sync & caret preservation', () => {
  const baseMarkdown = [
    '# Document Title',
    '',
    'Opening paragraph before the middle section.',
    '',
    'Middle paragraph line one.',
    '',
    'Following paragraph after middle.',
    '',
    'Bottom paragraph at the very end.',
  ].join('\n')

  it('ignores flushed echo after typing + Enter in the middle of a document', () => {
    const tracker = createSyncTracker(baseMarkdown)
    let state = EditorState.create({ doc: parseMarkdown(baseMarkdown) })

    // Place caret at the end of the middle paragraph, type 'a', press Enter twice
    // (producing a blank paragraph in the middle that does not round-trip identically).
    const middlePos = findTextOffset(state, 'Middle paragraph line one.')
    state = state.apply(state.tr.setSelection(TextSelection.create(state.doc, middlePos)))
    state = state.apply(state.tr.insertText('a'))
    splitBlock(state, (tr) => {
      state = state.apply(tr)
    })
    splitBlock(state, (tr) => {
      state = state.apply(tr)
    })

    const flushedMd = serializeMarkdown(state.doc)
    // Confirm the latent trap: reparsing drops the empty paragraph, so doc.eq differs.
    assert.equal(state.doc.eq(parseMarkdown(flushedMd)), false)

    const caretBeforeSync = state.selection.head
    const bottomText = 'Bottom paragraph at the very end.'
    const bottomEndPos = findTextOffset(state, bottomText)
    assert.ok(caretBeforeSync < bottomEndPos - bottomText.length)

    // Simulate synchronized flush (e.g. editor-flush-sync / debounced flush)
    // and user typing another char + Enter before React commits flushedMd.
    recordEmittedMarkdown(tracker, flushedMd, baseMarkdown)
    state = state.apply(state.tr.insertText('b'))
    splitBlock(state, (tr) => {
      state = state.apply(tr)
    })
    const caretAfterMoreTyping = state.selection.head

    const tr = resolveExternalContentSync({
      state,
      incomingContent: flushedMd,
      tracker,
      parseMarkdown,
      serializeMarkdown,
    })

    assert.equal(tr, null, 'Known local flush echo must not replace document')
    assert.equal(state.selection.head, caretAfterMoreTyping)
  })

  it('skips reparsing when incoming content matches serializeMarkdown(doc)', () => {
    //Simulate an untracked prop update with the exact serialized text of current doc
    const tracker = createSyncTracker('unrelated stale value')
    let state = EditorState.create({ doc: parseMarkdown(baseMarkdown) })

    const middlePos = findTextOffset(state, 'Middle paragraph line one.')
    state = state.apply(state.tr.setSelection(TextSelection.create(state.doc, middlePos)))
    state = state.apply(state.tr.insertText('x'))
    splitBlock(state, (tr) => {
      state = state.apply(tr)
    })
    splitBlock(state, (tr) => {
      state = state.apply(tr)
    })

    const currentSerialized = serializeMarkdown(state.doc)
    const caretBefore = state.selection.head

    const tr = resolveExternalContentSync({
      state,
      incomingContent: currentSerialized,
      tracker,
      parseMarkdown,
      serializeMarkdown,
    })

    assert.equal(tr, null)
    assert.equal(state.selection.head, caretBefore)
    assert.equal(tracker.lastEmitted, currentSerialized)
  })

  it('consumes multiple in-flight echoes in FIFO order even if React batches renders', () => {
    const tracker = createSyncTracker('alpha')
    const state = EditorState.create({ doc: parseMarkdown('alpha beta gamma') })

    recordEmittedMarkdown(tracker, 'alpha beta', 'alpha')
    recordEmittedMarkdown(tracker, 'alpha beta gamma', 'alpha')
    assert.deepEqual(tracker.pendingEchoes, ['alpha beta', 'alpha beta gamma'])

    // Stale first echo arrives while editor is already ahead
    assert.equal(
      resolveExternalContentSync({
        state,
        incomingContent: 'alpha beta',
        tracker,
        parseMarkdown,
        serializeMarkdown,
      }),
      null
    )
    assert.deepEqual(tracker.pendingEchoes, ['alpha beta gamma'])

    // Second echo arrives and clears queue
    assert.equal(
      resolveExternalContentSync({
        state,
        incomingContent: 'alpha beta gamma',
        tracker,
        parseMarkdown,
        serializeMarkdown,
      }),
      null
    )
    assert.deepEqual(tracker.pendingEchoes, [])

    // Skipped intermediate commit when React batches directly to latest echo
    recordEmittedMarkdown(tracker, 'step 1', 'alpha beta gamma')
    recordEmittedMarkdown(tracker, 'step 2', 'alpha beta gamma')
    assert.equal(
      resolveExternalContentSync({
        state: EditorState.create({ doc: parseMarkdown('step 2') }),
        incomingContent: 'step 2',
        tracker,
        parseMarkdown,
        serializeMarkdown,
      }),
      null
    )
    assert.deepEqual(tracker.pendingEchoes, [])
  })

  it('does not leave zombie echoes when emitting content equal to current prop', () => {
    const tracker = createSyncTracker('Initial')
    recordEmittedMarkdown(tracker, 'Initial', 'Initial')
    assert.deepEqual(tracker.pendingEchoes, [])

    const state = EditorState.create({ doc: parseMarkdown('Initial') })
    const externalTr = resolveExternalContentSync({
      state,
      incomingContent: 'Updated externally',
      tracker,
      parseMarkdown,
      serializeMarkdown,
    })
    assert.ok(externalTr)

    // Reverting back externally to "Initial" should apply cleanly
    const revertedState = state.apply(externalTr)
    const revertTr = resolveExternalContentSync({
      state: revertedState,
      incomingContent: 'Initial',
      tracker,
      parseMarkdown,
      serializeMarkdown,
    })
    assert.ok(revertTr)
  })

  it('preserves clamped caret position on genuine external edits instead of jumping to bottom', () => {
    const tracker = createSyncTracker(baseMarkdown)
    let state = EditorState.create({ doc: parseMarkdown(baseMarkdown) })

    const middlePos = findTextOffset(state, 'Middle paragraph', true)
    state = state.apply(state.tr.setSelection(TextSelection.create(state.doc, middlePos)))

    const updatedMarkdown = baseMarkdown.replace(
      'Opening paragraph before the middle section.',
      'Opening paragraph edited externally.'
    )

    const tr = resolveExternalContentSync({
      state,
      incomingContent: updatedMarkdown,
      tracker,
      parseMarkdown,
      serializeMarkdown,
    })

    assert.ok(tr, 'Genuine external edit should produce a transaction')
    assert.equal(tr.getMeta(EXTERNAL_SYNC_META), true)

    const nextState = state.apply(tr)
    const bottomText = 'Bottom paragraph at the very end.'
    const bottomEnd = findTextOffset(nextState, bottomText)
    assert.ok(
      nextState.selection.head < bottomEnd - bottomText.length,
      `Selection (${nextState.selection.head}) should remain near middle instead of jumping to bottom (${bottomEnd})`
    )

    // Shrunk external document and range selection must clamp safely
    const rangeEnd = findTextOffset(nextState, 'Following paragraph', true)
    const rangedState = nextState.apply(
      nextState.tr.setSelection(TextSelection.create(nextState.doc, middlePos, rangeEnd))
    )
    const shrunkTr = resolveExternalContentSync({
      state: rangedState,
      incomingContent: '',
      tracker,
      parseMarkdown,
      serializeMarkdown,
    })
    assert.ok(shrunkTr)
    const emptyState = rangedState.apply(shrunkTr)
    assert.equal(emptyState.selection.head, 1)
  })
})
