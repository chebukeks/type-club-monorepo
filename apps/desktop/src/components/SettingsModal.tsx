import { useState, useEffect, useRef } from "react";
import { useEditor } from "../context/EditorContext";
import { Palette, Globe, Keyboard, X, Sparkles, Check, Plus } from "lucide-react";
import type { Locale } from "@type-club/editor";

interface SettingsModalProps {
  onClose: () => void;
}

type SettingsTab = "theme" | "language" | "shortcuts";

export function SettingsModal({ onClose }: SettingsModalProps) {
  const { state, setLanguage, t } = useEditor();
  const [activeTab, setActiveTab] = useState<SettingsTab>("language");
  const [closing, setClosing] = useState(false);
  const overlayMouseDownRef = useRef(false);

  // --- Dictionaries & Custom Words State ---
  const [spellcheckLangs, setSpellcheckLangs] = useState<string[]>(["ru-RU", "en-US"]);
  const [customWords, setCustomWords] = useState<string[]>([]);
  const [newWordInput, setNewWordInput] = useState("");

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

  const tabs: { key: SettingsTab; label: string; icon: typeof Palette; desc: string }[] = [
    {
      key: "theme",
      label: t("settings.tab.theme"),
      icon: Palette,
      desc: t("settings.tab.themeDesc"),
    },
    {
      key: "language",
      label: t("settings.tab.language"),
      icon: Globe,
      desc: t("settings.tab.languageDesc"),
    },
    {
      key: "shortcuts",
      label: t("settings.tab.shortcuts"),
      icon: Keyboard,
      desc: t("settings.tab.shortcutsDesc"),
    },
  ];

  const currentTabInfo = tabs.find((tItem) => tItem.key === activeTab) || tabs[0];

  return (
    <div
      className={`modal-overlay ${
        closing
          ? "animate-out fade-out duration-100 ease-in fill-mode-forwards"
          : "animate-in fade-in duration-150 ease-out"
      }`}
      onMouseDown={handleOverlayMouseDown}
      onClick={handleOverlayClick}
    >
      <div
        className={`modal-panel ${
          closing
            ? "animate-out fade-out zoom-out-95 duration-100 ease-in fill-mode-forwards"
            : "animate-in fade-in zoom-in-95 duration-150 ease-out"
        }`}
        style={{
          width: "100%",
          maxWidth: "700px",
          height: "520px",
          maxHeight: "85vh",
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
          style={{ padding: "16px 20px 8px 20px" }}
        >
          <div className="flex items-center gap-2">
            <h2 className="text-[14px] font-semibold text-[var(--text-primary)]">
              {t("settings.modalTitle")}
            </h2>
          </div>
          <button
            onClick={handleClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors"
            title={t("common.close")}
          >
            <X size={15} />
          </button>
        </div>

        {/* Body (Left sidebar with vertical segmented tabs + Right content area) */}
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

          {/* Right Content Area */}
          <div
            className="flex-1 flex flex-col overflow-y-auto bg-[var(--bg-base)]"
            style={{ padding: "12px 24px 24px 20px" }}
          >
            <div className="select-none" style={{ marginBottom: "16px" }}>
              <h3 className="text-base font-semibold text-[var(--text-primary)]">
                {currentTabInfo.label}
              </h3>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">
                {currentTabInfo.desc}
              </p>
            </div>

            {/* Tab: Language & Dictionaries */}
            {activeTab === "language" && (
              <div className="flex flex-col select-none" style={{ gap: "20px" }}>
                {/* 1. Interface Language */}
                <div>
                  <div className="text-[12px] font-semibold uppercase tracking-wider text-[var(--text-muted)]" style={{ marginBottom: "8px" }}>
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
                  <div className="text-[12px] font-semibold uppercase tracking-wider text-[var(--text-muted)]" style={{ marginBottom: "8px" }}>
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
                  <div className="text-[12px] font-semibold uppercase tracking-wider text-[var(--text-muted)]" style={{ marginBottom: "8px" }}>
                    {t("settings.language.customDictionary")}
                  </div>

                  {/* Add word input bar */}
                  <div
                    className="flex items-center gap-2 rounded-xl bg-[var(--bg-surface)]"
                    style={{ padding: "6px 8px 6px 12px", marginBottom: "8px" }}
                  >
                    <input
                      type="text"
                      value={newWordInput}
                      onChange={(e) => setNewWordInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleAddCustomWord();
                        }
                      }}
                      placeholder={t("settings.language.addWordPlaceholder")}
                      className="flex-1 bg-transparent border-none outline-none text-[13px] text-[var(--text-primary)] placeholder-[var(--text-dim)]"
                    />
                    <button
                      onClick={handleAddCustomWord}
                      disabled={!newWordInput.trim()}
                      className={`flex items-center gap-1 text-[12px] font-medium rounded-lg transition-all ${
                        newWordInput.trim()
                          ? "bg-[var(--accent)] text-white hover:opacity-90 shadow-xs cursor-pointer"
                          : "bg-[var(--bg-hover)] text-[var(--text-dim)] cursor-not-allowed opacity-60"
                      }`}
                      style={{ padding: "6px 12px" }}
                    >
                      <Plus size={14} />
                      <span>{t("settings.language.addWord")}</span>
                    </button>
                  </div>

                  {/* Custom words list */}
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
                    ) : (
                      customWords.map((word) => (
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

            {/* Placeholder for Theme & Shortcuts */}
            {activeTab !== "language" && (
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
  );
}
