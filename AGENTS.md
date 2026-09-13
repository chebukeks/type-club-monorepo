# AGENTS.md — Guidelines for AI Coding Assistants

This file provides rules, architectural context, and development guidelines for AI assistants working in this repository.

---

## 🔒 Privacy & Identity Rules (Strict)

1. **Git Author & Commits**:
   - For all git commits, PRs, and git author metadata, ALWAYS use the official GitHub identity:
     `chebukeks <159796331+chebukeks@users.noreply.github.com>`
   - NEVER use, infer, or output any personal email addresses (e.g. personal mailbox providers) that might appear in local OS environment variables, system paths, or tool outputs.

2. **No Personal Data in Code or Docs**:
   - In code examples, tests, fixtures, mocks, seeds, and documentation, use ONLY generic RFC-2606 placeholders:
     `user@example.com`, `support@example.com`, `test@example.com`, `noreply@type-club.ru`, or `user@localhost`.
   - Never hardcode personal emails or personal names of the author.

3. **Filesystem Path Hygiene**:
   - Never commit absolute local system paths containing user directories (e.g. `C:\Users\...` or `/home/...`).
   - Always use relative paths or environment variables.

4. **Secrets & Credentials**:
   - Never commit real passwords, API keys, tokens, or `.env` files with actual production secrets.
   - All real secrets must stay in untracked `.env` / `.env.local` files conforming to `.gitignore`.

---

## Repository Structure

Type Club is an npm workspaces monorepo:

- `packages/editor/`: Core ProseMirror WYSIWYG editor package (`@type-club/editor`), shared across web & desktop.
- `apps/web/`: Web application (React 18, TypeScript, Vite, Tailwind CSS v4).
- `apps/desktop/`: Desktop application (Electron, React, TypeScript, Vite).
- `backend/`: FastAPI REST API (SQLAlchemy 2.0 async, PostgreSQL, bcrypt, JWT).
- `services/collab-server/`: Real-time collaboration WebSocket server (Yjs CRDT).
- `nginx/`: Production reverse proxy configuration.

---

## Development Conventions

- **Type Safety**: The frontend and desktop builds include `tsc` type checking. All TypeScript code must compile without errors (`npm run build`).
- **Editor Architecture**: The editor uses a custom ProseMirror plugin pipeline in `packages/editor/src/editor/`. When editing editor behavior, inspect existing plugins before adding new ones.
- **Localization**: UI text across web, desktop, and editor is localized (Russian and English). Keep both translation tables updated when adding user-facing strings.
- **Git Hygiene**: Keep commits focused and atomic with descriptive commit messages.
