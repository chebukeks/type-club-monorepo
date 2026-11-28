import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { EditorState, TextSelection, type Transaction } from 'prosemirror-state'
import type { EditorView } from 'prosemirror-view'
import { parseMarkdown, serializeMarkdown } from '../editor/markdownConfig'
import { getKeymapPlugins } from '../editor/keymap'
import { insertImageNode } from '../editor/imageInsert'
import { Doc } from 'yjs'
import { seedYFragmentFromMarkdown, setTaskState, yFragmentToMarkdown } from '../editor/collabSync'
import { visitTasks } from '../editor/taskIdentity'
import { pastePlugin } from '../editor/pastePlugin'
import { tableEditPlugin } from '../editor/tableEditPlugin'

const tableMarkdown = '| A | B |\n| --- | --- |\n| first | second |'
const url = 'https://example.com/article'

function editor(markdown: string, text?: string): EditorView {
  const doc = parseMarkdown(markdown)
  let pos = TextSelection.atStart(doc).from
  doc.descendants((node, offset) => {
    if (node.isText && node.text === text) pos = offset
  })
  const view = {
    state: EditorState.create({ doc, selection: TextSelection.create(doc, pos) }),
    editable: true,
    composing: false,
    focus() {},
    endOfTextblock() { return false },
    dispatch(tr: Transaction) {
      view.state = view.state.apply(tr)
    },
  }
  return view as unknown as EditorView
}

describe('Code block input', () => {
  function key(view: EditorView, character: string, shiftKey = false) {
    return getKeymapPlugins().some((keymap) =>
      keymap.props.handleKeyDown?.call(keymap, view, { key: character, shiftKey } as KeyboardEvent),
    )
  }

  it('keeps repeated Enter presses inside the block and preserves blank lines in Markdown', () => {
    const view = editor('```txt\ncode\n```')
    view.dispatch(view.state.tr.setSelection(TextSelection.atEnd(view.state.doc)))
    const keymap = getKeymapPlugins()[0]
    for (let i = 0; i < 3; i++) {
      assert.equal(keymap.props.handleKeyDown!.call(keymap, view, { key: 'Enter' } as KeyboardEvent), true)
    }
    assert.equal(view.state.doc.childCount, 1)
    assert.equal(view.state.selection.$head.parent.type.name, 'code_block')
    assert.equal(view.state.doc.firstChild!.textContent, 'code\n\n\n')
    assert.ok(parseMarkdown(serializeMarkdown(view.state.doc)).eq(view.state.doc))
  })

  it('indents Python after a colon and uses tabs for Go', () => {
    const python = editor('```python\nif ready:\n```')
    python.dispatch(python.state.tr.setSelection(TextSelection.atEnd(python.state.doc)))
    assert.equal(key(python, 'Enter'), true)
    assert.equal(python.state.doc.firstChild!.textContent, 'if ready:\n    ')
    assert.equal(key(python, 'Tab', true), true)
    assert.equal(python.state.doc.firstChild!.textContent, 'if ready:\n')

    const go = editor('```go\n```')
    assert.equal(key(go, 'Tab'), true)
    assert.equal(go.state.doc.firstChild!.textContent, '\t')
  })

  it('opens a pair, creates an indented line within it and removes an empty pair', () => {
    const view = editor('```js\n```')
    assert.equal(key(view, '{'), true)
    assert.equal(key(view, 'Enter'), true)
    assert.equal(view.state.doc.firstChild!.textContent, '{\n  \n}')
    assert.equal(key(view, '('), true)
    assert.equal(key(view, 'Backspace'), true)
    assert.equal(view.state.doc.firstChild!.textContent, '{\n  \n}')

    const end = editor('```js\nx\n```')
    end.dispatch(end.state.tr.setSelection(TextSelection.atEnd(end.state.doc)))
    assert.equal(key(end, 'Backspace'), false)
  })

  it('uses a longer fence when the code contains a Markdown fence', () => {
    const doc = parseMarkdown('````md\n```\nExample\n```\n````')
    assert.ok(parseMarkdown(serializeMarkdown(doc)).eq(doc))
  })
})

describe('Image insertion', () => {
  it('leaves the caption empty unless alt text is supplied', () => {
    const src = 'https://example.com/image.jpg'
    const view = editor('')
    insertImageNode(view, src)
    assert.equal(view.state.doc.firstChild!.attrs.alt, null)
    assert.ok(serializeMarkdown(view.state.doc).startsWith(`![](${src})`))

    insertImageNode(view, src, 'A view of the mountains')
    assert.equal(view.state.doc.child(1).attrs.alt, 'A view of the mountains')
  })
})

function beforeInput(inputType: string, data: string | null = null) {
  return {
    inputType, data, cancelable: true, isComposing: false, defaultPrevented: false,
    preventDefault() { this.defaultPrevented = true },
  }
}

