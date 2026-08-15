# Статус проекта Type-Club Monorepo

Дата обновления: 15 августа 2026 г.

---

## 1. Текущие цели

- **Интернационализация и многоязычность (i18n)**: Полноценная поддержка переключения языков (English / Русский) в веб- и десктоп-приложениях с единым типобезопасным словарем в пакете `@type-club/editor`.
- **Интерактивное и адаптивное оглавление (ToC)**: Единый UX оглавления и предложений на десктопе, вебе и в режиме чтения (`ReadArticle`), с поддержкой раздельного (сайдбар) и совмещенного (плавающая кнопка/дравер) режимов.
- **Стандартизация дизайна меню и поп-апов**: Единый визуальный язык для контекстных меню, дропдаунов, попапов настроек и статистики с современными Enter & Exit анимациями и эффектами размытия (glassmorphism).
- **Разграничение прав и режимов редактирования**: Изоляция режимов Автор (`author`), Соавтор (`co_author`) и Советчик (`editor`).
- **Стабильность совместной работы и React SPA**: Исключение сбоев из-за портов Vite/CORS, предотвращение срывов React 18 в белый экран (ErrorBoundary) и защита от нарушения правил хуков (Rules of Hooks).

---

## 2. Завершённые задачи

### 2.1 Интернационализация и локализация (i18n, 14–15 августа 2026 г.)
- **Единый типобезопасный словарь (`packages/editor/src/i18n`)**:
  - Создана система переводов с поддержкой динамических параметров (`{col}`, `{count}`, `{author}`, `{page}`, `{totalPages}`).
  - Строгая типизация `TranslationKey = keyof typeof en`, гарантирующая синхронность ключей между `en.ts` и `ru.ts` на этапе компиляции TypeScript.
  - Экспортированы утилиты `getTranslation()`, `createTranslator()`, `applyLanguageToDOM()`.
- **Локализация Desktop-приложения (`apps/desktop`)**:
  - Добавлено переключение языка в меню **View → Language → English / Русский** с сохранением в `electron-store` / `EditorContext`.
  - Полностью локализованы: `MenuBar`, `TitleBar`, `TabBar`, `Sidebar`, `SearchBar`, `TableOfContents`, `SettingsPopup`, `StatsToast`, модальные окна (`AuthModal`, `PublishModal`, `CollaborationModal`, `AddNoteModal`, `RawModeWarningModal`, `UserAutocompleteInput`), контекстные меню редактора, конструкторы таблиц и блоков кода.
- **Локализация Web-приложения (`apps/web`)**:
  - Создан `LanguageContext` с сохранением выбранного языка в `localStorage` (`typeclub_language`) и динамическим обновлением `document.documentElement.lang`.
  - Добавлен переключатель языка в шапку сайта рядом с темой (`ThemeSwitcher`).
  - Полностью переведены все страницы: `Landing`, `Login`, `Register`, `ForgotPassword`, `ResetPassword`, `VerifyEmail`, `Download`, `Articles`, `MyArticles`, `ReadArticle` (включая бейджи доступа, форматирование дат, счетчики просмотров/лайков и действия), `Editor`, `Settings`, `UserProfile`, `JoinPage`.
  - Локализованы компоненты: `SiteHeader`, `EditorHeader`, `ArticleCard`, `ArticleStats`, `AuthorFilter`, `CommentSection` (с относительными датами), `ErrorBoundary`, `TableOfContents`.
- **Локализация ProseMirror-плагинов (`packages/editor`)**:
  - Тултипы и интерфейсы принятия/отклонения правок в `suggestionActionPlugin` и `suggestionNoteView` адаптированы под текущую локаль.

### 2.2 Дизайн, адаптивность и логика Оглавления (ToC)
- **Адаптивный вынос оглавления в правое поле редакторов**:
  - В десктопном и веб-редакторах динамически вычисляется свободное пространство справа от холста с учетом масштабирования документа (`docScale`). При достаточном месте оглавление отображается правым сайдбаром, при нехватке — автоматически переключается на плавающую кнопку.
  - На странице `ReadArticle.tsx` оглавление позиционируется относительно центра статьи (`left: calc(50vw + 408px)`), с брейкпоинтом `@media (min-width: 1240px)`.
- **Режимы отображения ToC (Вместе / Раздельно)**:
  - Режим `separate`: заголовки выводятся под открытым файлом в сайдбаре.
  - Режим `combined`: оглавление и предложения выносятся в плавующую панель (поповер/дравер).
