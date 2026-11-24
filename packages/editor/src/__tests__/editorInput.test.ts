import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { EditorState, TextSelection, type Transaction } from 'prosemirror-state'
import type { EditorView } from 'prosemirror-view'
import { parseMarkdown } from '../editor/markdownConfig'
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
    dispatch(tr: Transaction) {
      view.state = view.state.apply(tr)
    },
  }
  return view as unknown as EditorView
}

function beforeInput(inputType: string, data: string | null = null) {
  return {
    inputType, data, cancelable: true, isComposing: false, defaultPrevented: false,
    preventDefault() { this.defaultPrevented = true },
  }
}

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
