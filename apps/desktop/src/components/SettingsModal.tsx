import { useState, useEffect, useRef, useMemo } from "react";
import { useEditor } from "../context/EditorContext";
import {
  Palette,
  Globe,
  Keyboard,
  X,
  Sparkles,
  Check,
  Plus,
  Download,
  Upload,
  RotateCcw,
  Save,
  Type,
  Code2,
  Layout,
  FileText,
  Table,
} from "lucide-react";
import type { Locale } from "@type-club/editor";
import type { AppTheme, ThemeColors, ThemeTypography } from "../types";
import { DARK_THEME, LIGHT_THEME } from "../utils/themePresets";

interface SettingsModalProps {
  onClose: () => void;
}

type SettingsTab = "theme" | "language" | "shortcuts";
type ThemeCategory = "ui" | "editor" | "code" | "tables" | "typography";

export function SettingsModal({ onClose }: SettingsModalProps) {
  const {
    state,
    setTheme,
    setLanguage,
    t,
    saveCustomTheme,
    deleteCustomTheme,
    exportTheme,
    importThemes,
    applyLiveTheme,
  } = useEditor();

  const [activeTab, setActiveTab] = useState<SettingsTab>("language");
  const [closing, setClosing] = useState(false);
  const overlayMouseDownRef = useRef(false);

  // --- Dictionaries & Custom Words State ---
  const [spellcheckLangs, setSpellcheckLangs] = useState<string[]>(["ru-RU", "en-US"]);
  const [customWords, setCustomWords] = useState<string[]>([]);
  const [newWordInput, setNewWordInput] = useState("");

  // Live filter custom words based on input text (search & add)
  const filteredWords = useMemo(() => {
    const query = newWordInput.trim().toLowerCase();
    if (!query) return customWords;
    return customWords.filter((w) => w.toLowerCase().includes(query));
  }, [customWords, newWordInput]);

  const isWordAlreadyAdded = useMemo(() => {
    const trimmed = newWordInput.trim().toLowerCase();
    if (!trimmed) return false;
    return customWords.some((w) => w.toLowerCase() === trimmed);
  }, [customWords, newWordInput]);

  // --- Theme Editor State ---
  const [activeThemeCategory, setActiveThemeCategory] = useState<ThemeCategory>("ui");
  const [draftTheme, setDraftTheme] = useState<AppTheme>(() => {
    return state.activeTheme || (state.theme === "light" ? LIGHT_THEME : DARK_THEME);
  });
  const [themeStatusMessage, setThemeStatusMessage] = useState<string | null>(null);

  // Sync draftTheme whenever state.activeTheme changes externally
  useEffect(() => {
    if (state.activeTheme) {
      setDraftTheme({ ...state.activeTheme });
    }
  }, [state.activeTheme]);

  // Load initial spellchecker languages and custom words
  useEffect(() => {
    window.api
      .getSpellcheckLanguages()
      .then((langs) => {
        if (Array.isArray(langs)) setSpellcheckLangs(langs);
      })
      .catch(() => {});

    window.api
      .getCustomDictionaryWords()
      .then((words) => {
        if (Array.isArray(words)) setCustomWords(words);
      })
      .catch(() => {});
  }, []);

  const handleClose = () => {
    setClosing(true);
    setTimeout(onClose, 100);
  };

  const handleOverlayMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    overlayMouseDownRef.current = e.target === e.currentTarget;
  };

  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget && overlayMouseDownRef.current) {
      handleClose();
    }
    overlayMouseDownRef.current = false;
  };

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleToggleDictLang = async (langCode: string) => {
    const next = spellcheckLangs.includes(langCode)
      ? spellcheckLangs.filter((l) => l !== langCode)
      : [...spellcheckLangs, langCode];
    setSpellcheckLangs(next);
    await window.api.setSpellcheckLanguages(next);
  };

  const handleAddCustomWord = async () => {
    const trimmed = newWordInput.trim();
    if (!trimmed) return;
    if (!customWords.includes(trimmed)) {
      setCustomWords((prev) => [...prev, trimmed]);
      await window.api.addCustomWord(trimmed);
    }
    setNewWordInput("");
  };

  const handleRemoveCustomWord = async (word: string) => {
    setCustomWords((prev) => prev.filter((w) => w !== word));
    await window.api.removeCustomWord(word);
  };

  // --- Theme Actions ---
  const handleSelectTheme = (theme: AppTheme) => {
    setTheme(theme.id, theme);
    setDraftTheme({ ...theme });
  };

  const handleUpdateDraftColor = (key: keyof ThemeColors, value: string) => {
    setDraftTheme((prev) => {
      const updated: AppTheme = {
        ...prev,
        colors: {
          ...prev.colors,
          [key]: value,
        },
      };
      applyLiveTheme(updated);
      return updated;
    });
  };

  const handleUpdateDraftTypography = <K extends keyof ThemeTypography>(
    key: K,
    value: ThemeTypography[K]
  ) => {
    setDraftTheme((prev) => {
      const updated: AppTheme = {
        ...prev,
        typography: {
          ...prev.typography,
          [key]: value,
        },
      };
      applyLiveTheme(updated);
      return updated;
    });
  };

  const handleSaveTheme = async () => {
    let name = draftTheme.name.trim();
    if (!name) {
      name = "Custom Theme";
    }

    const isCurrentlyBuiltin = draftTheme.isBuiltin || draftTheme.id === "dark" || draftTheme.id === "light";

    let finalTheme: AppTheme;
    if (isCurrentlyBuiltin) {
      const copyName = name === "Тёмная" || name === "Dark" || name === "Светлая" || name === "Light"
        ? `${name} (Копия)`
        : name;
      finalTheme = {
        ...draftTheme,
        id: `custom_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        name: copyName,
        isBuiltin: false,
      };
    } else {
      finalTheme = {
        ...draftTheme,
        name,
        isBuiltin: false,
      };
    }

    await saveCustomTheme(finalTheme);
    setTheme(finalTheme.id, finalTheme);
    setDraftTheme({ ...finalTheme });
    showThemeToast(t("settings.theme.saved"));
  };

  const handleResetTheme = () => {
    const original = state.activeTheme || (state.theme === "light" ? LIGHT_THEME : DARK_THEME);
    setDraftTheme({ ...original });
    applyLiveTheme(original);
  };

  const handleExportTheme = async () => {
    const success = await exportTheme(draftTheme);
    if (success) {
      showThemeToast(t("settings.theme.exportSuccess"));
    }
  };

  const handleImportThemes = async () => {
    const imported = await importThemes();
    if (imported && imported.length > 0) {
      showThemeToast(t("settings.theme.imported"));
    }
  };

  const handleDeleteTheme = async (theme: AppTheme) => {
    if (window.confirm(t("settings.theme.deleteConfirm", { name: theme.name }))) {
      await deleteCustomTheme(theme.id);
    }
  };

  const showThemeToast = (msg: string) => {
    setThemeStatusMessage(msg);
    setTimeout(() => setThemeStatusMessage(null), 2500);
  };

  const tabs: { key: SettingsTab; label: string; icon: typeof Globe; desc: string }[] = [
    {
      key: "language",
      label: t("settings.tab.language"),
      icon: Globe,
      desc: t("settings.tab.languageDesc"),
    },
    {
      key: "theme",
      label: t("settings.tab.theme"),
      icon: Palette,
      desc: t("settings.tab.themeDesc"),
    },
    {
      key: "shortcuts",
      label: t("settings.tab.shortcuts"),
      icon: Keyboard,
      desc: t("settings.tab.shortcutsDesc"),
    },
  ];

  const currentTabInfo = tabs.find((tItem) => tItem.key === activeTab) || tabs[0];

  const allBuiltinThemes: AppTheme[] = useMemo(() => [
    { ...DARK_THEME, name: t("settings.theme.themeDark") },
    { ...LIGHT_THEME, name: t("settings.theme.themeLight") },
  ], [t]);

  return (
    <div
      className={`modal-overlay ${activeTab === "theme" ? "no-blur" : ""} ${
        closing
          ? "animate-out fade-out duration-100 ease-in fill-mode-forwards"
          : "animate-in fade-in duration-150 ease-out"
      }`}
      onMouseDown={handleOverlayMouseDown}
      onClick={handleOverlayClick}
    >
      <div
        className={`modal-panel ${activeTab === "theme" ? "no-shadow" : ""} ${
          closing
            ? "animate-out fade-out zoom-out-95 duration-100 ease-in fill-mode-forwards"
            : "animate-in fade-in zoom-in-95 duration-150 ease-out"
        }`}
        style={{
          width: "100%",
          maxWidth: "940px",
          height: "700px",
          maxHeight: "92vh",
          padding: 0,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between select-none"
          style={{ padding: "16px 20px 10px 20px" }}
        >
          <div className="flex items-center gap-2">
            <h2 className="text-[14px] font-semibold text-[var(--text-primary)]">
              {t("settings.modalTitle")}
            </h2>
            {themeStatusMessage && (
              <span className="text-[11px] text-[var(--accent)] font-medium animate-in fade-in duration-150">
                • {themeStatusMessage}
              </span>
            )}
          </div>
          <button
            onClick={handleClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors"
            title={t("common.close")}
          >
            <X size={15} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Vertical Tabs */}
          <div
            className="bg-[var(--bg-elevated)] flex flex-col select-none"
            style={{ width: "210px", padding: "12px", flexShrink: 0 }}
          >
            <div
              className="flex flex-col rounded-lg bg-[var(--bg-surface)]"
              style={{ padding: "3px", gap: "3px" }}
            >
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.key;
                return (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={`flex items-center rounded-md transition-all border text-left text-[12.5px] font-medium ${
                      isActive
                        ? "bg-[var(--bg-base)] text-[var(--text-primary)] shadow-xs border-[var(--border-default)]"
                        : "text-[var(--text-dim)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] border-transparent"
                    }`}
                    style={{ padding: "8px 12px", gap: "10px" }}
                  >
                    <Icon
                      size={15}
                      className={isActive ? "text-[var(--accent)]" : "text-[var(--text-dim)]"}
                    />
                    <span className="truncate">{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right Content Area (Rounded window matching the app's editor container) */}
          <div
            className="flex-1 flex flex-col overflow-hidden bg-[var(--bg-elevated)]"
            style={{ padding: "0 12px 12px 0" }}
          >
            <div
              className="flex-1 overflow-y-auto rounded-xl border border-[var(--border-default)] shadow-xs bg-[var(--bg-base)] flex flex-col relative isolate"
              style={{ backgroundClip: "padding-box", padding: "18px 24px" }}
            >
              <div className="select-none" style={{ marginBottom: "16px" }}>
                <h3 className="text-base font-semibold text-[var(--text-primary)]">
                  {currentTabInfo.label}
                </h3>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">
                  {currentTabInfo.desc}
                </p>
              </div>

              {/* TAB: THEME SETTINGS & EDITOR */}
              {activeTab === "theme" && (
                <div className="flex flex-col select-none" style={{ gap: "22px" }}>
                  {/* 1. Built-in Themes */}
                  <div>
                    <div
                      className="text-[12px] font-semibold uppercase tracking-wider text-[var(--text-muted)]"
                      style={{ marginBottom: "8px" }}
                    >
                      {t("settings.theme.builtIn")}
                    </div>
                    <div
                      className="flex flex-col rounded-xl bg-[var(--bg-surface)] overflow-hidden"
                      style={{ padding: "4px" }}
                    >
                      {allBuiltinThemes.map((bTheme) => {
                        const isSelected = state.theme === bTheme.id;
                        return (
                          <div
                            key={bTheme.id}
                            onClick={() => handleSelectTheme(bTheme)}
                            className="flex items-center justify-between rounded-lg cursor-pointer transition-colors hover:bg-[var(--bg-hover)]"
                            style={{ padding: "9px 14px" }}
                          >
                            <div className="flex items-center gap-2.5">
                              <div
                                className="w-3.5 h-3.5 rounded-full border border-black/10 shadow-xs"
                                style={{ backgroundColor: bTheme.colors.bgBase }}
                              />
                              <span className="text-[13px] text-[var(--text-primary)] font-medium">
                                {bTheme.name}
                              </span>
                            </div>
                            <div
                              className={`w-4 h-4 rounded-full border flex items-center justify-center transition-colors ${
                                isSelected
                                  ? "bg-[var(--accent)] border-[var(--accent)] text-white"
                                  : "border-[var(--border-strong)] bg-[var(--bg-base)]"
                              }`}
                            >
                              {isSelected && <Check size={11} strokeWidth={3} />}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* 2. Custom Themes List */}
                  <div>
                    <div
                      className="flex items-center justify-between"
                      style={{ marginBottom: "8px" }}
                    >
                      <span className="text-[12px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                        {t("settings.theme.custom")}
                      </span>
                      <button
                        onClick={handleImportThemes}
                        className="flex items-center gap-1 text-[11.5px] font-medium text-[var(--accent)] hover:underline"
                      >
                        <Upload size={13} />
                        <span>{t("settings.theme.import")}</span>
                      </button>
                    </div>

                    <div
                      className="flex flex-col rounded-xl bg-[var(--bg-surface)] overflow-hidden"
                      style={{ padding: "4px" }}
                    >
                      {state.customThemes.length === 0 ? (
                        <div
                          className="text-center text-[12px] text-[var(--text-dim)]"
                          style={{ padding: "16px 12px" }}
                        >
                          {t("settings.theme.noCustomThemes")}
                        </div>
                      ) : (
                        state.customThemes.map((cTheme) => {
                          const isSelected = state.theme === cTheme.id;
                          return (
                            <div
                              key={cTheme.id}
                              className="flex items-center justify-between rounded-lg transition-colors hover:bg-[var(--bg-hover)] group cursor-pointer"
                              style={{ padding: "8px 12px" }}
                              onClick={() => handleSelectTheme(cTheme)}
                            >
                              <div className="flex items-center gap-2.5 flex-1 min-w-0">
                                <div
                                  className="w-3.5 h-3.5 rounded-full border border-black/10 shadow-xs shrink-0"
                                  style={{ backgroundColor: cTheme.colors.bgBase }}
                                />
                                <span className="text-[13px] text-[var(--text-primary)] font-medium truncate">
                                  {cTheme.name}
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <div
                                  className={`w-4 h-4 rounded-full border flex items-center justify-center transition-colors ${
                                    isSelected
                                      ? "bg-[var(--accent)] border-[var(--accent)] text-white"
                                      : "border-[var(--border-strong)] bg-[var(--bg-base)]"
                                  }`}
                                >
                                  {isSelected && <Check size={11} strokeWidth={3} />}
                                </div>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteTheme(cTheme);
                                  }}
                                  className="w-6 h-6 flex items-center justify-center rounded text-[var(--text-dim)] hover:text-red-400 hover:bg-red-500/10 transition-colors"
                                  title={t("common.delete")}
                                >
                                  <X size={14} />
                                </button>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>

                  {/* 3. Theme Editor */}
                  <div>
                    <div
                      className="text-[12px] font-semibold uppercase tracking-wider text-[var(--text-muted)]"
                      style={{ marginBottom: "8px" }}
                    >
                      {t("settings.theme.editor")}
                    </div>

                    <div
                      className="flex flex-col rounded-xl bg-[var(--bg-surface)] overflow-hidden"
                      style={{ padding: "12px", gap: "12px" }}
                    >
                      {/* Theme Name input */}
                      <div>
                        <div className="text-[11px] text-[var(--text-dim)] mb-1">
                          {t("settings.theme.themeName")}
                        </div>
                        <input
                          type="text"
                          value={draftTheme.name}
                          onChange={(e) =>
                            setDraftTheme((prev) => ({ ...prev, name: e.target.value }))
                          }
                          placeholder={t("settings.theme.themeNamePlaceholder")}
                          className="w-full rounded-lg bg-[var(--bg-base)] border border-[var(--border-default)] text-[13px] text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
                          style={{ padding: "7px 12px" }}
                        />
                        {(draftTheme.isBuiltin || draftTheme.id === "dark" || draftTheme.id === "light") && (
                          <div className="text-[11px] text-[var(--text-muted)] mt-1 opacity-80">
                            {t("settings.theme.cantOverwriteBuiltin")}
                          </div>
                        )}
                      </div>

                      {/* Category Selector Tabs */}
                      <div
                        className="flex rounded-lg bg-[var(--bg-base)]"
                        style={{ padding: "3px", gap: "3px" }}
                      >
                        {[
                          { key: "ui" as ThemeCategory, label: t("settings.theme.groupUi"), icon: Layout },
                          { key: "editor" as ThemeCategory, label: t("settings.theme.groupEditor"), icon: FileText },
                          { key: "code" as ThemeCategory, label: t("settings.theme.groupCode"), icon: Code2 },
                          { key: "tables" as ThemeCategory, label: t("settings.theme.groupTables"), icon: Table },
                          { key: "typography" as ThemeCategory, label: t("settings.theme.groupTypography"), icon: Type },
                        ].map((cat) => {
                          const Icon = cat.icon;
                          const isCatActive = activeThemeCategory === cat.key;
                          return (
                            <button
                              key={cat.key}
                              onClick={() => setActiveThemeCategory(cat.key)}
                              className={`flex-1 flex items-center justify-center gap-1.5 rounded-md text-[11.5px] font-medium transition-all ${
                                isCatActive
                                  ? "bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-xs"
                                  : "text-[var(--text-dim)] hover:text-[var(--text-secondary)]"
                              }`}
                              style={{ padding: "6px 8px" }}
                            >
                              <Icon size={13} />
                              <span>{cat.label}</span>
                            </button>
                          );
                        })}
                      </div>

                      {/* Category: UI Colors */}
                      {activeThemeCategory === "ui" && (
                        <div className="grid grid-cols-2 gap-2" style={{ maxHeight: "240px", overflowY: "auto", paddingRight: "4px" }}>
                          {[
                            { key: "bgBase" as keyof ThemeColors, label: t("settings.theme.bgBase") },
                            { key: "bgSurface" as keyof ThemeColors, label: t("settings.theme.bgSurface") },
                            { key: "bgElevated" as keyof ThemeColors, label: t("settings.theme.bgElevated") },
                            { key: "bgHover" as keyof ThemeColors, label: t("settings.theme.bgHover") },
                            { key: "bgActive" as keyof ThemeColors, label: t("settings.theme.bgActive") },
                            { key: "bgInput" as keyof ThemeColors, label: t("settings.theme.bgInput") },
                            { key: "borderDefault" as keyof ThemeColors, label: t("settings.theme.borderDefault") },
                            { key: "borderStrong" as keyof ThemeColors, label: t("settings.theme.borderStrong") },
                            { key: "textPrimary" as keyof ThemeColors, label: t("settings.theme.textPrimary") },
                            { key: "textSecondary" as keyof ThemeColors, label: t("settings.theme.textSecondary") },
                            { key: "textMuted" as keyof ThemeColors, label: t("settings.theme.textMuted") },
                            { key: "textDim" as keyof ThemeColors, label: t("settings.theme.textDim") },
                            { key: "menuHoverBg" as keyof ThemeColors, label: t("settings.theme.menuHoverBg") },
                            { key: "accent" as keyof ThemeColors, label: t("settings.theme.accent") },
                            { key: "accentHover" as keyof ThemeColors, label: t("settings.theme.accentHover") },
                            { key: "textDanger" as keyof ThemeColors, label: t("settings.theme.textDanger") },
                          ].map((c) => (
                            <ColorControl
                              key={c.key}
                              label={c.label}
                              value={draftTheme.colors[c.key]}
                              onChange={(val) => handleUpdateDraftColor(c.key, val)}
                            />
                          ))}
                        </div>
                      )}

                      {/* Category: Editor Colors */}
                      {activeThemeCategory === "editor" && (
                        <div className="grid grid-cols-2 gap-2" style={{ maxHeight: "240px", overflowY: "auto", paddingRight: "4px" }}>
                          {[
                            { key: "editorText" as keyof ThemeColors, label: t("settings.theme.editorText") },
                            { key: "editorCaret" as keyof ThemeColors, label: t("settings.theme.editorCaret") },
                            { key: "editorSelection" as keyof ThemeColors, label: t("settings.theme.editorSelection") },
                            { key: "editorHeading" as keyof ThemeColors, label: t("settings.theme.editorHeading") },
                            { key: "editorLink" as keyof ThemeColors, label: t("settings.theme.editorLink") },
                            { key: "editorSyntax" as keyof ThemeColors, label: t("settings.theme.editorSyntax") },
                            { key: "editorHr" as keyof ThemeColors, label: t("settings.theme.editorHr") },
                            { key: "editorStrike" as keyof ThemeColors, label: t("settings.theme.editorStrike") },
                            { key: "editorCodeBg" as keyof ThemeColors, label: t("settings.theme.editorCodeBg") },
                            { key: "editorCodeText" as keyof ThemeColors, label: t("settings.theme.editorCodeText") },
                            { key: "editorMarkBg" as keyof ThemeColors, label: t("settings.theme.editorMarkBg") },
                            { key: "editorMarkText" as keyof ThemeColors, label: t("settings.theme.editorMarkText") },
                            { key: "editorBlockquoteBorder" as keyof ThemeColors, label: t("settings.theme.editorBlockquoteBorder") },
                            { key: "editorBlockquoteText" as keyof ThemeColors, label: t("settings.theme.editorBlockquoteText") },
                            { key: "editorBlockquoteBg" as keyof ThemeColors, label: t("settings.theme.editorBlockquoteBg") },
                          ].map((c) => (
                            <ColorControl
                              key={c.key}
                              label={c.label}
                              value={draftTheme.colors[c.key]}
                              onChange={(val) => handleUpdateDraftColor(c.key, val)}
                            />
                          ))}
                        </div>
                      )}

                      {/* Category: Code & Syntax Highlighting */}
                      {activeThemeCategory === "code" && (
                        <div className="grid grid-cols-2 gap-2" style={{ maxHeight: "240px", overflowY: "auto", paddingRight: "4px" }}>
                          {[
                            { key: "codeblockBg" as keyof ThemeColors, label: t("settings.theme.codeblockBg") },
                            { key: "codeblockBorder" as keyof ThemeColors, label: t("settings.theme.codeblockBorder") },
                            { key: "codeblockText" as keyof ThemeColors, label: t("settings.theme.codeblockText") },
                            { key: "codeblockLang" as keyof ThemeColors, label: t("settings.theme.codeblockLang") },
                            { key: "hljsKeyword" as keyof ThemeColors, label: t("settings.theme.hljsKeyword") },
                            { key: "hljsString" as keyof ThemeColors, label: t("settings.theme.hljsString") },
                            { key: "hljsTitle" as keyof ThemeColors, label: t("settings.theme.hljsTitle") },
                            { key: "hljsNumber" as keyof ThemeColors, label: t("settings.theme.hljsNumber") },
                            { key: "hljsComment" as keyof ThemeColors, label: t("settings.theme.hljsComment") },
                          ].map((c) => (
                            <ColorControl
                              key={c.key}
                              label={c.label}
                              value={draftTheme.colors[c.key]}
                              onChange={(val) => handleUpdateDraftColor(c.key, val)}
                            />
                          ))}
                        </div>
                      )}

                      {/* Category: Tables */}
                      {activeThemeCategory === "tables" && (
                        <div className="grid grid-cols-2 gap-2" style={{ maxHeight: "240px", overflowY: "auto", paddingRight: "4px" }}>
                          {[
                            { key: "tableBorder" as keyof ThemeColors, label: t("settings.theme.tableBorder") },
                            { key: "tableHeaderBg" as keyof ThemeColors, label: t("settings.theme.tableHeaderBg") },
                            { key: "tableHeaderText" as keyof ThemeColors, label: t("settings.theme.tableHeaderText") },
                            { key: "tableCellBg" as keyof ThemeColors, label: t("settings.theme.tableCellBg") },
                            { key: "tableCellText" as keyof ThemeColors, label: t("settings.theme.tableCellText") },
                            { key: "tableEvenBg" as keyof ThemeColors, label: t("settings.theme.tableEvenBg") },
                            { key: "tableSelected" as keyof ThemeColors, label: t("settings.theme.tableSelected") },
                          ].map((c) => (
                            <ColorControl
                              key={c.key}
                              label={c.label}
                              value={draftTheme.colors[c.key]}
                              onChange={(val) => handleUpdateDraftColor(c.key, val)}
                            />
                          ))}
                        </div>
                      )}

                      {/* Category: Typography & Fonts */}
                      {activeThemeCategory === "typography" && (
                        <div className="flex flex-col gap-3" style={{ maxHeight: "240px", overflowY: "auto", paddingRight: "4px" }}>
                          {/* UI Font */}
                          <div>
                            <div className="text-[11px] text-[var(--text-dim)] mb-1">
                              {t("settings.theme.fontUi")}
                            </div>
                            <select
                              value={draftTheme.typography.fontFamilyUi}
                              onChange={(e) => handleUpdateDraftTypography("fontFamilyUi", e.target.value)}
                              className="w-full rounded-lg bg-[var(--bg-base)] border border-[var(--border-default)] text-[12.5px] text-[var(--text-primary)] outline-none"
                              style={{ padding: "6px 10px" }}
                            >
                              <option value="'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif">Inter (Default)</option>
                              <option value="'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif">Segoe UI</option>
                              <option value="'Roboto', sans-serif">Roboto</option>
                              <option value="system-ui, -apple-system, sans-serif">System UI</option>
                            </select>
                          </div>

                          {/* Editor Font */}
                          <div>
                            <div className="text-[11px] text-[var(--text-dim)] mb-1">
                              {t("settings.theme.fontEditor")}
                            </div>
                            <select
                              value={draftTheme.typography.fontFamilyEditor}
                              onChange={(e) => handleUpdateDraftTypography("fontFamilyEditor", e.target.value)}
                              className="w-full rounded-lg bg-[var(--bg-base)] border border-[var(--border-default)] text-[12.5px] text-[var(--text-primary)] outline-none"
                              style={{ padding: "6px 10px" }}
                            >
                              <option value="'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif">Inter (Sans-Serif)</option>
                              <option value="'Georgia', serif">Georgia (Serif)</option>
                              <option value="'Merriweather', serif">Merriweather (Serif)</option>
                              <option value="'Lora', serif">Lora (Serif)</option>
                              <option value="'PT Serif', serif">PT Serif (Serif)</option>
                              <option value="'PT Sans', sans-serif">PT Sans</option>
                            </select>
                          </div>

                          {/* Code Font */}
                          <div>
                            <div className="text-[11px] text-[var(--text-dim)] mb-1">
                              {t("settings.theme.fontCode")}
                            </div>
                            <select
                              value={draftTheme.typography.fontFamilyCode}
                              onChange={(e) => handleUpdateDraftTypography("fontFamilyCode", e.target.value)}
                              className="w-full rounded-lg bg-[var(--bg-base)] border border-[var(--border-default)] text-[12.5px] text-[var(--text-primary)] outline-none"
                              style={{ padding: "6px 10px" }}
                            >
                              <option value="'Fira Code', 'Consolas', 'Monaco', 'Courier New', monospace">Fira Code</option>
                              <option value="'JetBrains Mono', monospace">JetBrains Mono</option>
                              <option value="'Consolas', monospace">Consolas</option>
                              <option value="'Courier New', monospace">Courier New</option>
                            </select>
                          </div>

                          {/* Editor Font Size & Line Height */}
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <div className="flex items-center justify-between text-[11px] text-[var(--text-dim)] mb-1">
                                <span>{t("settings.theme.fontSize")}</span>
                                <span className="font-mono text-[var(--text-secondary)]">{draftTheme.typography.fontSizeEditor}px</span>
                              </div>
                              <input
                                type="range"
                                min={12}
                                max={24}
                                step={1}
                                value={draftTheme.typography.fontSizeEditor}
                                onChange={(e) => handleUpdateDraftTypography("fontSizeEditor", Number(e.target.value))}
                                className="w-full accent-[var(--accent)]"
                              />
                            </div>

                            <div>
                              <div className="flex items-center justify-between text-[11px] text-[var(--text-dim)] mb-1">
                                <span>{t("settings.theme.lineHeight")}</span>
                                <span className="font-mono text-[var(--text-secondary)]">{draftTheme.typography.lineHeightEditor}</span>
                              </div>
                              <input
                                type="range"
                                min={1.2}
                                max={2.2}
                                step={0.1}
                                value={draftTheme.typography.lineHeightEditor}
                                onChange={(e) => handleUpdateDraftTypography("lineHeightEditor", Number(e.target.value))}
                                className="w-full accent-[var(--accent)]"
                              />
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Action Buttons */}
                      <div
                        className="flex items-center justify-between gap-2"
                        style={{ marginTop: "8px" }}
                      >
                        <div className="flex items-center gap-2">
                          <button
                            onClick={handleSaveTheme}
                            className="flex items-center gap-1.5 rounded-lg bg-[var(--accent)] text-white text-[12px] font-medium hover:opacity-90 transition-all shadow-xs cursor-pointer"
                            style={{ padding: "6px 14px" }}
                          >
                            <Save size={13} />
                            <span>{t("settings.theme.save")}</span>
                          </button>
                          <button
                            onClick={handleResetTheme}
                            className="flex items-center gap-1.5 rounded-lg bg-[var(--bg-hover)] text-[var(--text-secondary)] text-[12px] font-medium hover:bg-[var(--bg-active)] transition-all cursor-pointer"
                            style={{ padding: "6px 12px" }}
                          >
                            <RotateCcw size={13} />
                            <span>{t("settings.theme.reset")}</span>
                          </button>
                        </div>

                        <button
                          onClick={handleExportTheme}
                          className="flex items-center gap-1.5 rounded-lg bg-[var(--bg-hover)] text-[var(--text-secondary)] text-[12px] font-medium hover:bg-[var(--bg-active)] transition-all cursor-pointer"
                          style={{ padding: "6px 12px" }}
                        >
                          <Download size={13} />
                          <span>{t("settings.theme.export")}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB: LANGUAGE & DICTIONARIES */}
              {activeTab === "language" && (
                <div className="flex flex-col select-none" style={{ gap: "20px" }}>
                  {/* 1. Interface Language */}
                  <div>
                    <div
                      className="text-[12px] font-semibold uppercase tracking-wider text-[var(--text-muted)]"
                      style={{ marginBottom: "8px" }}
                    >
                      {t("settings.language.uiLanguage")}
                    </div>
                    <div
                      className="flex flex-col rounded-xl bg-[var(--bg-surface)] overflow-hidden"
                      style={{ padding: "4px" }}
                    >
                      {[
                        { key: "ru" as Locale, label: "Русский" },
                        { key: "en" as Locale, label: "English" },
                      ].map((item) => {
                        const isSelected = state.language === item.key;
                        return (
                          <div
                            key={item.key}
                            onClick={() => setLanguage(item.key)}
                            className="flex items-center justify-between rounded-lg cursor-pointer transition-colors hover:bg-[var(--bg-hover)]"
                            style={{ padding: "9px 14px" }}
                          >
                            <span className="text-[13px] text-[var(--text-primary)] font-medium">
                              {item.label}
                            </span>
                            <div
                              className={`w-4 h-4 rounded-full border flex items-center justify-center transition-colors ${
                                isSelected
                                  ? "bg-[var(--accent)] border-[var(--accent)] text-white"
                                  : "border-[var(--border-strong)] bg-[var(--bg-base)]"
                              }`}
                            >
                              {isSelected && <Check size={11} strokeWidth={3} />}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* 2. Spellcheck Dictionaries */}
                  <div>
                    <div
                      className="text-[12px] font-semibold uppercase tracking-wider text-[var(--text-muted)]"
                      style={{ marginBottom: "8px" }}
                    >
                      {t("settings.language.dictionaries")}
                    </div>
                    <div
                      className="flex flex-col rounded-xl bg-[var(--bg-surface)] overflow-hidden"
                      style={{ padding: "4px" }}
                    >
                      {[
                        { code: "ru-RU", label: t("settings.language.dictRussian") },
                        { code: "en-US", label: t("settings.language.dictEnglish") },
                      ].map((dict) => {
                        const isEnabled = spellcheckLangs.includes(dict.code);
                        return (
                          <div
                            key={dict.code}
                            onClick={() => handleToggleDictLang(dict.code)}
                            className="flex items-center justify-between rounded-lg cursor-pointer transition-colors hover:bg-[var(--bg-hover)]"
                            style={{ padding: "9px 14px" }}
                          >
                            <span className="text-[13px] text-[var(--text-primary)] font-medium">
                              {dict.label}
                            </span>
                            <div
                              className={`w-4 h-4 rounded-md border flex items-center justify-center transition-colors ${
                                isEnabled
                                  ? "bg-[var(--accent)] border-[var(--accent)] text-white"
                                  : "border-[var(--border-strong)] bg-[var(--bg-base)]"
                              }`}
                            >
                              {isEnabled && <Check size={11} strokeWidth={3} />}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* 3. Custom Dictionary */}
                  <div>
                    <div
                      className="flex items-center justify-between"
                      style={{ marginBottom: "8px" }}
                    >
                      <span className="text-[12px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                        {t("settings.language.customDictionary")}
                      </span>
                      {customWords.length > 0 && (
                        <span className="text-[11.5px] text-[var(--text-dim)]">
                          {newWordInput.trim()
                            ? `${filteredWords.length} / ${customWords.length}`
                            : customWords.length}
                        </span>
                      )}
                    </div>

                    {/* Search & Add word input bar */}
                    <div
                      className="flex items-center gap-2 rounded-xl bg-[var(--bg-surface)]"
                      style={{ padding: "6px 8px 6px 12px", marginBottom: "8px" }}
                    >
                      <input
                        type="text"
                        value={newWordInput}
                        onChange={(e) => setNewWordInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !isWordAlreadyAdded) {
                            e.preventDefault();
                            handleAddCustomWord();
                          }
                        }}
                        placeholder={t("settings.language.addWordPlaceholder")}
                        className="flex-1 bg-transparent border-none outline-none text-[13px] text-[var(--text-primary)] placeholder-[var(--text-dim)]"
                      />
                      {newWordInput && (
                        <button
                          onClick={() => setNewWordInput("")}
                          className="text-[var(--text-dim)] hover:text-[var(--text-primary)] transition-colors p-1"
                          title={t("common.clear")}
                        >
                          <X size={14} />
                        </button>
                      )}
                      <button
                        onClick={handleAddCustomWord}
                        disabled={!newWordInput.trim() || isWordAlreadyAdded}
                        className={`flex items-center gap-1 text-[12px] font-medium rounded-lg transition-all ${
                          isWordAlreadyAdded
                            ? "bg-[var(--bg-hover)] text-[var(--text-dim)] cursor-not-allowed opacity-75"
                            : newWordInput.trim()
                            ? "bg-[var(--accent)] text-white hover:opacity-90 shadow-xs cursor-pointer"
                            : "bg-[var(--bg-hover)] text-[var(--text-dim)] cursor-not-allowed opacity-60"
                        }`}
                        style={{ padding: "6px 12px" }}
                      >
                        {isWordAlreadyAdded ? (
                          <>
                            <Check size={14} className="text-green-400" />
                            <span>{t("settings.language.alreadyInDict")}</span>
                          </>
                        ) : (
                          <>
                            <Plus size={14} />
                            <span>{t("settings.language.addWord")}</span>
                          </>
                        )}
                      </button>
                    </div>

                    {/* Custom words list with live search filtering */}
                    <div
                      className="flex flex-col rounded-xl bg-[var(--bg-surface)] max-h-44 overflow-y-auto"
                      style={{ padding: "4px" }}
                    >
                      {customWords.length === 0 ? (
                        <div
                          className="text-center text-[12px] text-[var(--text-dim)]"
                          style={{ padding: "16px 12px" }}
                        >
                          {t("settings.language.noCustomWords")}
                        </div>
                      ) : filteredWords.length === 0 ? (
                        <div
                          className="text-center text-[12px] text-[var(--text-dim)]"
                          style={{ padding: "16px 12px" }}
                        >
                          {t("settings.language.wordNotFoundInDict")}
                        </div>
                      ) : (
                        filteredWords.map((word) => (
                          <div
                            key={word}
                            className="flex items-center justify-between rounded-lg transition-colors hover:bg-[var(--bg-hover)] group"
                            style={{ padding: "7px 12px" }}
                          >
                            <span className="text-[13px] text-[var(--text-primary)] font-mono select-text">
                              {word}
                            </span>
                            <button
                              onClick={() => handleRemoveCustomWord(word)}
                              className="w-6 h-6 flex items-center justify-center rounded text-[var(--text-dim)] hover:text-red-400 hover:bg-red-500/10 transition-colors"
                              title={t("common.delete")}
                            >
                              <X size={14} />
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB: KEYBOARD SHORTCUTS */}
              {activeTab === "shortcuts" && (
                <div
                  className="flex-1 flex flex-col items-center justify-center text-center rounded-xl bg-[var(--bg-surface)] select-none"
                  style={{ padding: "24px" }}
                >
                  <div
                    className="rounded-full bg-[var(--bg-base)] flex items-center justify-center text-[var(--accent)] shadow-xs"
                    style={{ width: "40px", height: "40px", marginBottom: "12px" }}
                  >
                    <Sparkles size={18} />
                  </div>
                  <h4 className="text-sm font-medium text-[var(--text-primary)] mb-1">
                    {t("settings.comingSoon")}
                  </h4>
                  <p className="text-xs text-[var(--text-muted)]" style={{ maxWidth: "280px" }}>
                    {t("settings.comingSoonDesc")}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Color Picker row control */
function ColorControl({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (val: string) => void;
}) {
  const colorInputRef = useRef<HTMLInputElement>(null);

  // Convert rgba(...) or named color to hex for the native input if needed
  const hexValue = useMemo(() => {
    if (value && value.startsWith("#")) {
      return value.length === 7 ? value : value.slice(0, 7);
    }
    return "#6c8cff";
  }, [value]);

  return (
    <div
      className="flex items-center justify-between gap-2 rounded-lg bg-[var(--bg-base)] border border-[var(--border-default)]"
      style={{ padding: "6px 8px" }}
    >
      <span className="text-[11.5px] text-[var(--text-secondary)] truncate flex-1" title={label}>
        {label}
      </span>
      <div className="flex items-center gap-1.5 shrink-0">
        <div
          onClick={() => colorInputRef.current?.click()}
          className="w-5 h-5 rounded-md border border-black/20 shadow-xs cursor-pointer transition-transform hover:scale-105 relative"
          style={{ backgroundColor: value }}
        >
          <input
            ref={colorInputRef}
            type="color"
            value={hexValue}
            onChange={(e) => onChange(e.target.value)}
            className="absolute inset-0 opacity-0 cursor-pointer pointer-events-none"
          />
        </div>
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-16 bg-transparent border-none outline-none font-mono text-[10.5px] text-[var(--text-primary)] text-right"
        />
      </div>
    </div>
  );
}
