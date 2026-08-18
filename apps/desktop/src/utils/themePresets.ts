import type { AppTheme, ThemeColors, ThemeTypography } from '../types'

export const DARK_COLORS: ThemeColors = {
  // Интерфейс
  bgBase: '#1a1b1e',
  bgSurface: '#1e1f22',
  bgElevated: '#252526',
  bgHover: '#2a2d33',
  bgActive: '#313238',
  bgInput: '#2a2b30',
  borderDefault: '#2d2e32',
  borderStrong: '#454545',
  textPrimary: '#e1e1e3',
  textSecondary: '#cccccc',
  textMuted: '#a0a4ab',
  textDim: '#6a6e78',
  textDanger: '#ef4444',
  accent: '#6c8cff',
  accentHover: '#5a7aef',
  menuHoverBg: '#04395e',

  // Редактор
  editorText: '#e1e1e3',
  editorCaret: '#6c8cff',
  editorSelection: 'rgba(108, 140, 255, 0.2)',
  editorHeading: '#e8eaed',
  editorLink: '#5865f2',
  editorSyntax: '#4a4d54',
  editorHr: '#3a3d44',
  editorStrike: '#7b7d85',
  editorCodeBg: 'rgba(108, 140, 255, 0.1)',
  editorCodeText: '#8ca8ff',
  editorMarkBg: 'rgba(255, 215, 0, 0.2)',
  editorMarkText: '#ffd700',
  editorBlockquoteBorder: '#6c8cff',
  editorBlockquoteText: '#a0a4ab',
  editorBlockquoteBg: 'rgba(108, 140, 255, 0.05)',

  // Блоки кода и подсветка
  codeblockBg: '#1e1e1e',
  codeblockBorder: '#2d2e32',
  codeblockText: '#e4e6eb',
  codeblockLang: '#8bb4e7',
  hljsKeyword: '#c678dd',
  hljsString: '#98c379',
  hljsTitle: '#e06c75',
  hljsNumber: '#d19a66',
  hljsComment: '#5c6370',

  // Таблицы
  tableBorder: '#232428',
  tableHeaderBg: '#1e2025',
  tableHeaderText: '#e8eaed',
  tableCellBg: 'rgba(30, 32, 37, 0.3)',
  tableCellText: '#c8cad0',
  tableEvenBg: 'rgba(30, 32, 37, 0.5)',
  tableSelected: 'rgba(108, 140, 255, 0.15)',
}

export const LIGHT_COLORS: ThemeColors = {
  // Интерфейс
  bgBase: '#ffffff',
  bgSurface: '#f3f3f3',
  bgElevated: '#ffffff',
  bgHover: '#e8e8e8',
  bgActive: '#d4d4d4',
  bgInput: '#f0f0f0',
  borderDefault: '#e0e0e0',
  borderStrong: '#cccccc',
  textPrimary: '#1e1e1e',
  textSecondary: '#3c3c3c',
  textMuted: '#6e6e6e',
  textDim: '#999999',
  textDanger: '#e81123',
  accent: '#4472c4',
  accentHover: '#3561b3',
  menuHoverBg: '#d6e4ff',

  // Редактор
  editorText: '#1e1e1e',
  editorCaret: '#4472c4',
  editorSelection: 'rgba(68, 114, 196, 0.2)',
  editorHeading: '#1e1e1e',
  editorLink: '#4472c4',
  editorSyntax: '#bbbbbb',
  editorHr: '#e0e0e0',
  editorStrike: '#999999',
  editorCodeBg: 'rgba(68, 114, 196, 0.08)',
  editorCodeText: '#4472c4',
  editorMarkBg: 'rgba(255, 217, 0, 0.521)',
  editorMarkText: '#704e00',
  editorBlockquoteBorder: '#4472c4',
  editorBlockquoteText: '#6e6e6e',
  editorBlockquoteBg: 'rgba(68, 114, 196, 0.05)',

  // Блоки кода и подсветка
  codeblockBg: '#f5f5f5',
  codeblockBorder: '#e0e0e0',
  codeblockText: '#1e1e1e',
  codeblockLang: '#4472c4',
  hljsKeyword: '#a626a4',
  hljsString: '#50a14f',
  hljsTitle: '#e45649',
  hljsNumber: '#986801',
  hljsComment: '#a0a1a7',

  // Таблицы
  tableBorder: '#e0e0e0',
  tableHeaderBg: '#f0f0f0',
  tableHeaderText: '#1e1e1e',
  tableCellBg: '#ffffff',
  tableCellText: '#3c3c3c',
  tableEvenBg: '#f9f9f9',
  tableSelected: 'rgba(68, 114, 196, 0.15)',
}

