# Security Recommendations

Сводка замечаний по аудиту безопасности перед open-source публикацией.

## Выполнено (ветки `monorepo-prep`)

### type-club-web
- [x] Убраны хардкод-секреты из `config.py` (БД, JWT, SMTP, продакшн URL)
- [x] Убрана авто-модерация по email-матчингу в `auth.py`
- [x] Переименована Docker-сеть из `eatsmart_bot_eatsmart_net` в `type-club-net`
- [x] Убрана ссылка на внутреннюю инфраструктуру из `AGENTS.md`
- [x] Создан `.env.example` с плейсхолдерами
- [x] `.npmrc` переключён с китайского зеркала на `registry.npmjs.org`

### type-club
- [x] `log.txt` удалён из git-трекинга
- [x] Хардкод-путь в `deploy-release.sh` заменён на `TYPECLUB_DOWNLOADS_DIR`
- [x] Все ссылки на `type-club.ru` вынесены в `src/config.ts`
- [x] README clone URL обновлён

## Нужно сделать вручную на проде

### Критично — сменить секреты
- [ ] **SMTP пароль** (`support@type-club.ru` на mail.ru) — сгенерировать новый в ЛК mail.ru
- [ ] **Пароль БД** (`eatsmart` / `eatsmart_pass`) — сменить в PostgreSQL и обновить `.env`
- [ ] **JWT secret** — сгенерировать новый (`openssl rand -hex 32`)
- [ ] **SECRET_KEY** приложения — сгенерировать новый

### Рекомендовано
- [ ] Удалить БД-креды из `.vscode/settings.json` (на проде)
- [ ] Переименовать Docker-сеть на проде (`eatsmart_bot_eatsmart_net` → `type-club-net`)
- [ ] Обновить `docker-compose.yml` на проде после переименования сети
- [ ] Назначить модератора вручную через БД (авто-промоушн убран)

## Открытые вопросы

### Git-история
- [ ] В коммитах type-club-web присутствует email `159796331+chebukeks@users.noreply.github.com` — реврайт истории или оставить?

### Mail.ru verification token
- [ ] `frontend/index.html:5` — `<meta name="mailru-domain" content="ZKHKvXkMA7e4uGzp" />` — токен публичный, но подтверждает владение доменом на Mail.ru

### Production domain
- [ ] Имя домена `type-club.ru` остаётся в комментариях и тексте — это публичное имя проекта, допустимо
- [ ] Nginx-конфиги содержат `server_name type-club.ru` — допустимо, если репо публичный

### CORS
- [ ] `backend/app/main.py:19` — `allow_origins=["*"]` — за nginx допустимо, но при прямом доступе к контейнеру — риск
