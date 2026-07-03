# AGENTS.md

## Architecture

- **Two-package repo** (no monorepo tooling — run commands from each package dir).
- `backend/` — Python FastAPI, SQLAlchemy 2.0 async + asyncpg, no Alembic (tables auto-create on startup).
- `frontend/` — React 18, TypeScript, Vite 5, Tailwind CSS v4 (via `@tailwindcss/vite`), ProseMirror editor.
- Nginx configs in `nginx/` — `type-club.init.conf` (HTTP-only, for Let's Encrypt bootstrap) and `type-club.conf` (HTTPS prod).
- Docker Compose runs **backend only**; nginx + frontend + certbot are deployed separately (not in compose).

## Dev commands

```bash
# Frontend (from frontend/)
npm run dev      # Vite dev server on :5173, proxies /api → localhost:8000
npm run build    # tsc (typecheck) then vite build → dist/
npm run preview  # Preview production build locally

# Backend (from backend/)
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
# Or via Docker:
docker compose up
```

## Environment

- `.env` at repo root is loaded by `pydantic-settings` in `backend/app/config.py`.
- Database: PostgreSQL, configured via `DATABASE_URL` in `.env`.
- JWT auth via HS256 tokens (key from `JWT_SECRET_KEY` env var).
- `.npmrc` pins to `https://registry.npmmirror.com/` (Chinese mirror) — replace if unresolvable.

## Key conventions

- **No tests, no linter, no formatter, no CI** in the repo.
- The frontend build step includes `tsc` (typecheck), so AI-generated TypeScript must pass `npm run build`.
- Articles have four access states: `private`, `link`, `public`, `blocked`. Public articles are listed at `/articles`; authors see their own at `/my-articles`.
- The editor is the heart of the frontend — 19 custom ProseMirror plugins in `frontend/src/editor/`. When editing the editor, understand the plugin stack before modifying.
- Theme is dark/light/system, controlled by `data-theme` attribute and CSS custom properties in `index.css`. The flash-of-wrong-theme script in `index.html` must stay.

## Router cheat sheet

| Path | Purpose |
|---|---|
| `/` | Landing page |
| `/login`, `/register` | Auth |
| `/profile` | Edit profile (auth required) |
| `/articles` | Public articles list |
| `/my-articles` | User's own articles (auth required) |
| `/editor`, `/editor/:id` | Create/edit article (auth required) |
| `/:username/:slug` | Read a public/link-shared article |
| `/download` | Downloads page |
