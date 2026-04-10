/**
 * seamlessPlugin.ts — Typora-стиль «seamless» редактирование
 *
 * Подход: используем ТОЛЬКО декорации (без NodeView, без прямых DOM изменений).
 * Это предотвращает бесконечные циклы обновлений.
 *
 * - Заголовки: добавляем widget-декорацию `# ` перед содержимым,
 *   видимую только когда курсор внутри заголовка
 * - Inline marks: добавляем widget-декорации `**` / `*` / `` ` ``
 *   по краям марки когда курсор внутри неё
 */
import { Plugin, PluginKey } from 'prosemirror-state'
import { Decoration, DecorationSet } from 'prosemirror-view'
import type { Node as PMNode } from 'prosemirror-model'
import { schema } from './schema'

const seamlessKey = new PluginKey('seamless')

/**
 * Единый seamless-плагин.
 * Использует plugin state для декораций — безопасно, без DOM мутаций.
 */
export const seamlessPlugin = new Plugin({
  key: seamlessKey,

  state: {
    init(_, state) {
      return buildDecorations(state)
    },

    apply(tr, oldDeco, _oldState, newState) {
      if (!tr.docChanged && !tr.selectionSet && _oldState.storedMarks === newState.storedMarks) return oldDeco
      return buildDecorations(newState)
    },
  },

  props: {
    decorations(state) {
      return seamlessKey.getState(state)
    },
  },
})

// ============================================================
// Построение декораций
// ============================================================

function buildDecorations(state: import('prosemirror-state').EditorState): DecorationSet {
  const doc = state.doc
  const cursorPos = state.selection.from
  const decorations: Decoration[] = []

  // --- Заголовки: добавляем класс, когда курсор внутри (для показа префикса) ---
  doc.descendants((node, pos) => {
    if (node.type === schema.nodes.heading) {
      const headingStart = pos
      const headingEnd = pos + node.nodeSize
      const cursorInside = cursorPos >= headingStart && cursorPos <= headingEnd

      if (cursorInside) {
        decorations.push(
          Decoration.node(pos, pos + node.nodeSize, { class: 'heading-cursor-inside' })
        )
      }

      return true // продолжаем обход внутрь
    }

    return true
  })

  // --- Inline marks: показываем синтаксис когда курсор внутри ---
  const $from = doc.resolve(cursorPos)
  const parent = $from.parent
  const parentStart = $from.start()

  // Проверяем марки в текущей позиции (приоритет у storedMarks)
  const activeMarks = state.storedMarks || $from.marks()

  for (const mark of activeMarks) {
    const syntax = getMarkSyntax(mark)
    if (!syntax) continue

    // Находим полный диапазон этой марки в parent
    const range = findMarkRange(parent, $from.parentOffset, mark.type, parentStart)
    
    if (range) {
      // Марка применена к существующему тексту.
      // Используем inline-декорации + CSS ::before / ::after вместо widget-декораций,
      // чтобы псевдоэлементы были частью того же inline-бокса и не переносились
      // на новую строку отдельно от текста.
      if (range.to - range.from === 1) {
        // Один символ — оба маркера на одном элементе
        decorations.push(
          Decoration.inline(range.from, range.to, {
            class: 'pm-mark-start pm-mark-end',
            'data-mark-open': syntax.open,
            'data-mark-close': syntax.close,
          })
        )
      } else {
        decorations.push(
          Decoration.inline(range.from, range.from + 1, {
            class: 'pm-mark-start',
            'data-mark-open': syntax.open,
          })
        )
        decorations.push(
          Decoration.inline(range.to - 1, range.to, {
            class: 'pm-mark-end',
            'data-mark-close': syntax.close,
          })
        )
      }
    } else if (state.selection.empty) {
      // Марка активна (storedMarks), но текста ещё нет — тут нужны widget-декорации
      decorations.push(
        Decoration.widget(cursorPos, () => {
          const span = document.createElement('span')
          span.className = 'pm-mark-syntax'
          span.textContent = syntax.open
          return span
        }, { side: -1, key: `mark-empty-open-${cursorPos}-${mark.type.name}` })
      )

      decorations.push(
        Decoration.widget(cursorPos, () => {
          const span = document.createElement('span')
          span.className = 'pm-mark-syntax'
          span.textContent = syntax.close
          return span
        }, { side: 1, key: `mark-empty-close-${cursorPos}-${mark.type.name}` })
      )
    }
  }

  return DecorationSet.create(doc, decorations)
}

// ============================================================
// Хелперы
// ============================================================

function getMarkSyntax(mark: import('prosemirror-model').Mark): { open: string, close: string } | null {
  switch (mark.type.name) {
    case 'strong': return { open: '**', close: '**' }
    case 'em': return { open: '*', close: '*' }
    case 'code': return { open: '`', close: '`' }
    case 's': return { open: '~~', close: '~~' }
    case 'highlight': return { open: '==', close: '==' }
    case 'spoiler': return { open: '||', close: '||' }
    case 'link': {
      const href = mark.attrs.href || ''
      const title = mark.attrs.title ? ` "${mark.attrs.title}"` : ''
      return { open: '[', close: `](${href}${title})` }
    }
    default: return null
  }
}

/** Найти полный диапазон марки в parent node */
function findMarkRange(
  parent: PMNode,
  cursorOffset: number,
  markType: any,
  parentPos: number
): { from: number; to: number } | null {
  const children: Array<{ offset: number; size: number; hasThisMark: boolean }> = []
  parent.forEach((child, offset) => {
    children.push({
      offset,
      size: child.nodeSize,
      hasThisMark: child.marks.some((m: any) => m.type === markType),
    })
  })

  // Находим ребёнка, содержащего курсор
  let currentIdx = -1
  for (let i = 0; i < children.length; i++) {
    const c = children[i]
    if (cursorOffset >= c.offset && cursorOffset <= c.offset + c.size) {
      currentIdx = i
      break
    }
  }

  if (currentIdx === -1 || !children[currentIdx].hasThisMark) return null

  // Расширяем диапазон
  let startIdx = currentIdx
  let endIdx = currentIdx

  while (startIdx > 0 && children[startIdx - 1].hasThisMark) startIdx--
  while (endIdx < children.length - 1 && children[endIdx + 1].hasThisMark) endIdx++

  return {
    from: parentPos + children[startIdx].offset,
    to: parentPos + children[endIdx].offset + children[endIdx].size,
  }
}
