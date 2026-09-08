import { Node as PMNode } from 'prosemirror-model'
import { EditorView, NodeView } from 'prosemirror-view'
import { TextSelection } from 'prosemirror-state'
import { suggestionPluginKey } from './suggestionPlugin'

let mermaidModulePromise: Promise<any> | null = null

function getMermaid() {
  if (!mermaidModulePromise) {
    mermaidModulePromise = import('mermaid').then((m) => {
      const mod = m.default || m
      mod.initialize({
        startOnLoad: false,
        securityLevel: 'loose',
      })
      return mod
    }).catch((err) => {
      console.error('Failed to load mermaid:', err)
      mermaidModulePromise = null
      throw err
    })
  }
  return mermaidModulePromise
}

/**
 * Кастомный View для блока кода (code_block).
 * Оборачивает содержимое в UI-компонент:
 * - шапка с кликабельным языком и кнопкой копирования;
 * - контейнер для кода;
 * - поддержка рендера Mermaid-диаграмм при params === 'mermaid'.
 */
export class CodeBlockView implements NodeView {
  dom: HTMLElement
  contentDOM: HTMLElement
  node: PMNode
  view: EditorView
  getPos: () => number | undefined

  private preElement: HTMLElement
  private langBtn: HTMLButtonElement
  private langTextSpan: HTMLElement
  private arrowSvg: SVGElement
  private headerLeft: HTMLElement
  private tabsContainer: HTMLElement | null = null
  private mermaidContainer: HTMLElement | null = null
  private mermaidError: HTMLElement | null = null
  private activeTab: 'diagram' | 'code' = 'diagram'
  private renderDebounceTimer: ReturnType<typeof setTimeout> | null = null
  private renderCounter = 0

