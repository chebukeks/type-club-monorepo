const ruledPaperAttribute = 'data-theme-ruled-paper'

export function observeRuledPaper(editor: HTMLElement): () => void {
  const root = document.documentElement
  let unmount: (() => void) | undefined
  const update = () => {
    if (root.hasAttribute(ruledPaperAttribute)) {
      unmount ??= mountNotebookRuling(editor)
    } else {
      unmount?.()
      unmount = undefined
    }
  }
  const observer = new MutationObserver(update)
  observer.observe(root, { attributes: true, attributeFilter: [ruledPaperAttribute] })
  update()
  return () => {
    observer.disconnect()
    unmount?.()
  }
}

function mountNotebookRuling(editor: HTMLElement): () => void {
  const sample = document.createElement('div')
  sample.style.cssText = 'position:absolute; visibility:hidden; white-space:nowrap; padding:0'
  const marker = document.createElement('span')
  marker.style.cssText = 'display:inline-block; width:0; height:0; vertical-align:baseline'
  sample.append('Аg', marker)
  document.body.append(sample)

  // Lay out the blocks on a single grid without modifying ProseMirror's document DOM.
  const alignment = document.createElement('style')
  document.head.append(alignment)
  const scope = `[${ruledPaperAttribute}] .theme-editor-background .ProseMirror`
  const measure = () => {
    if (!editor.isConnected) return
    alignment.textContent = ''
    const style = getComputedStyle(editor)
    const rowHeight = parseFloat(style.lineHeight)
    if (!rowHeight) return
    const bodySize = parseFloat(style.fontSize)
    const fontBaselines = new Map<string, number>()
    const firstBaseline = (textStyle: CSSStyleDeclaration) => {
      const font = `${textStyle.fontStyle} ${textStyle.fontWeight} ${textStyle.fontSize}/${textStyle.lineHeight} ${textStyle.fontFamily}`
      const cached = fontBaselines.get(font)
      if (cached !== undefined) return cached
      sample.style.font = font
      const baseline = marker.getBoundingClientRect().top - sample.getBoundingClientRect().top
      fontBaselines.set(font, baseline)
      return baseline
    }

    editor.style.setProperty('--notebook-row-height', `${rowHeight}px`)
    const baseline = firstBaseline(style) + parseFloat(style.paddingTop)
    editor.style.setProperty('--notebook-baseline', `${baseline}px`)
    const top = editor.getBoundingClientRect().top
    const rules: string[] = []
    let addedPadding = 0

    const align = (text: Element, block: Element, selector: string) => {
      if (text.getClientRects().length === 0) return
      const textStyle = getComputedStyle(text)
      const offset = text.getBoundingClientRect().top - top + parseFloat(textStyle.paddingTop)
      const extraClearance = Math.max(0, (parseFloat(textStyle.fontSize) - bodySize) * 0.25)
      const position = offset + firstBaseline(textStyle) + addedPadding + extraClearance
      const row = Math.ceil((position - baseline - 0.5) / rowHeight)
      const padding = Math.max(0, baseline + row * rowHeight - position)
      if (padding < 0.5) return
      addedPadding += padding
      const originalPadding = parseFloat(getComputedStyle(block).paddingTop)
      const taskOffset = block.matches('.task-list-item') ? `--notebook-task-offset: ${padding}px;` : ''
      rules.push(`${selector} {
        padding-top: ${originalPadding + padding}px;
        ${taskOffset}
      }`)
    }

    const visit = (parent: Element, parentSelector: string) => {
      Array.from(parent.children).forEach((block, i) => {
        const selector = `${parentSelector} > :nth-child(${i + 1})`
        if (block.matches('ul, ol, li')) {
          visit(block, selector)
        } else if (block.matches('p, h1, h2, h3, h4, h5, h6')) {
          // Move the first block with its list marker or task checkbox.
          if (i === 0 && parent.matches('li')) align(block, parent, parentSelector)
          else align(block, block, selector)
        }
      })
    }
    visit(editor, scope)
    alignment.textContent = rules.join('\n')
  }

  let frame = 0
  const scheduleMeasure = () => {
    cancelAnimationFrame(frame)
    frame = requestAnimationFrame(measure)
  }
  measure()
  const resize = new ResizeObserver(scheduleMeasure)
  const observeBlocks = () => {
    resize.disconnect()
    resize.observe(editor)
    for (const block of editor.children) resize.observe(block)
  }
  observeBlocks()
  const mutations = new MutationObserver(() => {
    observeBlocks()
    scheduleMeasure()
  })
  mutations.observe(editor, { childList: true })
  const themeStyle = document.getElementById('typeclub-custom-theme-vars')
  if (themeStyle) mutations.observe(themeStyle, { childList: true })
  document.fonts.addEventListener('loadingdone', scheduleMeasure)
  return () => {
    resize.disconnect()
    mutations.disconnect()
    cancelAnimationFrame(frame)
    document.fonts.removeEventListener('loadingdone', scheduleMeasure)
    alignment.remove()
    sample.remove()
    editor.style.removeProperty('--notebook-baseline')
    editor.style.removeProperty('--notebook-row-height')
  }
}
