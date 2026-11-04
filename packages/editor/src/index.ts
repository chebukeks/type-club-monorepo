export { EditorCore, injectEditorStyles } from "./EditorCore";

export { schema } from "./editor/schema";
export { parseMarkdown, serializeMarkdown, generateExportHtml } from "./editor/markdownConfig";
export { htmlToMarkdown, isMeaningfulHtml } from "./editor/htmlToMarkdown";
export { getEditorStyles } from "./editor/editorTheme";
export {
  getKeymapPlugins,
  universalExitCommand,
  undoCommand,
  redoCommand,
  indentListCommand,
  outdentListCommand,
  setHeadingLevel,
  isInList,
  isInTable,
  isInCodeBlock,
  isInExitableBlock,
  getActiveHeadingLevel,
  getListType,
  isInBlockquote,
  isMarkActive,
  hasActiveInlineMarks,
  canExit,
  isInMath,
} from "./editor/keymap";
export { getInputRulesPlugin } from "./editor/inputRules";
export { seamlessPlugin } from "./editor/seamlessPlugin";
export { linkTooltipPlugin } from "./editor/linkTooltipPlugin";
export { mathActivePlugin } from "./editor/mathActivePlugin";
export { foldingPlugin } from "./editor/foldingPlugin";
export { interactivePlugin } from "./editor/interactivePlugin";
export { focusModePlugin } from "./editor/focusModePlugin";
export { syntaxHighlightPlugin } from "./editor/syntaxHighlightPlugin";
export { tocPlugin } from "./editor/tocPlugin";
export { typographyPlugin } from "./editor/typographyPlugin";

export { CodeBlockView } from "./editor/codeBlockView";
export { HeadingView, headingToSlug } from "./editor/headingView";
export { ImageView } from "./editor/imageView";
export {
  parseVideoEmbed,
  isVideoUrl,
  parseYouTubeUrl,
  parseVkVideoUrl,
  parseRutubeUrl,
  parseTwitchUrl,
  parseVimeoUrl,
  parseDzenUrl,
} from "./editor/videoUtils";
export type { VideoEmbedInfo } from "./editor/videoUtils";
export { MathBlockView } from "./editor/mathBlockView";
export { MathInlineView } from "./editor/mathInlineView";
export { tableEditPlugin, tableEditPluginKey } from "./editor/tableEditPlugin";
export { pastePlugin, pastePluginKey, BLOCK_PASTE_NODES } from "./editor/pastePlugin";
export { createCollaborationPlugins } from "./editor/collaborationPlugin";
export { spellcheckPlugin, spellcheckPluginKey } from "./editor/spellcheckPlugin";
export { spellcheckService } from "./editor/spellcheckService";

export { seedYFragmentFromMarkdown, yFragmentToMarkdown } from "./editor/collabSync";
export {
  generateSuggestionId,
  createSuggestionTags,
  parseSuggestionsFromMarkdown,
  applySuggestionDecision,
  getCleanMarkdown,
  proposeSuggestionInMarkdown,
} from "./editor/suggestionUtils";
export type { ParsedSuggestion, CreateSuggestionOptions } from "./editor/suggestionUtils";

export type { EditorMode, EditorProps, FocusMode, TocItem, SuggestionItem, CollaborationConfig } from "./types";
export * from "./i18n";
