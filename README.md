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

# Web app (requires backend — see DEVELOPMENT_GUIDE.md)
npm run dev:web

# Local backend + database
docker compose -f docker-compose.local.yml up
```

## Documentation

- [Development Guide](DEVELOPMENT_GUIDE.md) — architecture, conventions, editor internals
- [Security](SECURITY.md) — security audit and recommendations

## License

[MIT](LICENSE)