  constructor(node: PMNode, view: EditorView, getPos: () => number | undefined) {
    this.node = node
    this.view = view
    this.getPos = getPos

    // Внешняя обертка блока
    this.dom = document.createElement('div')
    this.dom.className = 'code-block-wrapper'

    // Шапка (Header)
    const header = document.createElement('div')
    header.className = 'code-block-header'

    this.headerLeft = document.createElement('div')
    this.headerLeft.className = 'code-block-header-left'

    // Бейдж языка (интерактивный только в seamless редактировании)
    this.langBtn = document.createElement('button')
    this.langBtn.type = 'button'
    this.langBtn.className = 'code-block-lang'

    this.langTextSpan = document.createElement('span')
    this.langTextSpan.textContent = node.attrs.params || 'text'

    this.arrowSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    this.arrowSvg.setAttribute('width', '10')
    this.arrowSvg.setAttribute('height', '10')
    this.arrowSvg.setAttribute('viewBox', '0 0 12 12')
    this.arrowSvg.setAttribute('fill', 'currentColor')
    this.arrowSvg.style.opacity = '0.7'
    this.arrowSvg.style.flexShrink = '0'
    this.arrowSvg.innerHTML = '<path d="M2 4l4 4 4-4z"/>'

    this.langBtn.appendChild(this.langTextSpan)
    this.langBtn.appendChild(this.arrowSvg)

    this.updateLangBadgeState()

    this.langBtn.addEventListener('click', (e) => {
      e.preventDefault()
      e.stopPropagation()
      if (!this.isSeamlessEditable()) return
      const pos = this.getPos()
      if (pos !== undefined) {
        const rect = this.langBtn.getBoundingClientRect()
        this.view.dom.dispatchEvent(
          new CustomEvent('editor-change-code-block-lang', {
            bubbles: true,
            detail: {
              pos,
              currentLang: this.node.attrs.params || '',
              rect,
              node: this.node,
            },
          })
        )
      }
    })

    this.headerLeft.appendChild(this.langBtn)

    const copyBtn = document.createElement('button')
    copyBtn.type = 'button'
    copyBtn.className = 'code-block-copy'
    copyBtn.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="copy-icon">
        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
      </svg>
    `
    copyBtn.addEventListener('click', (e) => {
      e.preventDefault()
      navigator.clipboard.writeText(this.node.textContent).then(() => {
        const originalHtml = copyBtn.innerHTML
        copyBtn.innerHTML = '<span class="copied-text">Copied!</span>'
        setTimeout(() => (copyBtn.innerHTML = originalHtml), 2000)
      })
    })

    header.contentEditable = 'false'
    header.appendChild(this.headerLeft)
    header.appendChild(copyBtn)

    // Контейнер для текста кода
    this.preElement = document.createElement('pre')
    this.contentDOM = document.createElement('code')
    this.contentDOM.className = 'code-block-content'
    if (suggestionPluginKey.getState(this.view.state)?.active) {
      this.contentDOM.contentEditable = 'false'
    }

    this.preElement.appendChild(this.contentDOM)
    this.dom.appendChild(header)
    this.dom.appendChild(this.preElement)

    // Инициализация Mermaid при необходимости
    if (this.isMermaid()) {
      this.setupMermaidUI()
    }
  }

  private isSeamlessEditable(): boolean {
    if (!this.view.editable) return false
    if (this.view.dom.classList.contains('preview-mode') || this.view.dom.closest('.preview-mode')) return false
    const isSuggestionActive = suggestionPluginKey.getState(this.view.state)?.active
    if (isSuggestionActive) return false
    return true
  }

  private updateLangBadgeState() {
    const isEditable = this.isSeamlessEditable()
    if (isEditable) {
      this.langBtn.classList.add('interactive')
      this.langBtn.title = 'Click to change language'
      this.arrowSvg.style.display = ''
    } else {
      this.langBtn.classList.remove('interactive')
      this.langBtn.removeAttribute('title')
      this.arrowSvg.style.display = 'none'
    }
  }

  private isMermaid(): boolean {
    return this.node.attrs.params === 'mermaid'
  }

  private isPreview(): boolean {
    return (
      this.view.dom.closest('.preview-mode') !== null ||
      !this.view.editable
    )
  }

  private setupMermaidUI() {
    if (!this.mermaidContainer) {
      this.mermaidContainer = document.createElement('div')
      this.mermaidContainer.className = 'mermaid-render-wrapper'
      this.mermaidContainer.contentEditable = 'false'

      this.mermaidContainer.addEventListener('click', () => {
        if (!this.isPreview()) {
          this.switchTab('code')
          const pos = this.getPos()
          if (pos !== undefined) {
            const tr = this.view.state.tr.setSelection(
              TextSelection.near(this.view.state.doc.resolve(pos + 1))
            )
            this.view.dispatch(tr)
            this.view.focus()
          }
        }
      })

      this.mermaidError = document.createElement('div')
      this.mermaidError.className = 'mermaid-error'
      this.mermaidError.style.display = 'none'
      this.mermaidError.contentEditable = 'false'

      this.dom.appendChild(this.mermaidContainer)
      this.dom.appendChild(this.mermaidError)
    }

    if (!this.tabsContainer && !this.isPreview()) {
      this.tabsContainer = document.createElement('div')
      this.tabsContainer.className = 'code-block-tabs'

      const diagramTab = document.createElement('button')
      diagramTab.type = 'button'
      diagramTab.className = `code-block-tab-btn ${this.activeTab === 'diagram' ? 'active' : ''}`
      diagramTab.textContent = 'Диаграмма'
      diagramTab.addEventListener('click', (e) => {
        e.preventDefault()
        this.switchTab('diagram')
      })

      const codeTab = document.createElement('button')
      codeTab.type = 'button'
      codeTab.className = `code-block-tab-btn ${this.activeTab === 'code' ? 'active' : ''}`
      codeTab.textContent = 'Код'
      codeTab.addEventListener('click', (e) => {
        e.preventDefault()
        this.switchTab('code')
      })

      this.tabsContainer.appendChild(diagramTab)
      this.tabsContainer.appendChild(codeTab)
      this.headerLeft.appendChild(this.tabsContainer)
    }

    if (this.isPreview()) {
      this.activeTab = 'diagram'
      this.preElement.style.display = 'none'
      this.mermaidContainer.style.display = 'flex'
    } else {
      this.updateViewMode()
    }

    this.scheduleRenderMermaid()
  }

  private switchTab(tab: 'diagram' | 'code') {
    this.activeTab = tab
    if (this.tabsContainer) {
      const btns = this.tabsContainer.querySelectorAll<HTMLButtonElement>('.code-block-tab-btn')
      btns.forEach((btn, idx) => {
        btn.classList.toggle('active', (idx === 0 && tab === 'diagram') || (idx === 1 && tab === 'code'))
      })
    }
    this.updateViewMode()
    if (tab === 'diagram') {
      this.scheduleRenderMermaid()
    }
  }

  private updateViewMode() {
    if (!this.isMermaid()) {
      this.preElement.style.display = 'block'
      if (this.mermaidContainer) this.mermaidContainer.style.display = 'none'
      if (this.mermaidError) this.mermaidError.style.display = 'none'
      if (this.tabsContainer) this.tabsContainer.style.display = 'none'
      return
    }

    if (this.tabsContainer) {
      this.tabsContainer.style.display = this.isPreview() ? 'none' : 'inline-flex'
    }

    if (this.activeTab === 'diagram') {
      this.preElement.style.display = 'none'
      if (this.mermaidContainer) this.mermaidContainer.style.display = 'flex'
    } else {
      this.preElement.style.display = 'block'
      if (this.mermaidContainer) this.mermaidContainer.style.display = 'none'
    }
  }

  private scheduleRenderMermaid() {
    if (!this.isMermaid() || !this.mermaidContainer) return
    if (this.renderDebounceTimer) clearTimeout(this.renderDebounceTimer)
    this.renderDebounceTimer = setTimeout(() => {
      this.renderMermaid()
    }, 200)
  }

  private async renderMermaid() {
    if (!this.mermaidContainer) return
    const text = this.node.textContent.trim()
    if (!text) {
      this.mermaidContainer.innerHTML = '<span class="mermaid-empty">Диаграмма пуста</span>'
      if (this.mermaidError) this.mermaidError.style.display = 'none'
      return
    }

    const currentRender = ++this.renderCounter
    try {
      const mermaid = await getMermaid()
      if (currentRender !== this.renderCounter) return

      const isDark =
        document.documentElement.getAttribute('data-theme') === 'dark' ||
        document.documentElement.classList.contains('dark')

      mermaid.initialize({
        startOnLoad: false,
        theme: isDark ? 'dark' : 'default',
        securityLevel: 'loose',
      })

      const uniqueId = `mermaid-${Math.random().toString(36).substring(2, 9)}`
      const { svg } = await mermaid.render(uniqueId, text)

      if (currentRender === this.renderCounter && this.mermaidContainer) {
        this.mermaidContainer.innerHTML = svg
        if (this.mermaidError) this.mermaidError.style.display = 'none'
      }
    } catch (err: any) {
      if (currentRender === this.renderCounter && this.mermaidError) {
        this.mermaidError.textContent = err?.message || 'Ошибка синтаксиса Mermaid'
        this.mermaidError.style.display = 'block'
      }
    }
  }

  update(node: PMNode): boolean {
    if (node.type !== this.node.type) return false
    const oldParams = this.node.attrs.params
    const oldText = this.node.textContent
    this.node = node

    // Обновляем текст языка
    if (this.langTextSpan) {
      this.langTextSpan.textContent = node.attrs.params || 'text'
    }
    this.updateLangBadgeState()

    if (suggestionPluginKey.getState(this.view.state)?.active) {
      this.contentDOM.contentEditable = 'false'
    } else {
      this.contentDOM.removeAttribute('contenteditable')
    }

    // Обработка перехода в/из mermaid
    if (node.attrs.params !== oldParams) {
      if (this.isMermaid()) {
        this.setupMermaidUI()
      } else {
        this.updateViewMode()
      }
    } else if (this.isMermaid() && node.textContent !== oldText) {
      this.scheduleRenderMermaid()
    }

    return true
  }

  ignoreMutation(mutation: any): boolean {
    // Игнорируем изменения, которые происходят в шапке (header) или контейнере диаграммы
    if (!this.contentDOM.contains(mutation.target)) {
      return true
    }
    return false
  }

  destroy() {
    if (this.renderDebounceTimer) {
      clearTimeout(this.renderDebounceTimer)
      this.renderDebounceTimer = null
    }
  }
}
