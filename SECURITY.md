# Security Policy

We take the security of Type Club seriously. This document outlines our security policies, supported versions, and how to report vulnerabilities responsibly.

## Supported Versions

Only the latest release versions receive security updates and patches.

| Component | Supported | Notes |
| --------- | --------- | ----- |
| Desktop App | :white_check_mark: | Latest version on `main` / GitHub releases |
| Web Frontend | :white_check_mark: | Latest deployment / `main` |
| Backend API | :white_check_mark: | Latest deployment / `main` |
| Collab Server | :white_check_mark: | Latest deployment / `main` |

---

## Reporting a Vulnerability

If you discover a security vulnerability in Type Club, please do **not** disclose it publicly via GitHub issues or discussions until it has been reviewed and addressed.

### How to Report

1. **GitHub Security Advisory (Preferred)**:
   Navigate to the repository's **Security** tab and click **"Report a vulnerability"** to submit a private vulnerability report.
2. **Contacting Maintainers**:
   If private vulnerability reporting is unavailable, please open a confidential report or contact the maintainers directly through GitHub profiles associated with this repository.

### What to Include in Your Report

To help us investigate and resolve the issue quickly, please provide:
- A clear description of the vulnerability and its potential impact.
- Step-by-step reproduction instructions or a minimal Proof of Concept (PoC).
- Affected components (Desktop, Web, Backend, Collab Server, Editor package).
- Any proposed mitigations or remediation steps if you have them.

### Response Timeline

- **Initial Response**: Within 48 hours, confirming receipt of your report.
- **Triage & Assessment**: Within 5 business days, with severity evaluation and next steps.
- **Resolution & Release**: A fix will be developed in private and released promptly, after which a public security advisory will be published acknowledging the reporter (if desired).

---

## Security Architecture & Defenses

Type Club implements multiple defense-in-depth measures across its stack:

### 1. Authentication & Credentials
- **Password Hashing**: Stored using modern salted `bcrypt` algorithms.
- **JWT Authorization**: Stateless authentication via `HS256` tokens passed in standard `Authorization: Bearer` headers. Cookies are not used for token storage, mitigating CSRF risks.
- **Token Expiration**: Access tokens and one-time verification tokens (email confirmation, password reset) have strict TTL expiration periods.
- **Environment Isolation**: Production secrets (JWT keys, DB credentials, SMTP tokens) are strictly injected via environment variables and never hardcoded in repository files.

### 2. File Upload & Storage Security
- **Strict Role Validation**: Image uploads are permitted only for online articles by authorized authors and co-authors.
- **Strict Quotas**:
  - Maximum single file size: 10 MB.
  - Cumulative storage quota per article: 500 MB.
- **Magic Bytes & Binary Verification**:
  - Permitted image formats: PNG, JPEG, GIF, WEBP, SVG.
  - Real file headers and binary signatures are verified on the backend, not relying on client MIME types or file extensions.
- **Stored XSS Prevention**:
  - SVG files are strictly parsed and sanitized. Any files containing embedded `<script>`, inline event handlers (`onload`, `onerror`, etc.), or `javascript:` URI schemes are rejected with HTTP 400.
- **Path Traversal Protection**:
  - Uploaded files are renamed using secure `uuid4()` identifiers. User-provided filenames are never used in file system paths.
  - Assets are compartmentalized in isolated directory structures (`uploads/articles/{article_id}/`).
- **Orphan File Cleanup**: Periodic background worker automatically scans and purges uploaded files that are no longer referenced in article content.

### 3. Collaboration & Real-Time Sync
- **Mutual Service Authentication**: Internal communication between the real-time collaboration server (`collab-server`) and the FastAPI backend requires a pre-shared `SERVICE_TOKEN`.
- **WebSocket Access Control**: On connection, the collaboration server validates user tokens and queries backend article access permissions before synchronizing Yjs CRDT document states.
- **Document Integrity**: Yjs document updates are synchronized incrementally and debounced before persistent storage, preventing race conditions or document overwrite bugs.

### 4. Client & Desktop Security
- **Electron Security**: Context isolation is enabled in the desktop application, with restricted IPC channels exposed via `preload.ts`.
- **CORS Configuration**: The backend restricts cross-origin resource sharing to prevent unauthorized cross-origin requests.