export const DEFAULT_TYPOGRAPHY: ThemeTypography = {
  fontFamilyUi: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  fontFamilyEditor: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  fontFamilyCode: "'Fira Code', 'Consolas', 'Monaco', 'Courier New', monospace",
  fontSizeEditor: 15,
  lineHeightEditor: 1.6,
}

export const DARK_THEME: AppTheme = {
  id: 'dark',
  name: 'Тёмная',
  isBuiltin: true,
  baseTheme: 'dark',
  colors: { ...DARK_COLORS },
  typography: { ...DEFAULT_TYPOGRAPHY },
}

export const LIGHT_THEME: AppTheme = {
  id: 'light',
  name: 'Светлая',
  isBuiltin: true,
  baseTheme: 'light',
  colors: { ...LIGHT_COLORS },
  typography: { ...DEFAULT_TYPOGRAPHY },
}

export const PEACHY_THEME: AppTheme = {
  id: 'peachy',
  name: 'Peachy',
  isBuiltin: true,
  baseTheme: 'light',
  colors: {
    bgBase: '#fef4ec',
    bgSurface: '#ffe6db',
    bgElevated: '#fef6ec',
    bgHover: '#e8caca',
    bgActive: '#dcbcbc',
    bgInput: '#fef4ec',
    borderDefault: '#e8d3d3',
    borderStrong: '#dcbcbc',
    textPrimary: '#6f5252',
    textSecondary: '#846262',
    textMuted: '#a28181',
    textDim: '#846262',
    textDanger: '#ee7272',
    accent: '#ba7878',
    accentHover: '#bf8282',
    menuHoverBg: 'rgba(236, 165, 142, 0.15)',
    editorText: '#6f5252',
    editorCaret: '#bc6262',
    editorSelection: 'rgba(236, 165, 142, 0.25)',
    editorHeading: '#6f5252',
    editorLink: '#ff781f',
    editorSyntax: '#ba7878',
    editorHr: '#9d7b7b',
    editorStrike: '#9d7b7b',
    editorCodeBg: 'rgba(150, 57, 98, 0.08)',
    editorCodeText: '#ff781f',
    editorMarkBg: '#fd6bff',
    editorMarkText: '#863687',
    editorBlockquoteBorder: '#ff781f',
    editorBlockquoteText: '#6f5252',
    editorBlockquoteBg: 'rgba(236, 165, 142, 0.15)',
    codeblockBg: '#ffe6db',
    codeblockBorder: '#ce8d8d',
    codeblockText: '#6f5252',
    codeblockLang: '#6f5252',
    hljsKeyword: '#ac3eab',
    hljsString: '#918712',
    hljsTitle: '#3da966',
    hljsNumber: '#b55f26',
    hljsComment: '#a88a8a',
    tableBorder: '#ce8d8d',
    tableHeaderBg: '#ba7878',
    tableHeaderText: '#fef4ec',
    tableCellBg: '#ffdbcc',
    tableCellText: '#6f5252',
    tableEvenBg: '#ffe6db',
    tableSelected: 'rgba(236, 165, 142, 0.15)',
  },
  typography: { ...DEFAULT_TYPOGRAPHY },
}

export const DISSONANCE_THEME: AppTheme = {
  id: 'dissonance',
  name: 'Dissonance',
  isBuiltin: true,
  baseTheme: 'dark',
  colors: {
    bgBase: '#323339',
    bgSurface: '#2c2d32',
    bgElevated: '#323339',
    bgHover: '#414249',
    bgActive: '#313238',
    bgInput: '#2a2b30',
    borderDefault: '#393a3f',
    borderStrong: '#414348',
    textPrimary: '#f3f3f4',
    textSecondary: '#d7d8da',
    textMuted: '#c5c5c9',
    textDim: '#c5c5c9',
    textDanger: '#a9232e',
    accent: '#5865f2',
    accentHover: '#4452bb',
    menuHoverBg: '#414249',
    editorText: '#f3f3f4',
    editorCaret: '#5865f2',
    editorSelection: 'rgba(88, 101, 242, 0.25)',
    editorHeading: '#f3f3f4',
    editorLink: '#76aff6',
    editorSyntax: '#f3f3f4',
    editorHr: '#f3f3f4',
    editorStrike: '#f3f3f4',
    editorCodeBg: '#353748',
    editorCodeText: '#d4d4d8',
    editorMarkBg: '#5865f2',
    editorMarkText: '#ffffff',
    editorBlockquoteBorder: '#595a63',
    editorBlockquoteText: '#b5b6bb',
    editorBlockquoteBg: '#323339',
    codeblockBg: '#353748',
    codeblockBorder: '#494a59',
    codeblockText: '#F3F3F4',
    codeblockLang: '#8bb4e7',
    hljsKeyword: '#F2B5B1',
    hljsString: '#93D8A6',
    hljsTitle: '#B3C1F3',
    hljsNumber: '#DCAA93',
    hljsComment: '#9B9CA5',
    tableBorder: '#494a59',
    tableHeaderBg: '#3f4151',
    tableHeaderText: '#ededee',
    tableCellBg: '#353748',
    tableCellText: '#d7d8da',
    tableEvenBg: '#323443',
    tableSelected: 'rgba(88, 101, 242, 0.25)',
  },
  typography: { ...DEFAULT_TYPOGRAPHY },
}

