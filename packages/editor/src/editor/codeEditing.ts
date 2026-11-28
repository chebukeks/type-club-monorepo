import { TextSelection, type Command, type EditorState } from 'prosemirror-state'

const pairs: Record<string, string> = { '(': ')', '[': ']', '{': '}', '"': '"', "'": "'", '`': '`' }
const fourSpaces = new Set(['python', 'py', 'rust', 'rs', 'java', 'kotlin', 'csharp', 'cs', 'cpp', 'c', 'swift', 'php'])

function codeSelection(state: EditorState) {
  const { $from, $to } = state.selection
  if ($from.parent.type.name !== 'code_block' || !$from.sameParent($to)) return null
  const text = $from.parent.textContent
  const language = String($from.parent.attrs.params).trim().toLowerCase().split(/\s+/)[0]
  const indent = /(^|\n)\t/.test(text) || ['go', 'golang', 'make', 'makefile'].includes(language)
    ? '\t'
    : fourSpaces.has(language) ? '    ' : '  '
  return { text, language, indent, start: $from.start(), from: $from.parentOffset, to: $to.parentOffset }
}

export const enterInCode: Command = (state, dispatch) => {
  const code = codeSelection(state)
  if (!code) return false
  const { text, language, indent, from, to } = code
  const lineStart = from === 0 ? 0 : text.lastIndexOf('\n', from - 1) + 1
  const before = text.slice(lineStart, from)
  const leading = before.match(/^[\t ]*/)?.[0] ?? ''
  const lastChar = before.trimEnd().slice(-1)
  const opensBracket = lastChar === '(' || lastChar === '[' || lastChar === '{'
  const opensIndentedBlock =
    (['python', 'py', 'yaml', 'yml'].includes(language) && /:\s*(?:#.*)?$/.test(before)) ||
    (['bash', 'sh', 'zsh', 'shell'].includes(language) && /\b(?:then|do)\s*$/.test(before))
  const closesBracket = opensBracket && text[to] === pairs[lastChar]
  const newline = '\n' + leading + (opensBracket || opensIndentedBlock ? indent : '')
  if (dispatch) {
    const tr = state.tr.insertText(newline + (closesBracket ? '\n' + leading : ''))
    dispatch(tr.setSelection(TextSelection.create(tr.doc, state.selection.from + newline.length)).scrollIntoView())
  }
  return true
}

export function indentInCode(outdent = false): Command {
  return (state, dispatch) => {
    const code = codeSelection(state)
    if (!code) return false
    if (!dispatch) return true
    const { text, indent, start, from, to } = code
    const lineStart = from === 0 ? 0 : text.lastIndexOf('\n', from - 1) + 1
    if (!outdent && from === to) {
      const count = indent.length - (from - lineStart) % indent.length
      dispatch(state.tr.insertText(indent.slice(0, count)).scrollIntoView())
      return true
    }
    const tr = state.tr
    let offset = lineStart
    for (const line of text.slice(lineStart, to).split('\n')) {
      if (offset === to && from !== to) break
      const pos = tr.mapping.map(start + offset)
      const remove = line.startsWith('\t') ? 1 : Math.min(indent.length, line.match(/^ */)?.[0].length ?? 0)
      if (outdent) {
        if (remove) tr.delete(pos, pos + remove)
      } else {
        tr.insertText(indent, pos)
      }
      offset += line.length + 1
    }
    if (tr.docChanged) dispatch(tr.scrollIntoView())
    return true
  }
}

export function pairInCode(character: string): Command {
  return (state, dispatch) => {
    const code = codeSelection(state)
    if (!code) return false
    const { text, from, to, start } = code
    const closing = pairs[character]
    const next = text[to] ?? ''
    if (from === to && next === character && Object.values(pairs).includes(character)) {
      if (dispatch) dispatch(state.tr.setSelection(TextSelection.create(state.doc, start + to + 1)))
      return true
    }
    if (!closing || (from === to && next && !/[\s)\]},;:]/.test(next))) return false
    if (from === to && character === closing && /[\w\\]/.test(text[from - 1] ?? '')) return false
    if (dispatch) {
      const tr = state.tr.insertText(character + text.slice(from, to) + closing)
      dispatch(tr.setSelection(TextSelection.create(tr.doc, start + from + 1, start + to + 1)))
    }
    return true
  }
}

export const deleteCodePair: Command = (state, dispatch) => {
  const code = codeSelection(state)
  if (!code || code.from !== code.to || !code.from) return false
  const closing = pairs[code.text[code.from - 1]]
  if (!closing || closing !== code.text[code.from]) return false
  if (dispatch) dispatch(state.tr.delete(state.selection.from - 1, state.selection.to + 1))
  return true
}
