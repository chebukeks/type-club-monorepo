# Статус проекта Type-Club Monorepo

Дата обновления: 11 августа 2026 г.

---

## 1. Текущие цели

- **Интерактивное и адаптивное оглавление (ToC)**: Единый UX оглавления и предложений на десктопе, вебе и в режиме чтения (`ReadArticle`), с поддержкой раздельного (сайдбар) и совмещенного (плавающая кнопка/дравер) режимов.
- **Стандартизация дизайна меню и поп-апов**: Единый визуальный язык для контекстных меню, дропдаунов, попапов настроек и статистики с современными Enter & Exit анимациями и эффектами размытия (glassmorphism).
- **Разграничение прав и режимов редактирования**: Изоляция режимов Автор (`author`), Соавтор (`co_author`) и Советчик (`editor`).
- **Стабильность совместной работы и React SPA**: Исключение сбоев из-за портов Vite/CORS, предотвращение срывов React 18 в белый экран (ErrorBoundary) и защита от нарушения правил хуков (Rules of Hooks).

---

## 2. Завершённые задачи (Этап 10-11 августа 2026 г.)

### 2.1 Дизайн, адаптивность и логика Оглавления (ToC)
- **Адаптивный вынос оглавления в правое поле редакторов**:
  - В десктопном и веб-редакторах динамически вычисляется свободное пространство справа от холста с учетом масштабирования документа (`docScale`). При достаточном месте оглавление отображается правым сайдбаром, при нехватке — автоматически переключается на плавающую кнопку.
  - На странице `ReadArticle.tsx` оглавление позиционируется относительно центра статьи (`left: calc(50vw + 408px)`), с брейкпоинтом `@media (min-width: 1240px)`.
- **Режимы отображения ToC (Вместе / Раздельно)**:
  - Режим `separate`: заголовки выводятся под открытым файлом в сайдбаре.
  - Режим `combined`: оглавление и предложения выносятся в плавающую панель (поповер/дравер).
- **Навигация и переход к предложениям**:
  - Реализованы слушатели событий `editor-scroll-to` и `editor-scroll-to-suggestion` на вебе и десктопе. Клик по пункту оглавления или предложению плавно скроллит редактор к целевому узлу с выделением диапазона текста и установкой фокуса.

### 2.2 Стандартизация элементов управления и анимации
- **Единый стиль разделителей (`sep`)**:
  - Все разделители в контекстных меню (`MarkdownEditor`, `Sidebar`), главных меню (`MenuBar`), поп-апе профиля (`TitleBar`), настройках (`SettingsPopup`) и статистике (`StatsToast`) приведены к каноническому стилю ToC (`border-t border-[var(--border-default)] my-1.5 mx-2 opacity-80`).
- **Анимации появления и исчезновения (Enter & Exit Animations)**:
  - Плавающая панель оглавления: плавный вылет и сжатие (`animate-in/out fade-in/out zoom-in/out-95 slide-in/out-from-bottom-3 duration-150`).
  - Выпадающие меню (`MenuBar`, `SettingsPopup`, `TitleBar`): реализован хелпер `AnimatedMenu` и состояние `closing` с фадаутом `100ms`.
  - Контекстные меню редактора и сайдбара: снабжены 100ms плавной анимацией скрытия.
- **Анимации аккордеонного раскрытия**:
  - Подробная статистика при наведении (`StatsToast`) и заголовки файлов в сайдбаре разворачиваются и сворачиваются через плавно анимируемый CSS Grid-аккордеон (`grid-rows-[0fr] opacity-0` → `grid-rows-[1fr] opacity-100`).
- **Положение попапа масштабирования**:
  - Попап процента зума закреплен строго по центру снизу (`fixed bottom-6 left-1/2 -translate-x-1/2 z-50`).

### 2.3 Стабильность веб-приложения и обработка ошибок
- **Предохранитель ошибок (`ErrorBoundary`)**:
  - Создан компонент `ErrorBoundary.tsx`, предотвращающий "белый экран" в веб-приложении при неперехваченных JS-исключениях в React 18.
- **Исправление нарушения правил хуков (Rules of Hooks)**:
  - В `TableOfContents.tsx` вызовы `useState(mounted)` и `useEffect` вынесены до условного раннего `return null`, что устранило падение React при смене состояний `hasToc`.
- **Строгая привязка портов Vite**:
  - В `apps/web/vite.config.ts` зафиксированы `port: 5173` и `strictPort: true`, исключающие случайный уход веб-клиента на порт `5174` при наличии зависших фоновых процессов.

---

## 3. Ключевые технические решения и архитектура

1. **Динамический расчет правого сайдбара**:
   - `leftPos = containerWidth / 2 + docHalfWidth + 16`, где `docHalfWidth = 430 * docScale`.
   - Позволяет плавно убирать/показывать сайдбар оглавления в зависимости от доступных пикселей справа от редактора.
2. **CSS Grid Accordion Pattern**:
   - Для раскрывающихся контейнеров без фиксированной JS-высоты используется CSS-сетка: `grid transition-all duration-200 ease-out grid-rows-[0fr]` → `grid-rows-[1fr]`, исключающая визуальные рывки.
3. **Безопасное размонтирование поповеров**:
   - Для сохранения анимаций скрытия в чистом React применяются либо таймеры задержки удержания монтирования (`mounted`), либо внутренний флаг `closing` перед вызовом родительского `onClose()`.
4. **Безопасность слушателей ProseMirror**:
   - Все обработчики событий прокрутки (`editor-scroll-to-suggestion`) проверяют `view.isDestroyed` и вычисляют родительский контейнер скролла, не ломая цепочку при неполной отрисовке DOM.

