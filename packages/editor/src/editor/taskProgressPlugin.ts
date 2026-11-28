import { Plugin, PluginKey } from 'prosemirror-state'
import { Decoration, DecorationSet } from 'prosemirror-view'
import { getTranslation } from '../i18n'
import { visitTasks } from './taskIdentity'

type TaskStates = Record<string, boolean>
const key = new PluginKey<TaskStates>('task-progress')

export function taskProgressPlugin(storageKey?: string, saveTask?: (id: string, checked: boolean) => Promise<void>) {
  return new Plugin<TaskStates>({
    key,
    state: {
      init() {
        if (!storageKey) return {}
        try {
          const saved = JSON.parse(localStorage.getItem(storageKey) ?? 'null')
          if (saved && typeof saved === 'object' && !Array.isArray(saved)) return saved
        } catch { /* Storage may be disabled. */ }
        return {}
      },
      apply(tr, tasks) {
        const change = tr.getMeta(key) as { taskId: string; checked: boolean } | undefined
        return change ? { ...tasks, [change.taskId]: change.checked } : tasks
      },
    },
    props: {
      decorations(state) {
        const tasks = key.getState(state) ?? {}
        const decorations: Decoration[] = []
        visitTasks(state.doc, (node, pos, taskId) => {
          const label = node.firstChild?.textContent.trim() ?? ''
          const checked = typeof tasks[taskId] === 'boolean' ? tasks[taskId] : node.attrs.checked
          decorations.push(Decoration.node(pos, pos + node.nodeSize, {
            class: 'reader-task',
            'data-reader-checked': String(checked),
          }))
          decorations.push(Decoration.widget(pos + 1, (view) => {
            const input = document.createElement('input')
            input.type = 'checkbox'
            input.className = 'reader-task-checkbox'
            input.checked = checked
            const locale = document.documentElement.lang === 'ru' ? 'ru' : 'en'
            input.setAttribute('aria-label', label || getTranslation(locale, 'publish.taskCheckbox'))
            input.addEventListener('change', async () => {
              const next = input.checked
              if (saveTask) {
                input.disabled = true
                try {
                  await saveTask(taskId, next)
                } catch {
                  input.checked = !next
                  return
                } finally {
                  input.disabled = false
                }
              }
              if (view.isDestroyed) return
              view.dispatch(view.state.tr.setMeta(key, { taskId, checked: next }))
              if (storageKey) {
                try {
                  localStorage.setItem(storageKey, JSON.stringify(key.getState(view.state)))
                } catch { /* Changes remain available for the current page. */ }
              }
            })
            return input
          }, { key: taskId, stopEvent: () => true }))
        })
        return DecorationSet.create(state.doc, decorations)
      },
    },
  })
}
