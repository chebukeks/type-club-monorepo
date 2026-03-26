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
      return buildDecorations(state.doc, state.selection.from)
    },

    apply(tr, oldDeco, _oldState, newState) {
      // Пересчитываем только при изменении документа или курсора
      if (!tr.docChanged && !tr.selectionSet) return oldDeco
      return buildDecorations(newState.doc, newState.selection.from)
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

function buildDecorations(doc: PMNode, cursorPos: number): DecorationSet {
  const decorations: Decoration[] = []

  // --- Заголовки: показываем `# ` когда курсор внутри ---
  doc.descendants((node, pos) => {
    if (node.type === schema.nodes.heading) {
      const headingStart = pos
      const headingEnd = pos + node.nodeSize
      const cursorInside = cursorPos >= headingStart && cursorPos <= headingEnd

      if (cursorInside) {
        // Добавляем widget с `# ` в начало содержимого заголовка
        const level = node.attrs.level as number
        const prefix = '#'.repeat(level) + ' '

        decorations.push(
          Decoration.widget(pos + 1, () => {
            const span = document.createElement('span')
            span.className = 'pm-heading-prefix'
            span.textContent = prefix
            span.contentEditable = 'false'
            return span
          }, { side: -1, key: `heading-prefix-${pos}` })
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

  // Проверяем марки в текущей позиции
  const activeMarks = $from.marks()

  for (const mark of activeMarks) {
    const syntax = getMarkSyntax(mark.type.name)
    if (!syntax) continue

    // Находим полный диапазон этой марки в parent
    const range = findMarkRange(parent, $from.parentOffset, mark.type, parentStart)
    if (!range) continue

    // Открывающий синтаксис
    decorations.push(
      Decoration.widget(range.from, () => {
        const span = document.createElement('span')
        span.className = 'pm-mark-syntax'
        span.textContent = syntax
        return span
      }, { side: -1, key: `mark-open-${range.from}-${mark.type.name}` })
    )

    // Закрывающий синтаксис
    decorations.push(
      Decoration.widget(range.to, () => {
        const span = document.createElement('span')
        span.className = 'pm-mark-syntax'
        span.textContent = syntax
        return span
      }, { side: 1, key: `mark-close-${range.to}-${mark.type.name}` })
    )
  }

  return DecorationSet.create(doc, decorations)
}

// ============================================================
// Хелперы
// ============================================================

function getMarkSyntax(markName: string): string | null {
  switch (markName) {
    case 'strong': return '**'
    case 'em': return '*'
    case 'code': return '`'
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
