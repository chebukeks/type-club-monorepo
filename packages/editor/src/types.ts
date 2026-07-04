import type { EditorView } from 'prosemirror-view'
import type { Plugin } from 'prosemirror-state'
import type React from 'react'

export type EditorMode = 'raw' | 'seamless' | 'preview'

export type FocusMode = 'none' | 'paragraph' | 'sentence' | 'lines'

export interface TocItem {
  id: string
  text: string
  level: number
  pos: number
}

export interface EditorProps {
  content: string
  editorMode: EditorMode
  onChange: (markdown: string) => void
  textZoom?: number
  documentZoom?: number
  readOnly?: boolean
  onEditorView?: (view: EditorView) => void
  className?: string
  focusMode?: FocusMode
  onTocUpdate?: (toc: TocItem[]) => void
  extraPlugins?: Plugin[]
  containerStyle?: React.CSSProperties
}
