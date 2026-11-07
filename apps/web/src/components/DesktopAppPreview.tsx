import { useEffect, useRef, useState } from "react";
import {
  PanelLeftClose,
  PanelTopClose,
  Search,
  Share2,
  User,
  Settings,
  Globe,
  EyeOff,
  RotateCw,
  Folder,
  FileText,
  ChevronDown,
} from "lucide-react";

const DESIGN_WIDTH = 620;

const SIDEBAR_FILES_TOP = [
  "appendix non linear glossary.md",
  "epistemologicalpreface.md",
  "methodology divergence matrix.md",
];

const SIDEBAR_OUTLINE = [
  { text: "Quantum Narrative Deconstruction: A Fra...", indent: false },
  { text: "1. Conceptual Taxonomy", indent: true },
  { text: "2. Entropy Correlation Matrix", indent: true },
  { text: "3. Algorithmic Genesis of Meaning", indent: true },
  { text: "4. Deconstruction Roadmap", indent: true },
  { text: "Sprint Deliverables:", indent: true },
];

const SIDEBAR_FILES_BOTTOM = [
  "rejected hypotheses draft 4.md",
  "semiotic entropy proofs.md",
];

/**
 * Статическая векторная 1:1 реплика окна десктопного приложения Type Club.
 * На узких мобильных экранах (< 620px) пропорционально масштабирует десктопное окно,
 * сохраняя его альбомное соотношение сторон.
 */