- **Навигация и переход к предложениям**:
  - Реализованы слушатели событий `editor-scroll-to` и `editor-scroll-to-suggestion` на вебе и десктопе. Клик по пункту оглавления или предложению плавно скроллит редактор к целевому узлу с выделением диапазона текста и установкой фокуса.

### 2.3 Стандартизация элементов управления и анимации
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

### 2.4 Стабильность веб-приложения и обработка ошибок
- **Предохранитель ошибок (`ErrorBoundary`)**:
  - Создан компонент `ErrorBoundary.tsx`, предотвращающий "белый экран" в веб-приложении при неперехваченных JS-исключениях в React 18.
- **Исправление нарушения правил хуков (Rules of Hooks)**:
  - В `TableOfContents.tsx` вызовы `useState(mounted)` и `useEffect` вынесены до условного раннего `return null`, что устранило падение React при смене состояний `hasToc`.
- **Строгая привязка портов Vite**:
  - В `apps/web/vite.config.ts` зафиксированы `port: 5173` и `strictPort: true`, исключающие случайный уход веб-клиента на порт `5174` при наличии зависших фоновых процессов.

### 2.5 Модальное окно настроек и управление словарями спеллчекера (15 августа 2026 г.)
- **Полноценное окно настроек десктоп-приложения (`SettingsModal.tsx`)**:
  - Реализован кастомный лейаут настроек: слева вертикальные сегментированные вкладки («Тема», «Язык и словари», «Горячие клавиши»), справа область настроек текущей категории.
  - Дизайн без лишних перегородок с поддержкой тем оформления, плавных анимаций открытия/закрытия, закрытия по Escape и клику вне окна.
  - Открытие модалки доступно по клику на пункт «Настройки» в шестеренке `TitleBar` и по глобальному событию `open-settings`.
- **Раздел «Язык и словари»**:
  - **Язык интерфейса**: выбор между «Русский» и «English» с немедленным обновлением всего приложения.
  - **Словари**: независимые чекбоксы включения русского (`ru-RU`) и английского (`en-US`) словарей проверки орфографии через `session.setSpellCheckerLanguages(...)`.
  - **Пользовательский словарь**: добавление кастомных слов через инпут (Enter / кнопка) и удаление слов из словаря с моментальным обновлением спеллчекера Electron.
- **Интеграция со спеллчекером и контекстным меню редактора (`MarkdownEditor.tsx`)**:
  - Точное определение слова под курсором или выделения в ProseMirror через `getWordAtDocPos`.
  - При клике по ошибочному слову контекстное меню выводит варианты исправлений (клик сразу заменяет слово в документе) и кнопку **«Добавить в словарь»**.
  - Включение встроенного движка Hunspell (`--disable-features=WinUseBrowserSpellChecker`) для надежной и быстрой работы спеллчекера на всех версиях Windows.

---

## 3. Ключевые технические решения и архитектура

1. **Единый словарь локализации `@type-club/editor/i18n`**:
   - Словарь ключей `en.ts` выступает источником истины типов (`type TranslationKey = keyof typeof en`). Любое расхождение в `ru.ts` немедленно отслеживается компилятором.
   - Поддержка параметров интерполяции `t('key', { name: value })` для динамических строк.
2. **Динамический расчет правого сайдбара**:
   - `leftPos = containerWidth / 2 + docHalfWidth + 16`, где `docHalfWidth = 430 * docScale`.
   - Позволяет плавно убирать/показывать сайдбар оглавления в зависимости от доступных пикселей справа от редактора.
3. **CSS Grid Accordion Pattern**:
   - Для раскрывающихся контейнеров без фиксированной JS-высоты используется CSS-сетка: `grid transition-all duration-200 ease-out grid-rows-[0fr]` → `grid-rows-[1fr]`, исключающая визуальные рывки.
4. **Безопасное размонтирование поповеров**:
   - Для сохранения анимаций скрытия в чистом React применяются либо таймеры задержки удержания монтирования (`mounted`), либо внутренний флаг `closing` перед вызовом родительского `onClose()`.
5. **Безопасность слушателей ProseMirror**:
   - Все обработчики событий прокрутки (`editor-scroll-to-suggestion`) проверяют `view.isDestroyed` и вычисляют родительский контейнер скролла, не ломая цепочку при неполной отрисовке DOM.

---

## 4. Основные изменённые файлы

