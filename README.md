# Type Club

A modern Markdown editing platform — WYSIWYG editor, desktop app, web publishing, and real-time collaboration in one monorepo.

- **Editor** — ProseMirror-based WYSIWYG with seamless mode, LaTeX math, interactive tables, focus modes
- **Desktop** — Electron app with local file system access and publishing to type-club.ru
- **Web** — React SPA with JWT auth, article management, and collaborative editing
- **Backend** — FastAPI + PostgreSQL with collaboration API
- **Collab server** — Yjs CRDT-based WebSocket server for real-time multi-cursor editing

## Quick start

```bash
git clone https://github.com/chebukeks/type-club-monorepo.git
cd type-club-monorepo
npm install

# Desktop app
npm run dev:desktop
```

## Local web development

Requires [Docker](https://docs.docker.com/get-started/).

```bash
# 1. Create local env
cp .env.local.example .env.local

# 2. Start backend, database, and collab server
docker compose -f docker-compose.local.yml up

# 3. Start web frontend (separate terminal)
npm run dev:web
# → http://localhost:5173
```

### How email verification works locally

Mailpit catches all outgoing emails. After registering:
1. Open http://localhost:8025
2. Find the verification email
3. Click the link inside it

### npm registry note

The `.npmrc` files use `registry.npmmirror.com` (a mirror that works reliably from Russia). Remove or replace if you need the default npmjs.org.

## Documentation

- [Development Guide](DEVELOPMENT_GUIDE.md) — architecture, conventions, editor internals
- [Security](SECURITY.md) — security audit and recommendations

## License

[MIT](LICENSE)