export const BUILTIN_THEMES: AppTheme[] = [DARK_THEME, LIGHT_THEME, PEACHY_THEME, DISSONANCE_THEME]

/** Генерация CSS переменных для темы */
export function generateCssVariables(theme: AppTheme): string {
  const { colors, typography } = theme
  const isDark = theme.baseTheme === 'dark'

  return `
    :root, [data-theme="${theme.baseTheme}"] {
      --bg-base: ${colors.bgBase} !important;
      --bg-surface: ${colors.bgSurface} !important;
      --bg-elevated: ${colors.bgElevated} !important;
      --bg-hover: ${colors.bgHover} !important;
      --bg-active: ${colors.bgActive} !important;
      --bg-input: ${colors.bgInput} !important;
      --border-default: ${colors.borderDefault} !important;
      --border-strong: ${colors.borderStrong} !important;
      --text-primary: ${colors.textPrimary} !important;
      --text-secondary: ${colors.textSecondary} !important;
      --text-muted: ${colors.textMuted} !important;
      --text-dim: ${colors.textDim} !important;
      --text-danger: ${colors.textDanger || (isDark ? '#ef4444' : '#e81123')} !important;
      --accent: ${colors.accent} !important;
      --accent-hover: ${colors.accentHover} !important;
      --menu-hover-bg: ${colors.menuHoverBg} !important;

      --scrollbar-thumb: ${colors.borderStrong} !important;
      --scrollbar-thumb-hover: ${colors.textDim} !important;

      --tooltip-bg: ${colors.bgElevated} !important;
      --tooltip-border: ${colors.borderStrong} !important;
      --tooltip-input-bg: ${colors.bgInput} !important;
      --tooltip-input-border: ${colors.borderDefault} !important;

      --editor-text: ${colors.editorText} !important;
      --editor-caret: ${colors.editorCaret} !important;
      --editor-selection: ${colors.editorSelection} !important;
      --editor-heading: ${colors.editorHeading} !important;
      --editor-heading-h3: ${colors.editorHeading} !important;
      --editor-heading-h4: ${colors.editorHeading} !important;
      --editor-heading-h5: ${colors.editorHeading} !important;
      --editor-heading-h6: ${colors.editorHeading} !important;
      --text-heading: ${colors.editorHeading} !important;
      --editor-link: ${colors.editorLink} !important;
      --editor-syntax: ${colors.editorSyntax || (isDark ? '#4a4d54' : '#bbbbbb')} !important;
      --editor-prefix: ${colors.editorSyntax || (isDark ? '#4a4d54' : '#bbbbbb')} !important;
      --editor-hr: ${colors.editorHr || (isDark ? '#3a3d44' : '#e0e0e0')} !important;
      --editor-strike: ${colors.editorStrike || (isDark ? '#7b7d85' : '#999999')} !important;
      --editor-strong: ${colors.editorText} !important;
      --editor-em: ${colors.editorText} !important;
      --editor-code-bg: ${colors.editorCodeBg} !important;
      --editor-code-text: ${colors.editorCodeText} !important;
      --editor-mark-bg: ${colors.editorMarkBg} !important;
      --editor-mark-text: ${colors.editorMarkText} !important;
      --editor-blockquote-border: ${colors.editorBlockquoteBorder} !important;
      --editor-blockquote-text: ${colors.editorBlockquoteText} !important;
      --editor-blockquote-bg: ${colors.editorBlockquoteBg} !important;

      --codeblock-bg: ${colors.codeblockBg} !important;
      --codeblock-border: ${colors.codeblockBorder} !important;
      --codeblock-text: ${colors.codeblockText} !important;
      --codeblock-lang: ${colors.codeblockLang} !important;
      --codeblock-header: ${isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)'} !important;
      --codeblock-copy: ${colors.textDim} !important;
      --codeblock-copy-hover-text: ${colors.textPrimary} !important;
      --codeblock-copy-hover-bg: ${isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)'} !important;
      --codeblock-copied: ${colors.hljsString} !important;

      --hljs-keyword: ${colors.hljsKeyword} !important;
      --hljs-string: ${colors.hljsString} !important;
      --hljs-title: ${colors.hljsTitle} !important;
      --hljs-number: ${colors.hljsNumber} !important;
      --hljs-comment: ${colors.hljsComment} !important;
      --hljs-attr: ${colors.hljsNumber} !important;
      --hljs-symbol: ${colors.accent} !important;
      --hljs-deletion: ${colors.hljsTitle} !important;

      --table-border: ${colors.tableBorder} !important;
      --table-header-bg: ${colors.tableHeaderBg} !important;
      --table-header-text: ${colors.tableHeaderText} !important;
      --table-cell-bg: ${colors.tableCellBg} !important;
      --table-cell-text: ${colors.tableCellText} !important;
      --table-even-bg: ${colors.tableEvenBg} !important;
      --table-selected: ${colors.tableSelected} !important;

      --math-render: ${colors.editorText} !important;
      --math-text: ${colors.hljsKeyword} !important;
      --math-dollar: ${colors.editorSyntax || colors.textDim} !important;
      --math-block-editor-bg: ${colors.codeblockBg} !important;
      --math-block-editor-border: ${colors.codeblockBorder} !important;
      --math-block-header-bg: ${colors.bgSurface} !important;
      --math-block-active-border: ${colors.borderStrong} !important;
      --math-block-active-bg: ${colors.bgHover} !important;
      --math-btn-ok: ${colors.hljsString} !important;

      --font-ui: ${typography.fontFamilyUi};
      --font-editor: ${typography.fontFamilyEditor};
      --font-code: ${typography.fontFamilyCode};
      --editor-font-size: ${typography.fontSizeEditor}px;
      --editor-line-height: ${typography.lineHeightEditor};
    }

    body {
      font-family: var(--font-ui) !important;
    }

    .ProseMirror, .cm-editor, .markdown-body {
      font-family: var(--font-editor) !important;
      font-size: var(--editor-font-size) !important;
      line-height: var(--editor-line-height) !important;
    }

    code, pre, .codeblock, .cm-scroller {
      font-family: var(--font-code) !important;
    }

    ::selection {
      background-color: ${colors.editorSelection} !important;
    }
  `
}

