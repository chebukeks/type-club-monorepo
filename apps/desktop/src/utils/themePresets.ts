import type { AppTheme, ThemeAppearance, ThemeColors, ThemeTypography } from '../types'

const appearanceFlags = {
  flatFrame: 'data-theme-flat-frame',
  outlinedTabs: 'data-theme-outlined-tabs',
  compactControls: 'data-theme-compact-controls',
  compactTables: 'data-theme-compact-tables',
  shadedSidebarHeader: 'data-theme-shaded-sidebar-header',
  outlinedBlocks: 'data-theme-outlined-blocks',
  headingDividers: 'data-theme-heading-dividers',
  ruledPaper: 'data-theme-ruled-paper',
} as const

const appearanceColorTokens = {
  ruleColor: '--theme-rule-color',
  spellingColor: '--theme-spelling-color',
  taskColor: '--theme-task-color',
  tabBackground: '--theme-tab-background',
  tabHover: '--theme-tab-hover',
  tabBorder: '--theme-tab-border',
  tabActiveBackground: '--theme-tab-active-background',
  tabActiveBorder: '--theme-tab-active-border',
} as const

function readAppearanceColor(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const color = value.trim()
  if (!/^(?:#[\da-f]{3,8}|[a-z]+|(?:rgba?|hsla?|hwb|oklab|oklch|lab|lch|color)\([\w.,%+ /-]+\))$/i.test(color)) return undefined
  if (typeof CSS !== 'undefined' && !CSS.supports('color', color)) return undefined
  return color
}

function readThemeAppearance(value: unknown): ThemeAppearance | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  const source = value as Record<string, unknown>
  const appearance: ThemeAppearance = {}
  for (const key of Object.keys(appearanceFlags) as (keyof typeof appearanceFlags)[]) {
    if (source[key] === true) appearance[key] = true
  }
  for (const key of Object.keys(appearanceColorTokens) as (keyof typeof appearanceColorTokens)[]) {
    const color = readAppearanceColor(source[key])
    if (color) appearance[key] = color
  }
  const gap = source.ruleGap
  if (typeof gap === 'number' && Number.isFinite(gap)) appearance.ruleGap = Math.max(0, Math.min(60, gap))
  return Object.keys(appearance).length ? appearance : undefined
}

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

type PresetPalette = Pick<ThemeColors,
  'bgBase' | 'bgSurface' | 'bgElevated' | 'bgHover' | 'bgActive' | 'borderDefault' |
  'borderStrong' | 'textPrimary' | 'textSecondary' | 'textMuted' | 'accent' | 'accentHover'> &
  Partial<Pick<ThemeColors, 'editorLink'>>

function createBuiltinTheme(id: string, name: string, baseTheme: AppTheme['baseTheme'], palette: PresetPalette): AppTheme {
  const { bgBase, bgSurface, bgElevated, bgHover, bgActive, borderDefault, borderStrong, textPrimary, textSecondary, textMuted, accent } = palette
  const editorAccent = palette.editorLink ?? accent
  return {
    id, name, baseTheme, isBuiltin: true,
    colors: {
      ...(baseTheme === 'light' ? LIGHT_COLORS : DARK_COLORS),
      ...palette,
      bgInput: bgElevated,
      textDim: textMuted,
      menuHoverBg: bgHover,
      editorText: textPrimary,
      editorHeading: textPrimary,
      editorSyntax: textMuted,
      editorHr: borderStrong,
      editorStrike: textMuted,
      editorCaret: editorAccent,
      editorSelection: `${editorAccent}40`,
      editorLink: editorAccent,
      editorCodeBg: bgSurface,
      editorCodeText: editorAccent,
      editorBlockquoteBg: bgSurface,
      editorBlockquoteBorder: editorAccent,
      editorBlockquoteText: textSecondary,
      codeblockBg: bgSurface,
      codeblockBorder: borderDefault,
      codeblockText: textPrimary,
      codeblockLang: editorAccent,
      hljsComment: textMuted,
      tableBorder: borderStrong,
      tableHeaderBg: bgHover,
      tableHeaderText: textPrimary,
      tableCellBg: bgBase,
      tableCellText: textSecondary,
      tableEvenBg: bgSurface,
      tableSelected: bgActive,
    },
    typography: { ...DEFAULT_TYPOGRAPHY },
  }
}

function createColorfulTheme(
  id: string,
  name: string,
  baseTheme: AppTheme['baseTheme'],
  palette: PresetPalette,
  backgrounds?: AppTheme['backgrounds'],
): AppTheme {
  const theme = createBuiltinTheme(id, name, baseTheme, palette)
  const lightSyntax = {
    hljsKeyword: '#762981',
    hljsString: '#28603a',
    hljsTitle: '#9f3139',
    hljsNumber: '#794b13',
  }
  const darkSyntax = {
    hljsKeyword: '#e5b2fa',
    hljsString: '#b6e28c',
    hljsTitle: '#ffadba',
    hljsNumber: '#f5bc86',
  }
  return {
    ...theme,
    backgrounds,
    colors: {
      ...theme.colors,
      ...(baseTheme === 'light' ? lightSyntax : darkSyntax),
      codeblockBg: palette.bgElevated,
    },
  }
}

const notebookTheme = createBuiltinTheme('twelve-sheets', 'Twelve Sheets', 'light', {
  bgBase: '#fcfbf1', bgSurface: '#b5cf87', bgElevated: '#f3f7df', bgHover: '#c7db9d', bgActive: '#a7c379',
  borderDefault: '#a0b77f', borderStrong: '#749251', textPrimary: '#263b25', textSecondary: '#395838',
  textMuted: '#30482f', accent: '#336242', accentHover: '#294e35', editorLink: '#574582',
})

const NOTEBOOK_THEME: AppTheme = {
  ...notebookTheme,
  backgrounds: {
    panels: 'linear-gradient(150deg, #bdd794, #a3c174)',
  },
  appearance: {
    ruledPaper: true,
    ruleColor: '#a7c5df',
    spellingColor: '#a3454a',
    taskColor: '#23447b',
  },
  colors: {
    ...notebookTheme.colors,
    editorText: '#23447b',
    editorHeading: '#48326e',
    editorCaret: '#23447b',
    editorSelection: '#8ba7d14d',
    editorSyntax: '#5f5a51',
    editorHr: '#a7c5df',
    editorStrike: '#635e55',
    editorCodeBg: '#efede2',
    editorCodeText: '#494640',
    editorMarkBg: '#f7e6a7',
    editorMarkText: '#514021',
    editorBlockquoteBg: '#f5f1e5',
    editorBlockquoteBorder: '#826454',
    editorBlockquoteText: '#554e45',
    codeblockBg: '#efede2',
    codeblockBorder: '#c6c0af',
    codeblockText: '#494640',
    codeblockLang: '#5f5145',
    hljsKeyword: '#614681',
    hljsString: '#3d633e',
    hljsTitle: '#8c4145',
    hljsNumber: '#814f32',
    hljsComment: '#656054',
    tableBorder: '#a7c5df',
    tableHeaderBg: '#e9edf2',
    tableHeaderText: '#48326e',
    tableCellText: '#23447b',
    tableEvenBg: '#f6f4e9',
    tableSelected: '#a8c5e4',
  },
  typography: {
    ...DEFAULT_TYPOGRAPHY,
    fontFamilyEditor: "'Caveat', 'Segoe Print', 'Bradley Hand', cursive",
    fontSizeEditor: 19.5,
    lineHeightEditor: 1.55,
  },
}

const threadsTheme = createBuiltinTheme('two-threads', 'Two Threads', 'light', {
  bgBase: '#ededed', bgSurface: '#ededed', bgElevated: '#dadada', bgHover: '#e1e1e1', bgActive: '#d5d5d5',
  borderDefault: '#d4d4d4', borderStrong: '#a2a2a2', textPrimary: '#292929', textSecondary: '#414141',
  textMuted: '#555555', accent: '#ab4400', accentHover: '#8d3600', editorLink: '#ab4400',
})

const TWO_THREADS_THEME: AppTheme = {
  ...threadsTheme,
  appearance: {
    flatFrame: true,
    shadedSidebarHeader: true,
    outlinedBlocks: true,
    headingDividers: true,
  },
  colors: {
    ...threadsTheme.colors,
    bgInput: '#f4f4f4',
    editorHeading: '#004b8e',
    editorBlockquoteBg: '#dadada',
    editorBlockquoteBorder: '#adadad',
    editorBlockquoteText: '#292929',
    editorMarkBg: '#ffdec5',
    editorMarkText: '#603005',
    editorCodeBg: '#dedede',
    editorCodeText: '#373737',
    codeblockBg: '#dadada',
    codeblockText: '#292929',
    codeblockLang: '#004b8e',
    hljsKeyword: '#164c84',
    hljsString: '#285b33',
    hljsTitle: '#723e77',
    hljsNumber: '#86401a',
    hljsComment: '#535353',
    tableHeaderBg: '#dadada',
    tableHeaderText: '#004b8e',
    tableEvenBg: '#e5e5e5',
    tableSelected: '#f5c9ab',
  },
  typography: {
    ...DEFAULT_TYPOGRAPHY,
    fontFamilyUi: "'Trebuchet MS', Arial, sans-serif",
    fontFamilyEditor: "'Trebuchet MS', Arial, sans-serif",
    lineHeightEditor: 1.45,
  },
}

const officeTheme = createBuiltinTheme('amber-office', 'Amber Office', 'light', {
  bgBase: '#ffffff', bgSurface: '#fff0a3', bgElevated: '#f2f2f2', bgHover: '#fff5c5', bgActive: '#f8db54',
  borderDefault: '#cecece', borderStrong: '#a8a8a8', textPrimary: '#252525', textSecondary: '#424242',
  textMuted: '#555044', accent: '#795600', accentHover: '#624400', editorLink: '#23578b',
})

const AMBER_OFFICE_THEME: AppTheme = {
  ...officeTheme,
  appearance: {
    flatFrame: true,
    outlinedTabs: true,
    compactControls: true,
    compactTables: true,
    tabBackground: '#fff5ca',
    tabHover: '#fff9e3',
    tabBorder: '#e0d49e',
    tabActiveBorder: '#b89b42',
  },
  colors: {
    ...officeTheme.colors,
    bgInput: '#ffffff',
    editorHeading: '#242424',
    editorSelection: '#f8db5466',
    editorHr: '#cecece',
    editorCodeBg: '#f2f2f2',
    editorBlockquoteBg: '#faf8ed',
    editorBlockquoteBorder: '#dfb922',
    editorMarkBg: '#fff0a3',
    editorMarkText: '#4b3b13',
    codeblockBg: '#f2f2f2',
    codeblockText: '#252525',
    codeblockLang: '#23578b',
    hljsKeyword: '#23578b',
    hljsString: '#2c653e',
    hljsTitle: '#704540',
    hljsNumber: '#865310',
    hljsComment: '#585858',
    tableHeaderBg: '#eeeeee',
    tableEvenBg: '#f7f7f7',
    tableSelected: '#ffe686',
  },
  typography: {
    ...DEFAULT_TYPOGRAPHY,
    fontFamilyUi: "'Segoe UI', Tahoma, Arial, sans-serif",
    fontFamilyEditor: "'Segoe UI', Tahoma, Arial, sans-serif",
    lineHeightEditor: 1.45,
  },
}

export const BUILTIN_THEMES: AppTheme[] = [
  DARK_THEME, LIGHT_THEME, PEACHY_THEME, DISSONANCE_THEME,
  AMBER_OFFICE_THEME,
  TWO_THREADS_THEME,
  NOTEBOOK_THEME,
  createBuiltinTheme('parchment', 'Parchment', 'light', {
    bgBase: '#fbf5e8', bgSurface: '#f1e7d3', bgElevated: '#fff9ed', bgHover: '#eee0c5', bgActive: '#e6d4b5',
    borderDefault: '#e3d3b7', borderStrong: '#cbb691', textPrimary: '#3a2b1d', textSecondary: '#59422c',
    textMuted: '#735b43', accent: '#88461f', accentHover: '#6b3315',
  }),
  createBuiltinTheme('sage', 'Sage', 'light', {
    bgBase: '#f4f8f1', bgSurface: '#e6eee2', bgElevated: '#fbfdf8', bgHover: '#dce9d9', bgActive: '#cbdcc8',
    borderDefault: '#d1decf', borderStrong: '#a8bfa9', textPrimary: '#23372b', textSecondary: '#395342',
    textMuted: '#4b6554', accent: '#276847', accentHover: '#1b5237',
  }),
  createBuiltinTheme('lavender', 'Lavender', 'light', {
    bgBase: '#faf7ff', bgSurface: '#eee7f8', bgElevated: '#fdfaff', bgHover: '#e9def5', bgActive: '#ded0ef',
    borderDefault: '#dfd4ed', borderStrong: '#bba8d1', textPrimary: '#352746', textSecondary: '#514164',
    textMuted: '#685578', accent: '#6b4399', accentHover: '#54327b',
  }),
  createBuiltinTheme('midnight', 'Midnight', 'dark', {
    bgBase: '#121b2e', bgSurface: '#17243b', bgElevated: '#1e2d48', bgHover: '#263853', bgActive: '#344967',
    borderDefault: '#293c59', borderStrong: '#435b7c', textPrimary: '#e5efff', textSecondary: '#c3d2eb',
    textMuted: '#a0b4d4', accent: '#3564aa', accentHover: '#3a6cb1', editorLink: '#83bdff',
  }),
  createBuiltinTheme('pine', 'Pine', 'dark', {
    bgBase: '#14211d', bgSurface: '#192b24', bgElevated: '#21352d', bgHover: '#2a4338', bgActive: '#345044',
    borderDefault: '#2d473b', borderStrong: '#4c6a5c', textPrimary: '#e1f3e9', textSecondary: '#c0d8ca',
    textMuted: '#a0beaf', accent: '#2e6c54', accentHover: '#33745a', editorLink: '#82d9af',
  }),
  createBuiltinTheme('ember', 'Ember', 'dark', {
    bgBase: '#271c1a', bgSurface: '#30221f', bgElevated: '#3a2a26', bgHover: '#4b342d', bgActive: '#5a3f34',
    borderDefault: '#4b362d', borderStrong: '#755748', textPrimary: '#fbede1', textSecondary: '#e1c5b4',
    textMuted: '#c5a89a', accent: '#9c492f', accentHover: '#a85033', editorLink: '#f4ad80',
  }),
  createColorfulTheme('brick-box', 'Brick Box', 'light', {
    bgBase: '#fff4e3', bgSurface: '#edc989', bgElevated: '#fff9ef', bgHover: '#f7dbaa', bgActive: '#f2c17e',
    borderDefault: '#d4a56c', borderStrong: '#a36a48', textPrimary: '#3e241f', textSecondary: '#54332b',
    textMuted: '#624239', accent: '#a62d3c', accentHover: '#87232f', editorLink: '#284990',
  }),
  createColorfulTheme('rubber-duck', 'Rubber Duck', 'light', {
    bgBase: '#fff8da', bgSurface: '#efd36e', bgElevated: '#fffbed', bgHover: '#f7e197', bgActive: '#e6bf55',
    borderDefault: '#c9a648', borderStrong: '#917335', textPrimary: '#382a16', textSecondary: '#493819',
    textMuted: '#5b471e', accent: '#175c7f', accentHover: '#124761', editorLink: '#175c7f',
  }),
  createColorfulTheme('bubblegum', 'Bubblegum', 'light', {
    bgBase: '#fff0f5', bgSurface: '#efbfd9', bgElevated: '#fff7fb', bgHover: '#f7cfe4', bgActive: '#e8acd1',
    borderDefault: '#d997bc', borderStrong: '#aa6794', textPrimary: '#3d1834', textSecondary: '#553047',
    textMuted: '#693851', accent: '#a13072', accentHover: '#87265f', editorLink: '#4d4189',
  }),
  createColorfulTheme('marbles', 'Marbles', 'light', {
    bgBase: '#effaed', bgSurface: '#addbc2', bgElevated: '#f7fcf4', bgHover: '#c1e7ce', bgActive: '#9bceb2',
    borderDefault: '#91baa1', borderStrong: '#598a70', textPrimary: '#18352a', textSecondary: '#2c4938',
    textMuted: '#345740', accent: '#19654c', accentHover: '#15533e', editorLink: '#913e28',
  }),
  createColorfulTheme('toy-rocket', 'Toy Rocket', 'dark', {
    bgBase: '#27213d', bgSurface: '#352750', bgElevated: '#3d2f58', bgHover: '#4b3769', bgActive: '#58417c',
    borderDefault: '#534169', borderStrong: '#785a91', textPrimary: '#fff1fc', textSecondary: '#e8d8f2',
    textMuted: '#d8c4e9', accent: '#9b3d69', accentHover: '#a64472', editorLink: '#85e0cc',
  }),
  createColorfulTheme('tin-robot', 'Tin Robot', 'dark', {
    bgBase: '#222b40', bgSurface: '#2e3e57', bgElevated: '#35465f', bgHover: '#3d5272', bgActive: '#465f81',
    borderDefault: '#495c77', borderStrong: '#6a81a0', textPrimary: '#f4f7ff', textSecondary: '#dde8f7',
    textMuted: '#d0dcef', accent: '#9f4628', accentHover: '#aa4c2b', editorLink: '#ffbd89',
  }),
  createColorfulTheme('walnut', 'Walnut', 'light', {
    bgBase: '#f8ecda', bgSurface: '#d3a777', bgElevated: '#fff5e6', bgHover: '#eed0a9', bgActive: '#e2b986',
    borderDefault: '#bc8b61', borderStrong: '#966442', textPrimary: '#392318', textSecondary: '#472e20',
    textMuted: '#432b1d', accent: '#754328', accentHover: '#62351f', editorLink: '#305e4e',
  }, {
    editor: 'repeating-linear-gradient(3deg, transparent 0 12px, #72401307 13px 14px, transparent 15px 23px), linear-gradient(110deg, #fcf2e2, #f3e1c7)',
    panels: 'repeating-radial-gradient(ellipse at -24% 38%, #58321616 0 1px, transparent 2px 8px, #fff5db28 9px 10px, transparent 12px 16px), linear-gradient(102deg, #e0b98f, #c99667 58%, #dfb68c)',
  }),
  createColorfulTheme('sherbet', 'Sherbet', 'light', {
    bgBase: '#fff4ed', bgSurface: '#edc6d3', bgElevated: '#fff8f3', bgHover: '#f5d7e2', bgActive: '#eabdd1',
    borderDefault: '#dca7b7', borderStrong: '#ad758f', textPrimary: '#3b2440', textSecondary: '#57384f',
    textMuted: '#66435e', accent: '#97386b', accentHover: '#812d5b', editorLink: '#734488',
  }, {
    editor: 'linear-gradient(135deg, #fff8e9 0%, #fbeaf0 52%, #f1edf9 100%)',
    panels: 'linear-gradient(120deg, #f3c2a9 0%, #eec7da 48%, #d7c4ee 100%)',
  }),
  createColorfulTheme('lagoon', 'Lagoon', 'light', {
    bgBase: '#edf9f6', bgSurface: '#b6dcd9', bgElevated: '#f7fffd', bgHover: '#c6ece7', bgActive: '#a6d4cf',
    borderDefault: '#8dbdb9', borderStrong: '#598b87', textPrimary: '#19353e', textSecondary: '#294951',
    textMuted: '#375760', accent: '#126773', accentHover: '#0c535e', editorLink: '#28508d',
  }, {
    editor: 'linear-gradient(145deg, #f3fcf4 0%, #e2f5f2 54%, #eaf1fd 100%)',
    panels: 'linear-gradient(145deg, #c8e7ce 0%, #acd8d6 50%, #adcce8 100%)',
  }),
  createColorfulTheme('aurora', 'Aurora', 'dark', {
    bgBase: '#25243d', bgSurface: '#30294c', bgElevated: '#3a3454', bgHover: '#43395f', bgActive: '#52436b',
    borderDefault: '#4c4867', borderStrong: '#78668d', textPrimary: '#f6f2ff', textSecondary: '#e4def5',
    textMuted: '#ccc6e4', accent: '#71499a', accentHover: '#7b50a3', editorLink: '#92e4db',
  }, {
    editor: 'linear-gradient(140deg, #20233a 0%, #2e2445 57%, #223844 100%)',
    panels: 'linear-gradient(115deg, #282444 0%, #392953 51%, #23474e 100%)',
  }),
]

function readGradient(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const gradient = value.trim()
  if (!/^(?:repeating-)?(?:linear|radial|conic)-gradient\(/i.test(gradient)) return undefined
  if (/[;{}\\@]|url\s*\(/i.test(gradient)) return undefined
  if (typeof CSS !== 'undefined' && !CSS.supports('background-image', gradient)) return undefined
  return gradient
}

export function getThemeBackgroundImage(theme: AppTheme, area: 'editor' | 'panels'): string {
  const color = area === 'editor' ? theme.colors?.bgBase : theme.colors?.bgSurface
  return readGradient(theme.backgrounds?.[area]) ?? readGradient(color) ?? 'none'
}

export function getThemeEditorSwatch(theme: AppTheme): string {
  if (!theme.appearance?.ruledPaper) return getThemeBackgroundImage(theme, 'editor')
  const color = readAppearanceColor(theme.appearance.ruleColor) ?? '#a7c5df'
  return `repeating-linear-gradient(to bottom, transparent 0 11px, ${color} 11px 12px)`
}

function getBackgroundColor(value: string, fallback: string): string {
  if (typeof value !== 'string' || /[;{}]/.test(value) || readGradient(value)) return fallback
  if (typeof CSS !== 'undefined' && !CSS.supports('background-color', value)) return fallback
  return value
}

function readCssValue(property: string, value: unknown): string | undefined {
  if (typeof value !== 'string' || !value.trim() || /[;{}\\<>!]|\/\*|url\s*\(/i.test(value)) return undefined
  if (typeof CSS !== 'undefined' && !CSS.supports(property, value)) return undefined
  return value
}

function readThemeColors(value: unknown, fallback: ThemeColors): ThemeColors {
  const source = value as Partial<ThemeColors> | undefined
  const colors = { ...fallback }
  for (const key of Object.keys(colors) as (keyof ThemeColors)[]) {
    const gradient = key === 'bgBase' || key === 'bgSurface' ? readGradient(source?.[key]) : undefined
    colors[key] = gradient ?? readCssValue('color', source?.[key]) ?? fallback[key]
  }
  return colors
}

function readThemeTypography(value: unknown): ThemeTypography {
  const source = value as Partial<ThemeTypography> | undefined
  const typography = { ...DEFAULT_TYPOGRAPHY }
  for (const key of ['fontFamilyUi', 'fontFamilyEditor', 'fontFamilyCode'] as const) {
    typography[key] = readCssValue('font-family', source?.[key]) ?? typography[key]
  }
  for (const key of ['fontSizeEditor', 'lineHeightEditor'] as const) {
    const number = source?.[key]
    if (typeof number === 'number' && Number.isFinite(number) && number > 0) typography[key] = number
  }
  return typography
}

/** Генерация CSS переменных для темы */
export function generateCssVariables(theme: AppTheme): string {
  const isDark = theme.baseTheme === 'dark'
  const fallback = isDark ? DARK_COLORS : LIGHT_COLORS
  const colors = readThemeColors(theme.colors, fallback)
  const typography = readThemeTypography(theme.typography)
  const appearance = readThemeAppearance(theme.appearance)
  const appearanceColors = Object.entries(appearanceColorTokens)
    .map(([key, token]) => {
      const color = appearance?.[key as keyof typeof appearanceColorTokens]
      return color ? `${token}: ${color};` : ''
    }).filter(Boolean).join('\n      ')

  return `
    :root, [data-theme="${isDark ? 'dark' : 'light'}"] {
      --bg-base: ${getBackgroundColor(colors.bgBase, fallback.bgBase)} !important;
      --bg-surface: ${getBackgroundColor(colors.bgSurface, fallback.bgSurface)} !important;
      --theme-editor-image: ${getThemeBackgroundImage(theme, 'editor')} !important;
      --theme-panel-image: ${getThemeBackgroundImage(theme, 'panels')} !important;
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
      --hljs-symbol: ${colors.codeblockLang} !important;
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
      --editor-line-height: ${typography.lineHeightEditor};
      --theme-editor-font-size: ${typography.fontSizeEditor}px;
      ${appearance?.ruleGap === undefined ? '' : `--theme-rule-gap: ${appearance.ruleGap / 100}em;`}
      ${appearanceColors}
    }

    body {
      font-family: var(--font-ui) !important;
    }

    .ProseMirror, .cm-editor, .markdown-body {
      font-family: var(--font-editor) !important;
      font-size: calc(var(--theme-editor-font-size) * var(--editor-zoom, 1)) !important;
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
  const root = document.documentElement
  root.setAttribute('data-theme', theme.baseTheme)
  for (const key of Object.keys(appearanceFlags) as (keyof typeof appearanceFlags)[]) {
    root.toggleAttribute(appearanceFlags[key], theme.appearance?.[key] === true)
  }

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

  const colors = readThemeColors(data.colors, fallbackColors)
  const typography = readThemeTypography(data.typography)
  const editor = readGradient(data.backgrounds?.editor)
  const panels = readGradient(data.backgrounds?.panels)
  const appearance = readThemeAppearance(data.appearance)

  return {
    id: typeof data.id === 'string' && data.id ? data.id : `custom_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    name: data.name.trim(),
    isBuiltin: false,
    baseTheme,
    colors,
    ...(editor || panels ? { backgrounds: { editor, panels } } : {}),
    ...(appearance ? { appearance } : {}),
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