it('saves an individual shared task in the CRDT without replacing other blocks', () => {
  const markdown = 'Introduction\n\n- [ ] Same\n  - [ ] Nested\n- [ ] Same\n\nConclusion'
  const doc = new Doc()
  try {
    const fragment = doc.getXmlFragment('content')
    seedYFragmentFromMarkdown(markdown, fragment)
    const textNode = fragment.get(0)
    const ids: string[] = []
    visitTasks(parseMarkdown(markdown), (_node, _pos, id) => ids.push(id))

    assert.equal(setTaskState(fragment, ids[2], true), true)
    assert.equal(setTaskState(fragment, ids[1], true), true)
    assert.equal(setTaskState(fragment, '0:0:0', true), false)
    assert.equal(fragment.get(0), textNode)
    const expected = 'Introduction\n\n- [ ] Same\n  - [x] Nested\n- [x] Same\n\nConclusion'
    assert.equal(yFragmentToMarkdown(fragment), serializeMarkdown(parseMarkdown(expected)))
  } finally {
    doc.destroy()
  }
})

describe('Table input', () => {
  const plugin = tableEditPlugin()
  const handle = plugin.props.handleDOMEvents!.beforeinput!.bind(plugin)

  it('moves a keyboard Enter to the next row, then appends a row and enters its first cell', () => {
    const view = editor(tableMarkdown, 'A')
    const paragraph = beforeInput('insertParagraph')
    assert.equal(handle(view, paragraph as InputEvent), true)
    assert.equal(paragraph.defaultPrevented, true)
    assert.equal(view.state.selection.$head.parent.textContent, 'first')

    const lineBreak = beforeInput('insertLineBreak')
    assert.equal(handle(view, lineBreak as InputEvent), true)
    assert.equal(lineBreak.defaultPrevented, true)
    const table = view.state.doc.firstChild!
    assert.equal(table.childCount, 3)
    assert.equal(table.child(1).firstChild!.childCount, 1)
    assert.equal(view.state.selection.$head.node(2), table.lastChild)
    assert.equal(view.state.selection.$head.node(3), table.lastChild!.firstChild)

    const newline = beforeInput('insertText', '\n')
    assert.equal(handle(view, newline as InputEvent), true)
    assert.equal(newline.defaultPrevented, true)
    assert.equal(view.state.doc.firstChild!.childCount, 4)
  })

  it('leaves paragraph Enter and IME composition to the normal input handlers', () => {
    const paragraph = beforeInput('insertParagraph')
    assert.equal(handle(editor('Text'), paragraph as InputEvent), false)
    assert.equal(paragraph.defaultPrevented, false)
    const composing = { ...beforeInput('insertParagraph'), isComposing: true }
    assert.equal(handle(editor(tableMarkdown, 'first'), composing as InputEvent), false)
  })
})

describe('Keyboard clipboard input', () => {
  const plugin = pastePlugin()
  const handle = plugin.props.handleDOMEvents!.beforeinput!.bind(plugin)

  it('linkifies an entire URL committed as text and embeds video on an empty line', () => {
    const view = editor('')
    const event = beforeInput('insertText', url)
    assert.equal(handle(view, event as InputEvent), true)
    assert.equal(event.defaultPrevented, true)
    assert.equal(view.state.doc.firstChild!.firstChild!.marks[0].attrs.href, url)

    const video = editor('')
    const videoUrl = 'https://youtu.be/abcdefghijk'
    assert.equal(handle(video, beforeInput('insertReplacementText', videoUrl) as InputEvent), true)
    assert.equal(video.state.doc.firstChild!.type.name, 'image')
    assert.equal(video.state.doc.firstChild!.attrs.src, videoUrl)
  })

  it('keeps regular suggestions and composition unchanged, and treats URLs in code as text', () => {
    const view = editor('Text')
    assert.equal(handle(view, beforeInput('insertReplacementText', 'word') as InputEvent), false)
    assert.equal(handle(view, { ...beforeInput('insertText', url), isComposing: true } as InputEvent), false)

    const code = editor('```txt\n```')
    assert.equal(handle(code, beforeInput('insertText', url) as InputEvent), true)
    assert.equal(code.state.doc.firstChild!.textContent, url)
    assert.equal(code.state.doc.firstChild!.firstChild!.marks.length, 0)
  })

  it('uses smart Markdown paste for a table committed as one keyboard input', () => {
    const view = editor('')
    assert.equal(handle(view, beforeInput('insertText', tableMarkdown) as InputEvent), true)
    assert.equal(view.state.doc.firstChild!.type.name, 'table')
    assert.equal(view.state.doc.firstChild!.childCount, 2)
  })

  it('uses the reported text range when only the DOM change reports a URL', () => {
    const view = editor('Label')
    assert.equal(plugin.props.handleTextInput!(view, 1, 6, url, () => view.state.tr), true)
    assert.equal(view.state.doc.textContent, 'Label')
    assert.equal(view.state.doc.firstChild!.firstChild!.marks[0].attrs.href, url)
  })
})
