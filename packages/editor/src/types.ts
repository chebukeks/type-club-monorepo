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

export interface SuggestionItem {
  id: string
  type: 'insert' | 'delete' | 'note'
  authorName: string
  text: string
  pos: number
  toPos?: number
}

export interface EditorProps {
  content: string
  editorMode: EditorMode
  onChange: (markdown: string) => void
  textZoom?: number
  documentZoom?: number
  readOnly?: boolean
  nativeTextAssistance?: boolean
  onEditorView?: (view: EditorView) => void
  onRawTextarea?: (textarea: HTMLTextAreaElement | null) => void
  rawSearchMatch?: { from: number; to: number } | null
  interactiveTasks?: boolean
  taskProgressKey?: string
  onSaveTask?: (id: string, checked: boolean) => Promise<void>
  className?: string
  focusMode?: FocusMode
  onTocUpdate?: (toc: TocItem[], suggestions?: SuggestionItem[]) => void
  extraPlugins?: Plugin[]
  resolveImageSrc?: (src: string) => string
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