---

## 4. Основные изменённые файлы

| Файл | Описание изменений |
|------|-------------------|
| [`apps/web/src/components/TableOfContents.tsx`](file:///c:/git/type-club/type-club-monorepo/apps/web/src/components/TableOfContents.tsx) | Исправление порядка хуков, добавление enter/exit анимаций плавающей панели. |
| [`apps/desktop/src/components/TableOfContents.tsx`](file:///c:/git/type-club/type-club-monorepo/apps/desktop/src/components/TableOfContents.tsx) | Вынос оглавления, исправление порядка хуков, добавление enter/exit анимаций. |
| [`apps/desktop/src/components/MarkdownEditor.tsx`](file:///c:/git/type-club/type-club-monorepo/apps/desktop/src/components/MarkdownEditor.tsx) | Добавление события `editor-scroll-to-suggestion`, стандартизация `sep`, анимации контекстных меню. |
| [`apps/web/src/components/MarkdownEditor.tsx`](file:///c:/git/type-club/type-club-monorepo/apps/web/src/components/MarkdownEditor.tsx) | Обработка клика по предложениям, плавный скролл с фокусом и выделением. |
| [`apps/desktop/src/components/MenuBar.tsx`](file:///c:/git/type-club/type-club-monorepo/apps/desktop/src/components/MenuBar.tsx) | Обёртка дропдаунов в `AnimatedMenu`, стандартизация разделителей. |
| [`apps/desktop/src/components/TitleBar.tsx`](file:///c:/git/type-club/type-club-monorepo/apps/desktop/src/components/TitleBar.tsx) | Анимация выхода меню профиля, стиль разделителей. |
| [`apps/desktop/src/components/SettingsPopup.tsx`](file:///c:/git/type-club/type-club-monorepo/apps/desktop/src/components/SettingsPopup.tsx) | Анимация выхода настроек, стиль разделителей. |
| [`apps/desktop/src/components/StatsToast.tsx`](file:///c:/git/type-club/type-club-monorepo/apps/desktop/src/components/StatsToast.tsx) | Анимация раскрытия по наведению на CSS Grid, стиль разделителей. |
| [`apps/desktop/src/components/Sidebar.tsx`](file:///c:/git/type-club/type-club-monorepo/apps/desktop/src/components/Sidebar.tsx) | Анимация вылета контекстных меню, аккордеон ToC у текущего файла. |
| [`apps/web/src/pages/ReadArticle.tsx`](file:///c:/git/type-club/type-club-monorepo/apps/web/src/pages/ReadArticle.tsx) | Исправление формулы `left` позиционирования десктопного ToC сайдбара. |
| [`apps/web/src/index.css`](file:///c:/git/type-club/type-club-monorepo/apps/web/src/index.css) | Обновлены медиазапросы брейкпоинтов оглавления (`@media (min-width: 1240px)`). |
| [`apps/web/src/components/ErrorBoundary.tsx`](file:///c:/git/type-club/type-club-monorepo/apps/web/src/components/ErrorBoundary.tsx) | **[NEW]** Компонент предохранителя веб-приложения от упавших компонентов. |
| [`apps/web/vite.config.ts`](file:///c:/git/type-club/type-club-monorepo/apps/web/vite.config.ts) | Зафиксирован `port: 5173` и `strictPort: true`. |

---

## 5. Результаты тестирования и проверки

- **Сборка Desktop (TypeScript)**: `npx tsc --noEmit -p apps/desktop/tsconfig.json` выполняется с кодом `0` (0 ошибок).
- **Сборка Web (Vite / TypeScript)**: `npm run build:web` выполняется с кодом `0` (0 ошибок).
- **Проведенные сценарии проверки**:
  - Клик по предложению в оглавлении (десктоп/веб) → переход к строке с фокусировкой редактора и плавным скроллом.
  - Наведение на `StatsToast` → плавное раскрытие без выталкивания кнопок.
  - Открытие/закрытие меню `File`, `View`, `Settings`, контекстных меню → плавное появление и растворение.
  - Страница `ReadArticle` → оглавление отображается на десктопе справа от статьи, не накладываясь на текст.
  - Отсутствие зависших процессов на порту `5174` → приложению гарантирован порт `5173`.

---

## 6. Опробованные, но не сработавшие подходы

1. **Использование `left: calc(100% + 24px)` у `position: fixed` элементов в `ReadArticle.tsx`**:
   - *Проблема*: `100%` для фиксированного элемента считывалось от ширины viewport (`100vw`), уводя сайдбар за правый край экрана (`X = 100vw + 24px`).
   - *Решение*: Использование `left: calc(50vw + 408px)`, вычисляющего позицию от центра экрана и половины ширины статьи.

2. **Вызов `return null` до вызова всех React-хуков в `TableOfContents.tsx`**:
   - *Проблема*: Нарушало правило "Rules of Hooks" при асинхронном появлении заголовков и ломало рендеринг React 18.
   - *Решение*: Вынос всех вызовов `useState` и `useEffect` строго в верхнюю часть функции до любого условия раннего выхода.

---

## 7. Следующие шаги разработки

1. **Кодосплиттинг и оптимизация бандла веба**: Вынести библиотеки KaTeX и CodeMirror в отдельные чанки через динамический `import()`.
2. **Перенос статистики статьи в сайдбар**: Добавить пользовательскую опцию перенесения статистики из всплывающего `StatsToast` в боковую панель сайдбара.
3. **E2E тесты взаимодействия с предложенными правками**: Написать интеграционные тесты для проверки синхронизации заметок/предложений между веб-клиентом и десктопным приложением.