export default function DesktopAppPreview() {
  const outerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [scaledHeight, setScaledHeight] = useState<number | null>(null);

  useEffect(() => {
    const outer = outerRef.current;
    const inner = innerRef.current;
    if (!outer || !inner) return;

    const updateScale = () => {
      const w = outer.clientWidth;
      if (w > 0 && w < DESIGN_WIDTH) {
        const s = w / DESIGN_WIDTH;
        setScale(s);
        setScaledHeight(Math.round(inner.offsetHeight * s));
      } else {
        setScale(1);
        setScaledHeight(null);
      }
    };

    updateScale();
    const ro = new ResizeObserver(updateScale);
    ro.observe(outer);
    return () => ro.disconnect();
  }, []);

  const isScaled = scale < 1;

  return (
    <div
      ref={outerRef}
      aria-hidden="true"
      className="w-full rounded-2xl border border-[#d8d8dc] dark:border-[#2d2e32] bg-[#f3f3f3] dark:bg-[#1e1f22] shadow-2xl overflow-hidden select-none pointer-events-none text-left font-sans"
      style={scaledHeight !== null ? { height: `${scaledHeight}px` } : undefined}
    >
      <div
        ref={innerRef}
        style={
          isScaled
            ? {
                width: `${DESIGN_WIDTH}px`,
                transform: `scale(${scale})`,
                transformOrigin: "top left",
              }
            : undefined
        }
      >
        {/* Шапка окна (TitleBar) */}
        <div className="h-8 px-2.5 flex items-center justify-between bg-[#f3f3f3] dark:bg-[#1e1f22] relative text-[#6e6e6e] dark:text-[#6a6e78]">
          {/* Левая группа: кнопки панелей + меню */}
          <div className="flex items-center gap-1.5">
            <span className="w-5 h-5 flex items-center justify-center rounded text-[#7a7a7a] dark:text-[#6a6e78]">
              <PanelLeftClose size={12} />
            </span>
            <span className="w-5 h-5 flex items-center justify-center rounded text-[#7a7a7a] dark:text-[#6a6e78]">
              <PanelTopClose size={12} />
            </span>
            <div className="flex items-center gap-3 ml-1 text-[10.5px] font-medium text-[#2c2c2c] dark:text-[#cccccc]">
              <span>File</span>
              <span>Edit</span>
              <span>View</span>
            </div>
          </div>

          {/* Центральный переключатель режимов: Seamless | Raw | Preview */}
          <div className="flex items-center rounded-md bg-[#e9e9eb] dark:bg-[#17181b] p-0.5 gap-0.5">
            <span className="px-2 py-0.5 text-[10px] font-semibold rounded bg-white dark:bg-[#232428] text-[#1e1e1e] dark:text-[#e1e1e3] shadow-2xs border border-[#dedede] dark:border-[#323338]">
              Seamless
            </span>
            <span className="px-2 py-0.5 text-[10px] font-medium text-[#8a8a8e] dark:text-[#6a6e78]">
              Raw
            </span>
            <span className="px-2 py-0.5 text-[10px] font-medium text-[#8a8a8e] dark:text-[#6a6e78]">
              Preview
            </span>
          </div>

          {/* Правая группа: иконки действий и кнопки управления окном */}
          <div className="flex items-center gap-2.5 text-[#8a8a8e] dark:text-[#6a6e78]">
            <Search size={11} />
            <Share2 size={11} />
            <User size={11} className="text-[#4472c4] dark:text-[#6c8cff]" />
            <Settings size={11} />
            <div className="flex items-center gap-2.5 ml-1 pl-1">
              <svg width="8" height="1" viewBox="0 0 10 1" className="fill-current">
                <rect width="10" height="1" />
              </svg>
              <svg
                width="8"
                height="8"
                viewBox="0 0 10 10"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.1"
              >
                <rect x="0.5" y="0.5" width="9" height="9" />
              </svg>
              <svg
                width="8"
                height="8"
                viewBox="0 0 10 10"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.2"
              >
                <line x1="1" y1="1" x2="9" y2="9" />
                <line x1="9" y1="1" x2="1" y2="9" />
              </svg>
            </div>
          </div>
        </div>

        {/* Основная рабочая область: Sidebar + Редактор */}
        <div className="flex bg-[#f3f3f3] dark:bg-[#1e1f22]">
          {/* Левый сайдбар (DOCS) */}
          <div className="w-[195px] shrink-0 flex flex-col px-2 pb-2 pt-0.5">
            {/* Заголовок DOCS и иконки */}
            <div className="h-6 px-1.5 flex items-center justify-between">
              <span className="text-[9px] font-semibold uppercase tracking-widest text-[#8e8e93] dark:text-[#6a6e78]">
                DOCS
              </span>
              <div className="flex items-center gap-1.5 text-[#8e8e93] dark:text-[#6a6e78]">
                <Globe size={10} />
                <EyeOff size={10} />
                <RotateCw size={10} />
                <Folder size={10} />
              </div>
            </div>

            {/* Поле поиска по файлам */}
            <div className="mx-0.5 my-1 px-2 py-1 rounded-md bg-[#eaeaea] dark:bg-[#2a2b30] border border-[#dfdfdf] dark:border-[#32333a] flex items-center gap-1.5 text-[9.5px] text-[#999999] dark:text-[#6a6e78]">
              <Search size={9.5} className="shrink-0" />
              <span className="truncate">Search files...</span>
            </div>

            {/* Дерево файлов и оглавление */}
            <div className="mt-1 space-y-0.5 text-[9.5px]">
              {SIDEBAR_FILES_TOP.map((name) => (
                <div
                  key={name}
                  className="px-1.5 py-1 rounded flex items-center gap-1.5 text-[#4a4a4a] dark:text-[#a0a4ab]"
                >
                  <FileText
                    size={10.5}
                    className="shrink-0 text-[#4472c4] dark:text-[#6c8cff]"
                  />
                  <span className="truncate">{name}</span>
                </div>
              ))}

              {/* Активный файл */}
              <div className="px-1 py-1 rounded-md bg-[#e2e2e5] dark:bg-[#2a2d33] flex items-center gap-1 text-[#1e1e1e] dark:text-[#e1e1e3] font-medium">
                <ChevronDown
                  size={9.5}
                  className="shrink-0 text-[#7a7a7e] dark:text-[#8a8e98]"
                />
                <FileText
                  size={10.5}
                  className="shrink-0 text-[#4472c4] dark:text-[#6c8cff]"
                />
                <span className="truncate">quatum deconstruction.md</span>
              </div>

              {/* Оглавление открытого документа */}
              <div className="pl-3 pr-1 py-0.5 space-y-1 text-[8.5px] text-[#8a8a8e] dark:text-[#6a6e78]">
                {SIDEBAR_OUTLINE.map((item) => (
                  <div
                    key={item.text}
                    className={`truncate ${item.indent ? "pl-2" : ""}`}
                  >
                    {item.text}
                  </div>
                ))}
              </div>

              {SIDEBAR_FILES_BOTTOM.map((name) => (
                <div
                  key={name}
                  className="px-1.5 py-1 rounded flex items-center gap-1.5 text-[#4a4a4a] dark:text-[#a0a4ab]"
                >
                  <FileText
                    size={10.5}
                    className="shrink-0 text-[#4472c4] dark:text-[#6c8cff]"
                  />
                  <span className="truncate">{name}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Правая панель: Вкладки + Лист документа */}
          <div className="flex-1 min-w-0 flex flex-col pr-1.5 pb-1.5">
            {/* Панель вкладок (TabBar) */}
            <div className="h-7 flex items-center gap-1 px-1 text-[9.5px] overflow-hidden">
              <div className="px-2 py-1 rounded-md text-[#8e8e93] dark:text-[#6a6e78] flex items-center gap-1 min-w-0">
                <FileText size={10} className="shrink-0 opacity-60" />
                <span className="truncate">epistemologicalprefa...</span>
              </div>
              <div className="flex px-2 py-1 rounded-md text-[#8e8e93] dark:text-[#6a6e78] items-center gap-1 min-w-0">
                <FileText size={10} className="shrink-0 opacity-60" />
                <span className="truncate">semiotic entropy pro...</span>
              </div>
              <div className="px-2.5 py-1 rounded-lg bg-white dark:bg-[#1a1b1e] border border-[#e0e0e0] dark:border-[#2d2e32] text-[#1e1e1e] dark:text-[#e1e1e3] font-medium shadow-2xs flex items-center gap-1.5 min-w-0">
                <FileText
                  size={10}
                  className="shrink-0 text-[#6e6e6e] dark:text-[#a0a4ab]"
                />
                <span className="truncate">quatum deconstructi...</span>
              </div>
            </div>

            {/* Карточка редактора */}
            <div className="flex-1 rounded-xl border border-[#e0e0e0] dark:border-[#2d2e32] bg-white dark:bg-[#1a1b1e] px-7 pt-5 pb-3 relative overflow-hidden">
              {/* Полоса прокрутки справа */}
              <div className="absolute right-1 top-2.5 w-1 h-24 rounded-full bg-[#d0d0d0] dark:bg-[#3a3d44]" />

              {/* Заголовок документа H1 */}
              <h3 className="text-[16px] font-bold leading-[1.22] tracking-tight text-[#1e1e1e] dark:text-[#e8eaed] mb-2">
                Quantum Narrative Deconstruction: A Framework for Transcendental Syntax
              </h3>

              {/* Лид-абзац */}
              <p className="text-[9.8px] leading-[1.55] text-[#3c3c3c] dark:text-[#cccccc] mb-2.5">
                Contemporary discourse within cognitive-semiotic spaces demands a radical
                revision of traditional epistemological paradigms. Under conditions of
                hyperreality, classical linearity of explication collapses into fractal noise.
                Below is an ontological synthesis structured to test high-density text
                rendering and typographic hierarchies.
              </p>

              {/* Раздел 1 */}
              <h4 className="text-[12.5px] font-bold text-[#1e1e1e] dark:text-[#e8eaed] mb-1">
                1. Conceptual Taxonomy
              </h4>

              <p className="text-[9.8px] leading-[1.5] text-[#3c3c3c] dark:text-[#cccccc] mb-1.5">
                Before postulating the dialectical tension between the{" "}
                <em className="italic">simulacrum</em> and its referent, we must isolate key
                epistemological modalities:
              </p>

              <ul className="space-y-1 text-[9.6px] leading-[1.45] text-[#3c3c3c] dark:text-[#cccccc] pl-4 mb-2.5 list-disc marker:text-[#777] dark:marker:text-[#888]">
                <li>
                  <strong className="font-semibold text-[#1e1e1e] dark:text-[#f0f0f2]">
                    Epistemic Framing
                  </strong>{" "}
                  — Apperception of the subject mediated through the transgression of modal
                  operators.
                </li>
                <li>
                  <strong className="font-semibold text-[#1e1e1e] dark:text-[#f0f0f2]">
                    Singular Tautology
                  </strong>{" "}
                  — A recursive loop generating an illusion of dense meta-text:
                </li>
                <li>Primary semantic fluctuation;</li>
                <li>Secondary denotative entropy;</li>
                <li>Contextual collapse.</li>
                <li>
                  <strong className="font-semibold text-[#1e1e1e] dark:text-[#f0f0f2]">
                    Quasi-Divergence
                  </strong>{" "}
                  — Apparent vector divergence within a structurally homogeneous hermeneutic
                  field.
                </li>
              </ul>

              {/* Цитата */}
              <div className="border-l-[2.5px] border-[#4472c4] dark:border-[#6c8cff] bg-[#4472c4]/[0.05] dark:bg-[#6c8cff]/[0.06] rounded-r-md px-3 py-2 mb-2.5 text-[9.5px] leading-[1.5] text-[#6e6e6e] dark:text-[#a0a4ab]">
                <div>
                  &ldquo;Truth is not merely decentered; it diffuses through semiotic lattices
                  faster than the observer can quantify their own intentionality.&rdquo;
                </div>
                <div className="mt-1 italic text-[#3c3c3c] dark:text-[#c8cad0]">
                  — J.-P. Pseudo-Baudrillard, &ldquo;Critique of Pure Feedback&rdquo;
                </div>
              </div>

              {/* Раздел 2 */}
              <h4 className="text-[12.5px] font-bold text-[#1e1e1e] dark:text-[#e8eaed] mb-1">
                2. Entropy Correlation Matrix
              </h4>

              <p className="text-[9.5px] leading-[1.45] text-[#3c3c3c] dark:text-[#cccccc] mb-2">
                To quantify intertextual dynamics, we apply cross-validation across semantic
                density metrics:
              </p>

              {/* Шапка таблицы внизу экрана */}
              <div className="grid grid-cols-4 border border-[#e0e0e0] dark:border-[#232428] rounded-t-md bg-[#f0f0f0] dark:bg-[#1e2025] text-[8.5px] font-semibold text-[#1e1e1e] dark:text-[#e8eaed] text-center divide-x divide-[#e0e0e0] dark:divide-[#232428] -mb-4">
                <div className="py-1.5 px-1 truncate">Construct</div>
                <div className="py-1.5 px-1 truncate">Entropy Level (ΔS)</div>
                <div className="py-1.5 px-1 truncate">Abduction Index</div>
                <div className="py-1.5 px-1 truncate">Phase Status</div>
              </div>

              {/* Плавающая плашка статистики (StatsToast) */}
              <div className="absolute right-2.5 bottom-2 px-4 py-1.5 rounded-lg bg-[#f3f3f3]/95 dark:bg-[#252526]/95 border border-[#dcdcdc] dark:border-[#36373d] shadow-md text-[9.5px] font-medium text-[#555555] dark:text-[#a0a4ab]">
                3,229 chars
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
