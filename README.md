# Type Club

A modern Markdown editing platform — WYSIWYG editor, desktop app, web publishing, and real-time collaboration in one monorepo.

- **Editor** — ProseMirror-based WYSIWYG with seamless mode, LaTeX math, interactive tables with DnD, built-in spellcheck, fullscreen image & Mermaid diagram lightbox with pan/zoom, focus modes, suggestion mode, and interactive ToC
- **Desktop** — Electron app with offline spellchecking, customizable day/night themes, local file system access, relative link resolution, image context menus, and publishing to type-club.ru
- **Web** — React SPA with JWT auth, article management, role-based access (author / co-author / advisor), and collaborative editing
- **Backend** — FastAPI + PostgreSQL with secure image upload & auto-cleanup, collaboration API & slug generation
- **Collab server** — Yjs CRDT-based WebSocket server for real-time multi-cursor editing

## Monorepo structure

```text
├── apps/
│   ├── web/            # React SPA (Tailwind CSS v4, Vite)
│   └── desktop/        # Electron desktop app (TypeScript, Vite)
├── packages/
│   └── editor/         # Core ProseMirror WYSIWYG editor package (@type-club/editor)
├── backend/            # FastAPI REST API (SQLAlchemy async, PostgreSQL)
├── services/
│   └── collab-server/  # Real-time WebSocket collaboration server (Yjs CRDT)
└── nginx/              # Production reverse proxy configuration
```

## Quick start

```bash
git clone https://github.com/chebukeks/type-club-monorepo.git
cd type-club-monorepo
npm install

# Start desktop app (connected to production type-club.ru)
npm run dev:desktop

# Or start desktop app connected to local backend (http://localhost:8000)
npm run dev:desktop:local
```

## Local development

### Full stack with Docker

Requires [Docker](https://docs.docker.com/get-started/).

```bash
# 1. Create local env
cp .env.local.example .env.local

# 2. Start backend, database, collab server, and mail catcher
docker compose -f docker-compose.local.yml up

# 3. Start web frontend (in a separate terminal)
npm run dev:web
# → http://localhost:5173
```

### Native backend without Docker (optional)

If you prefer running the Python backend locally:

```bash
cd backend
python -m venv .venv
# Linux/macOS: source .venv/bin/activate
# Windows: .venv\Scripts\activate
pip install -r requirements.txt
python -m app.main
```

### Local ports reference

| Service | URL / Port | Description |
|---|---|---|
| **Web Frontend** | `http://localhost:5173` | React SPA |
| **Desktop Dev** | `http://localhost:5174` | Electron Vite dev server |
| **Backend API** | `http://localhost:8000` | FastAPI REST API (`/api/docs` in dev) |
| **Collab Server** | `ws://localhost:8001/collab` | Yjs WebSocket server |
| **Mailpit** | `http://localhost:8025` | Local email capture web UI |
| **PostgreSQL** | `localhost:5432` | Database (via Docker) |

### How email verification works locally

Mailpit catches all outgoing emails. After registering:
1. Open http://localhost:8025
2. Find the verification email
3. Click the link inside it

### Building for production

```bash
# Build web SPA (output in apps/web/dist)
npm run build:web

# Build desktop app packages (output in apps/desktop/release)
npm run build:desktop

# Build both web and desktop
npm run build
```

### npm registry note

The `.npmrc` files use `registry.npmmirror.com` (a mirror that works reliably from Russia). Remove or replace if you need the default npmjs.org.

## Documentation

- [Development Guide](DEVELOPMENT_GUIDE.md) — architecture, conventions, editor internals
- [Deployment Guide](DEPLOY.md) — production deployment and desktop release publishing
- [Security Policy](SECURITY.md) — vulnerability reporting and security measures
- [Project Status](PROJECT_STATUS.md) — feature roadmap and implementation status

## License

[MIT](LICENSE)
