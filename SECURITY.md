# Security Recommendations

Сводка замечаний по аудиту безопасности перед open-source публикацией.

## Выполнено (ветки `monorepo-prep`)

### type-club-web
- [x] Убраны хардкод-секреты из `config.py` (БД, JWT, SMTP, продакшн URL)
- [x] Убрана авто-модерация по email-матчингу в `auth.py`
- [x] Переименована Docker-сеть из `eatsmart_bot_eatsmart_net` в `type-club-net` (в коде; на проде — см. ниже)
- [x] Убрана ссылка на внутреннюю инфраструктуру из `AGENTS.md`
- [x] Создан `.env.example` с плейсхолдерами
- [x] `.npmrc` переключён с китайского зеркала на `registry.npmjs.org` (позже возвращён обратно — из РФ npmjs.org недоступен)

### type-club
- [x] `log.txt` удалён из git-трекинга
- [x] Хардкод-путь в `deploy-release.sh` заменён на `TYPECLUB_DOWNLOADS_DIR`
- [x] Все ссылки на `type-club.ru` вынесены в `src/config.ts`
- [x] README clone URL обновлён

## Нужно сделать вручную на проде

### Критично — сменить секреты
- [ ] **SMTP пароль** — сгенерировать новый в ЛК почтового сервиса
- [ ] **Пароль БД** — сменить в PostgreSQL и обновить `.env`
- [ ] **JWT secret** — сгенерировать новый (`openssl rand -hex 32`)
- [ ] **SECRET_KEY** приложения — сгенерировать новый

### Рекомендовано
- [ ] Удалить БД-креды из `.vscode/settings.json` (на проде)
- [ ] Переименовать Docker-сеть на проде (`eatsmart_bot_eatsmart_net` → `type-club-net`)
- [ ] Обновить `docker-compose.yml` на проде после переименования сети
- [ ] Назначить модератора вручную через БД (авто-промоушн убран)

## Открытые вопросы

### Production domain
- [x] Имя домена `type-club.ru` остаётся в комментариях и тексте — это публичное имя проекта, допустимо
- [x] Nginx-конфиги содержат `server_name type-club.ru` — допустимо, если репо публичный

## Выполнено (2026-07-26 — подготовка к open-source)

- [x] Email в git-истории заменён на `159796331+chebukeks@users.noreply.github.com` (210 коммитов, filter-branch)
- [x] Токен Mail.ru удалён из `apps/web/index.html`
- [x] CORS: `allow_credentials=False` (JWT через Authorization header, куки не используются)
- [x] `docker-compose.yml`: сеть переименована в `type-club-net`
- [x] `.npmrc`: зеркало заменено на `registry.npmjs.org`
- [x] Креды в SECURITY.md обезличены
- [x] Обход сервисного токена исправлен (`articles.py:540` — теперь 500 вместо пропуска)
- [x] Валидация SERVICE_TOKEN при старте collab-server (выход с ошибкой если не задан)
- [x] `.gitignore` дополнен (`*.pem`, `*.key`, `credentials*`, `*.sql`, `*.dump`)
- [x] Добавлен `LICENSE` (MIT)
- [x] Добавлен `README.md`
- [x] `docker-compose.local.yml` + `.env.local` для локальной разработки
- [x] `vite.config.ts`: WebSocket-прокси `/collab`
- [x] `useCollaboration.ts`: динамический collab URL (dev/prod автоматически)

## История изменений

### 2026-07-03 — Настройка монорепы
- [x] Очищены секреты из исходного кода (config.py, auth.py)
- [x] Обновлён .gitignore, исключены .env, log.txt, .vscode/
- [x] Добавлен .env.example с плейсхолдерами
- [x] Добавлен SECURITY.md
- [ ] **Сменить GitHub PAT** — токен передавался в shell-командах, мог остаться в истории терминала
- [ ] **Сменить продакшн-секреты** — SMTP пароль, БД пароль, JWT secret (см. раздел «Нужно сделать вручную»)