/** Применить тему к DOM */
export function applyThemeToDOM(theme: AppTheme) {
  document.documentElement.setAttribute('data-theme', theme.baseTheme)

  let styleTag = document.getElementById('typeclub-custom-theme-vars') as HTMLStyleElement | null
  if (!styleTag) {
    styleTag = document.createElement('style')
    styleTag.id = 'typeclub-custom-theme-vars'
    document.head.appendChild(styleTag)
  }

  styleTag.textContent = generateCssVariables(theme)
}

/** Валидация и парсинг одного объекта темы */
export function parseSingleTheme(data: any): AppTheme | null {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null
  if (typeof data.name !== 'string' || !data.name.trim()) return null

  const baseTheme = data.baseTheme === 'light' ? 'light' : 'dark'
  const fallbackColors = baseTheme === 'light' ? LIGHT_COLORS : DARK_COLORS

  const colors: ThemeColors = {
    ...fallbackColors,
    ...(data.colors && typeof data.colors === 'object' ? data.colors : {}),
  }

  const typography: ThemeTypography = {
    ...DEFAULT_TYPOGRAPHY,
    ...(data.typography && typeof data.typography === 'object' ? data.typography : {}),
  }

  return {
    id: typeof data.id === 'string' && data.id ? data.id : `custom_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    name: data.name.trim(),
    isBuiltin: false,
    baseTheme,
    colors,
    typography,
  }
}

/** Валидация структуры темы из JSON (поддерживает один объект или массив тем) */
export function validateThemeJson(data: any): AppTheme[] | null {
  if (!data) return null

  if (Array.isArray(data)) {
    const list: AppTheme[] = []
    for (const item of data) {
      const parsed = parseSingleTheme(item)
      if (parsed) list.push(parsed)
    }
    return list.length > 0 ? list : null
  }

  if (typeof data === 'object') {
    const single = parseSingleTheme(data)
    return single ? [single] : null
  }

  return null
}
