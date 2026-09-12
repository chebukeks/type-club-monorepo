import { Plugin, PluginKey } from 'prosemirror-state'

function openUrl(url: string) {
  const electronApi = (window as any).api
  if (electronApi?.openExternal) {
    electronApi.openExternal(url)
  } else {
    window.open(url, '_blank')
  }
}

/**
 * Плагин для перехвата и обработки кликов в редакторе.
 * - Чекбоксы (в seamless режиме)
 * - Ссылки (в preview или с Ctrl в seamless)
 * - Спойлеры (в preview)
 */
export const interactivePluginKey = new PluginKey('interactive')

export const interactivePlugin = new Plugin({
  key: interactivePluginKey,
  props: {
    handleDOMEvents: {
      click: (view, event) => {
        let targetNode = event.target as Node | null
        if (!targetNode) return false
        if (targetNode.nodeType === 3) targetNode = targetNode.parentElement
        const target = targetNode as HTMLElement | null
        if (!target) return false

        // Проверяем режим
        const isPreview = view.dom.closest('.preview-mode') !== null
        const isSeamless = !isPreview

        // 1. Спойлеры
        const spoiler = target.closest('.pm-spoiler') as HTMLElement
        if (spoiler) {
          if (isPreview) {
            event.preventDefault()
            spoiler.classList.toggle('is-revealed')
            return true
          }
        }

        // 2. Ссылки
        const link = target.closest('a')
        if (link) {
          const rawHref = link.getAttribute('href')
          if (rawHref && (isPreview || event.ctrlKey || event.metaKey)) {
            event.preventDefault()
            const isRelative = !/^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(rawHref) && !rawHref.startsWith('//') && !rawHref.startsWith('#')
            
            if (isRelative) {
              if ((window as any).api) { // desktop check
                view.dom.dispatchEvent(
                  new CustomEvent('editor-open-relative-link', {
                    bubbles: true,
                    detail: { href: rawHref },
                  })
                )
              }
              return true
            }

            let finalUrl = rawHref
            if (!/^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(finalUrl)) {
              finalUrl = `https://${finalUrl}`
            }
            openUrl(finalUrl)
            return true
          }
        }

        // 3. Чекбоксы
        const li = target.closest('li.task-list-item')
        if (li && isSeamless) {
          const rect = li.getBoundingClientRect()
          if (event.clientX < rect.left + 24) {
            event.preventDefault()
            const pos = view.posAtDOM(li, 0)
            const $pos = view.state.doc.resolve(pos)
            for (let i = $pos.depth; i > 0; i--) {
              const node = $pos.node(i)
              if (node.type.name === 'list_item' && node.attrs.checked !== null) {
                const nodePos = $pos.before(i)
                const tr = view.state.tr.setNodeMarkup(nodePos, null, {
                  ...node.attrs,
                  checked: !node.attrs.checked
                })
                view.dispatch(tr)
                return true
              }
            }
          }
        }
        return false
      }
    }
  }
})
