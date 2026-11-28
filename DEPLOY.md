# Развёртывание (Deployment)

## Веб-версия (type-club.ru)

### Сборка

```bash
cd /path/to/type-club-monorepo
npm run build:web          # → apps/web/dist/
```

### Деплой фронтенда

```bash
# Скопировать собранные файлы в директорию nginx
sudo cp -r apps/web/dist/* /usr/share/nginx/type-club/
sudo nginx -s reload
```

### Бэкенд

```bash
cd /path/to/type-club-monorepo
docker compose up -d --build
```

Для первого запуска — скопировать `.env.example` в `.env` и заполнить реальными значениями.

## Десктоп-версия (релизы)

### Сборка релизов

```bash
cd /path/to/type-club-monorepo/apps/desktop
npm run build          # tsc + vite + electron-builder --linux --win
```

Артефакты: `apps/desktop/release/<version>/`

### Публикация на сайт

```bash
cd /path/to/type-club-monorepo/apps/desktop
TYPECLUB_PATCH_NOTES_FILE=/path/to/patch-notes.txt \
  TYPECLUB_DOWNLOADS_DIR=/usr/share/nginx/downloads ./deploy-release.sh
```

При повышении версии укажите путь к текстовому файлу с патчноутом для этого релиза. Используйте UTF-8 и пишите по одному пункту на строку без маркеров. Можно добавить до восьми пунктов по 250 символов, пустые строки пропускаются. Скрипт добавит их в `releaseNotes` в `latest.json`, откуда их прочитает окно обновления. Для релиза без патчноута опустите `TYPECLUB_PATCH_NOTES_FILE`.

### Docker-сборка (кроссплатформенная)

```bash
cd /path/to/type-club-monorepo/apps/desktop
docker compose up --build
# Артефакты в ./release/
```

## Переключение со старых репозиториев

### Было → Стало

| Компонент | Старый путь | Новый путь (монорепа) |
|-----------|-------------|----------------------|
| Веб-фронтенд | `type-club-web/frontend/dist/` | `type-club-monorepo/apps/web/dist/` |
| Бэкенд | `type-club-web/backend/` | `type-club-monorepo/backend/` |
| Десктоп | `type-club/` | `type-club-monorepo/apps/desktop/` |
| Nginx config | `type-club-web/nginx/` | `type-club-monorepo/nginx/` |
| Docker Compose | `type-club-web/docker-compose.yml` | `type-club-monorepo/docker-compose.yml` |
