import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  DARK_THEME,
  LIGHT_THEME,
  BUILTIN_THEMES,
  generateCssVariables,
  getThemeBackgroundImage,
  getThemeEditorSwatch,
  validateThemeJson,
  parseSingleTheme,
  DARK_COLORS,
  LIGHT_COLORS,
  DEFAULT_TYPOGRAPHY,
} from '../themePresets.ts'

function contrastRatio(first: string, second: string): number {
  const luminance = (hex: string) => [0.2126, 0.7152, 0.0722].reduce((sum, weight, i) => {
    const channel = parseInt(hex.slice(1 + 2 * i, 3 + 2 * i), 16) / 255
    const linear = channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
    return sum + weight * linear
  }, 0)
  const lighter = Math.max(luminance(first), luminance(second))
  const darker = Math.min(luminance(first), luminance(second))
  return (lighter + 0.05) / (darker + 0.05)
}

describe('Theme Presets & Utilities', () => {
  it('keeps text readable in new palettes and on gradient color stops', () => {
    const ids = ['brick-box', 'rubber-duck', 'bubblegum', 'marbles', 'toy-rocket', 'tin-robot',
      'walnut', 'sherbet', 'lagoon', 'aurora', 'twelve-sheets', 'two-threads', 'amber-office']
    for (const id of ids) {
      const theme = BUILTIN_THEMES.find(theme => theme.id === id)
      assert.ok(theme, id)
      const c = theme.colors
      const panelStops = theme.backgrounds?.panels?.match(/#[\da-f]{6}\b/gi) ?? []
      const editorStops = theme.backgrounds?.editor?.match(/#[\da-f]{6}\b/gi) ?? []
      const pairs = [
        ...[c.bgSurface, c.bgHover, c.bgActive, ...panelStops].map(bg => [c.textMuted, bg]),
        ...[c.bgBase, ...editorStops].flatMap(bg => [[c.editorText, bg], [c.editorLink, bg]]),
        ...[c.codeblockText, c.codeblockLang, c.hljsKeyword, c.hljsString, c.hljsTitle, c.hljsNumber, c.hljsComment]
          .map(fg => [fg, c.codeblockBg]),
        ['#ffffff', c.accent],
        ['#ffffff', c.accentHover],
      ]
      for (const [fg, bg] of pairs) assert.ok(contrastRatio(fg, bg) >= 4.5, `${id}: ${fg} on ${bg}`)
    }
  })

  it('renders gradients separately from solid colors and preserves them in theme JSON', () => {
    const theme = BUILTIN_THEMES.find(theme => theme.id === 'sherbet')
    assert.ok(theme?.backgrounds?.editor)
    const parsed = parseSingleTheme(JSON.parse(JSON.stringify(theme)))
    assert.deepEqual(parsed?.backgrounds, theme.backgrounds)
    const css = generateCssVariables(theme)
    assert.ok(css.includes(`--bg-base: ${theme.colors.bgBase}`))
    assert.ok(css.includes(`--theme-editor-image: ${theme.backgrounds.editor}`))
    assert.equal(getThemeBackgroundImage(LIGHT_THEME, 'editor'), 'none')

    const gradient = 'linear-gradient(135deg, #e2f5f2, #eaf1fd)'
    const legacy = { ...LIGHT_THEME, colors: { ...LIGHT_COLORS, bgBase: gradient } }
    assert.equal(getThemeBackgroundImage(legacy, 'editor'), gradient)
    assert.ok(generateCssVariables(legacy).includes(`--bg-base: ${LIGHT_COLORS.bgBase}`))
  })

  it('preserves the appearance of built-in themes when imported as custom themes', () => {
    for (const id of ['twelve-sheets', 'two-threads', 'amber-office']) {
      const builtin = BUILTIN_THEMES.find(theme => theme.id === id)
      assert.ok(builtin?.appearance)
      const imported = parseSingleTheme(JSON.parse(JSON.stringify(builtin)))
      assert.ok(imported)
      assert.equal(imported.isBuiltin, false)
      assert.deepEqual(imported.appearance, builtin.appearance)
      assert.equal(generateCssVariables(imported), generateCssVariables(builtin))
      assert.equal(getThemeEditorSwatch(imported), getThemeEditorSwatch(builtin))
    }
  })

  it('uses safe appearance values for imported themes and the live preview', () => {
    const appearance = {
      ruledPaper: true,
      outlinedTabs: 'true',
      ruleGap: 600,
      ruleColor: '#bacdef',
      tabBorder: 'red; invalid-css',
      unknown: 'value',
    }
    const imported = parseSingleTheme({ name: 'Custom', appearance })
    assert.deepEqual(imported?.appearance, { ruledPaper: true, ruleGap: 60, ruleColor: '#bacdef' })
    const css = generateCssVariables({ ...LIGHT_THEME, appearance: { ruleGap: 36, ruleColor: 'red; invalid-css' } })
    assert.match(css, /--theme-rule-gap: 0.36em/)
    assert.doesNotMatch(css, /invalid-css/)
    assert.equal(parseSingleTheme({ name: 'Legacy' })?.appearance, undefined)
  })

  it('should have properly structured built-in dark and light themes', () => {
    assert.equal(DARK_THEME.id, 'dark')
    assert.equal(DARK_THEME.isBuiltin, true)
    assert.equal(DARK_THEME.baseTheme, 'dark')
    assert.ok(DARK_THEME.colors.bgBase)
    assert.ok(DARK_THEME.colors.textPrimary)
    assert.ok(DARK_THEME.typography.fontFamilyUi)

    assert.equal(LIGHT_THEME.id, 'light')
    assert.equal(LIGHT_THEME.isBuiltin, true)
    assert.equal(LIGHT_THEME.baseTheme, 'light')
    assert.ok(LIGHT_THEME.colors.bgBase)
    assert.ok(LIGHT_THEME.colors.textPrimary)
  })

  it('should generate all required CSS variables from a theme', () => {
    const css = generateCssVariables(DARK_THEME)

    // Base tokens & UI
    assert.ok(css.includes(`--bg-base: ${DARK_COLORS.bgBase}`))
    assert.ok(css.includes(`--bg-surface: ${DARK_COLORS.bgSurface}`))
    assert.ok(css.includes(`--text-primary: ${DARK_COLORS.textPrimary}`))
    assert.ok(css.includes(`--accent: ${DARK_COLORS.accent}`))
    assert.ok(css.includes('--text-danger:'))
    assert.ok(css.includes('--scrollbar-thumb:'))
    assert.ok(css.includes('--tooltip-bg:'))

    // Typography
    assert.ok(css.includes('--font-ui:'))
    assert.ok(css.includes('--font-editor:'))
    assert.ok(css.includes('--font-code:'))
    assert.ok(css.includes(`--theme-editor-font-size: ${DEFAULT_TYPOGRAPHY.fontSizeEditor}px;`))
    assert.ok(css.includes(`--editor-line-height: ${DEFAULT_TYPOGRAPHY.lineHeightEditor};`))

    // Editor & Code
    assert.ok(css.includes('--editor-text:'))
    assert.ok(css.includes('--editor-syntax:'))
    assert.ok(css.includes('--editor-hr:'))
    assert.ok(css.includes('--editor-strike:'))
    assert.ok(css.includes('--codeblock-bg:'))
    assert.ok(css.includes('--hljs-keyword:'))
    assert.ok(css.includes('--hljs-string:'))

    // Tables & Math
    assert.ok(css.includes('--table-border:'))
    assert.ok(css.includes('--table-header-bg:'))
    assert.ok(css.includes('--math-block-editor-bg:'))
    assert.ok(css.includes('--math-render:'))

    // Global selection
    assert.ok(css.includes('::selection'))
    assert.ok(css.includes('--menu-hover-bg:'))
  })

  it('validateThemeJson should parse a single valid theme object', () => {
    const customJson = {
      id: 'custom_nord',
      name: 'Nord Theme',
      baseTheme: 'dark',
      colors: {
        bgBase: '#2e3440',
        bgSurface: '#3b4252',
        textPrimary: '#eceff4',
        accent: '#88c0d0',
      },
      typography: {
        fontSizeEditor: 16,
      },
    }

    const parsed = validateThemeJson(customJson)
    assert.ok(parsed)
    assert.equal(parsed.length, 1)
    assert.equal(parsed[0].id, 'custom_nord')
    assert.equal(parsed[0].name, 'Nord Theme')
    assert.equal(parsed[0].colors.bgBase, '#2e3440')
    assert.equal(parsed[0].colors.accent, '#88c0d0')
    // Fallback filled
    assert.equal(parsed[0].colors.bgElevated, DARK_COLORS.bgElevated)
    assert.equal(parsed[0].typography.fontSizeEditor, 16)
    assert.equal(parsed[0].typography.lineHeightEditor, DEFAULT_TYPOGRAPHY.lineHeightEditor)
  })

  it('validateThemeJson should parse an array of theme objects', () => {
    const arrayJson = [
      { id: 'theme1', name: 'Theme 1', colors: { bgBase: '#111111' } },
      { id: 'theme2', name: 'Theme 2', colors: { bgBase: '#222222' } },
    ]

    const parsed = validateThemeJson(arrayJson)
    assert.ok(parsed)
    assert.equal(parsed.length, 2)
    assert.equal(parsed[0].name, 'Theme 1')
    assert.equal(parsed[1].name, 'Theme 2')
    assert.equal(parsed[0].colors.bgBase, '#111111')
    assert.equal(parsed[1].colors.bgBase, '#222222')
  })

  it('validateThemeJson should return null for invalid data', () => {
    assert.equal(validateThemeJson(null), null)
    assert.equal(validateThemeJson('not json string'), null)
    assert.equal(validateThemeJson(12345), null)
    assert.equal(validateThemeJson([]), null)
    assert.equal(validateThemeJson([{ id: 'no_name' }]), null)
  })

  it('validateThemeJson should generate an ID if not present in custom theme', () => {
    const noIdJson = {
      name: 'Dracula',
      colors: { bgBase: '#282a36' },
    }
    const parsed = validateThemeJson(noIdJson)
    assert.ok(parsed)
    assert.equal(parsed.length, 1)
    assert.ok(parsed[0].id.startsWith('custom_'))
  })

  it('parseSingleTheme should use light fallbacks if baseTheme is light', () => {
    const lightJson = {
      name: 'Solarized Light',
      baseTheme: 'light',
      colors: {
        bgBase: '#fdf6e3',
      },
    }
    const parsed = parseSingleTheme(lightJson)
    assert.ok(parsed)
    assert.equal(parsed.baseTheme, 'light')
    assert.equal(parsed.colors.bgBase, '#fdf6e3')
    assert.equal(parsed.colors.bgSurface, LIGHT_COLORS.bgSurface)
  })
})