| Файл | Описание изменений |
|------|-------------------|
| [`apps/desktop/src/components/SettingsModal.tsx`](file:///c:/git/type-club/type-club-monorepo/apps/desktop/src/components/SettingsModal.tsx) | **[NEW]** Модалка настроек приложения с вкладками Тема, Язык и словари, Горячие клавиши, формой и списком пользовательского словаря. |
| [`apps/desktop/src/components/MarkdownEditor.tsx`](file:///c:/git/type-club/type-club-monorepo/apps/desktop/src/components/MarkdownEditor.tsx) | Точное извлечение слова `getWordAtDocPos`, вывод вариантов исправлений и кнопки «Добавить в словарь» в контекстном меню. |
| [`apps/desktop/electron/main.ts`](file:///c:/git/type-club/type-club-monorepo/apps/desktop/electron/main.ts) | Настройка Hunspell, IPC-хэндлеры для спеллчекер-словарей и пользовательских слов. |
| [`apps/desktop/electron/preload.ts`](file:///c:/git/type-club/type-club-monorepo/apps/desktop/electron/preload.ts) | Мост `window.api` для спеллчекера (`isWordMisspelled`, `getWordSuggestions`, `addCustomWord`, `removeCustomWord`). |
| [`apps/desktop/src/types.ts`](file:///c:/git/type-club/type-club-monorepo/apps/desktop/src/types.ts) | Типизация `IElectronAPI` для словарей и спеллчекера. |
| [`apps/desktop/src/components/SettingsPopup.tsx`](file:///c:/git/type-club/type-club-monorepo/apps/desktop/src/components/SettingsPopup.tsx) | Кликабельный пункт «Настройки» для открытия `SettingsModal`. |
| [`apps/desktop/src/components/TitleBar.tsx`](file:///c:/git/type-club/type-club-monorepo/apps/desktop/src/components/TitleBar.tsx) | Состояние модалки настроек и прослушивание события `open-settings`. |
| [`packages/editor/src/EditorCore.tsx`](file:///c:/git/type-club/type-club-monorepo/packages/editor/src/EditorCore.tsx) | Явный атрибут `attributes: { spellcheck: 'true' }` на DOM-элементе ProseMirror. |
| [`packages/editor/src/i18n/`](file:///c:/git/type-club/type-club-monorepo/packages/editor/src/i18n/) | Новые ключи для модалки настроек, словарей и пунктов контекстного меню. |
| [`apps/web/src/context/LanguageContext.tsx`](file:///c:/git/type-club/type-club-monorepo/apps/web/src/context/LanguageContext.tsx) | Контекст языка веб-приложения с персистенцией в `localStorage`. |
| [`apps/web/src/components/ThemeSwitcher.tsx`](file:///c:/git/type-club/type-club-monorepo/apps/web/src/components/ThemeSwitcher.tsx) | Переключатель языка (English / Русский) в шапке веб-приложения. |
| [`apps/desktop/src/components/MenuBar.tsx`](file:///c:/git/type-club/type-club-monorepo/apps/desktop/src/components/MenuBar.tsx) | Подменю **View → Language → English / Русский**, локализация пунктов меню. |
| [`apps/web/src/components/CommentSection.tsx`](file:///c:/git/type-club/type-club-monorepo/apps/web/src/components/CommentSection.tsx) | Полный перевод секции комментариев и относительного времени. |
| [`apps/web/src/components/ArticleStats.tsx`](file:///c:/git/type-club/type-club-monorepo/apps/web/src/components/ArticleStats.tsx) | Локализация счетчиков просмотров, лайков и копирования ссылки. |
| [`apps/web/src/components/ErrorBoundary.tsx`](file:///c:/git/type-club/type-club-monorepo/apps/web/src/components/ErrorBoundary.tsx) | Компонент предохранителя веб-приложения от упавших компонентов. |
| [`apps/web/vite.config.ts`](file:///c:/git/type-club/type-club-monorepo/apps/web/vite.config.ts) | Зафиксирован `port: 5173` и `strictPort: true`. |

---

## 5. Результаты тестирования и проверки

- **Сборка Core (@type-club/editor)**: `npx tsc --noEmit -p packages/editor/tsconfig.json` → `0` ошибок.
- **Сборка Desktop (TypeScript)**: `npx tsc --noEmit -p apps/desktop/tsconfig.json` → `0` ошибок.
- **Сборка Web (Vite / TypeScript)**: `npm run build:web` → `0` ошибок.
- **Проведенные сценарии проверки**:
  - Переключение языка в веб-версии (`ThemeSwitcher`) → мгновенное обновление текста на странице, в шапке, на странице чтения `ReadArticle`, комментариях и редакторе без перезагрузки.
  - Переключение языка в десктоп-версии (`View → Language`) → обновление всех меню, сайдбара, вкладок, ToC, диалогов и контекстных меню.
  - Сохранение языка в `localStorage` на вебе и `electron-store` на десктопе при перезапуске приложения.

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