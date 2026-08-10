import type { EditorView } from 'prosemirror-view'
import type { Plugin } from 'prosemirror-state'
import type React from 'react'
import type { CollaborationConfig } from './editor/collaborationPlugin'

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
  collaboration?: CollaborationConfig
  userRole?: 'author' | 'co_author' | 'editor' | null
  userId?: number
  userNickname?: string
  suggestionModeActive?: boolean
  scrollTop?: number
  onScroll?: (scrollTop: number) => void
}

export type { CollaborationConfig }
