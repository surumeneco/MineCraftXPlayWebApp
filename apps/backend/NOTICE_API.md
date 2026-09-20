# Notice API and database operations

Canonical requirements: Google Drive `forGPT/XPlayServer/周辺アプリ/Webアプリ設計詳細/お知らせ設計.md`. Do not infer that this implementation has been deployed or integration-tested merely because the files exist.

## Local setup

1. From the repository root, copy `.env.example` to `.env` and set PostgreSQL credentials.
2. Set `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, `DISCORD_REDIRECT_URI`, and `ADMIN_DISCORD_IDS` to enable administration. Obtain the first three from a Discord OAuth2 application. Set `DISCORD_REDIRECT_URI` to the full API callback URL, e.g. `http://localhost:3001/api/auth/discord/callback` in local development. The Discord application must authorize exactly that URI. Use HTTPS and Secure cookies in production.
3. Set `FRONTEND_ORIGIN` to the browser origin, `NUXT_PUBLIC_API_BASE` to its API base URL, and `PUBLIC_API_BASE` to the same externally reachable API base URL (without a trailing slash). Configure an HTTPS reverse proxy in production; do not expose PostgreSQL.
4. Run `npm install` at repository root to install workspace dependencies and synchronize the root lockfile, then `npm run dev`. `npm run dev` starts Docker PostgreSQL and launches the Nuxt and NestJS host processes. The backend startup applies migrations before listening. Docker Compose production also applies them before startup. To apply them explicitly: `npm run db:migrate --workspace @xplay/backend` with `DATABASE_URL` provided.

**Dependency note:** the root `package-lock.json` must be regenerated with the new `postgres@3.4.7` dependency before a clean `npm ci`. Do not use `npm ci` against an out-of-date lockfile. The current branch contains no assertion of successful local build unless explicitly tested.

## Public REST APIs

- `GET /api/notices` returns an array of published notices, in a format compatible with the existing frontend.
- `GET /api/notices/:title` returns exactly one published notice, or 404.
- `GET /api/tags` returns only tags associated with currently published notices.
- `GET /api/images/:id` returns public images only when their notice is published; other images require administrator authorization. There is no public image listing.

## Administrator authentication

- `GET /api/auth/discord` starts Discord OAuth2.
- `GET /api/auth/discord/callback` finishes login, sets HttpOnly session and CSRF cookies, and redirects to `/admin/notices`.
- `GET /api/auth/session` returns authenticated state and the CSRF token to a logged-in administrator.
- `POST /api/auth/logout` logs out.

All modifying admin requests must supply a session cookie, exact permitted `Origin`, and `X-XPlay-CSRF` from `/api/auth/session`. The administrator's Discord user ID must appear in `ADMIN_DISCORD_IDS`. Missing configuration cannot enable anonymous writes.

## Administrator notice REST APIs

- `GET /api/admin/notices[?status=draft|published|unpublished]`: administrator listing.
- `GET /api/admin/notices/:id`: detail by UUID.
- `POST /api/admin/notices`: create draft. Body: `{ "title": "記事", "body_delta": {"ops":[{"insert":"本文\n"}]}, "tags": ["重要"], "upload_session_id": "UUID" }`.
- `PATCH /api/admin/notices/:id`: edit with fields above and `expected_version`; published title is immutable; draft alone may have an empty body.
- `POST /api/admin/notices/:id/publish`: `{ "expected_version": 1 }` publishes and resets published/updated timestamps together.
- `POST /api/admin/notices/:id/unpublish`: `{ "expected_version": 2 }` takes down a published notice.
- `DELETE /api/admin/notices/:id`: `{ "expected_version": 3 }` physically deletes drafts or unpublished notices, not published notices.
- `GET /api/admin/tags`: all registered tags.

Every editing or status transition increments integer version; stale expected_version yields 409. The DB globally enforces unique exact titles. Tags and notice changes share a DB transaction.

## Images

- `POST /api/admin/images`: JSON `{ "upload_session_id": "UUID", "purpose": "notice", "mime_type": "image/png", "data_base64": "..." }`. Only JPEG/PNG/WebP (5MiB max) are accepted; actual magic bytes must match.
- `DELETE /api/admin/images/:id`: delete owned temporary image.
- `DELETE /api/admin/images/sessions/:session`: discard owned unassociated temporary images.
- `POST /api/admin/images/sessions/:session/refresh`: extend temporary retention.

Upload before the first notice save; the response contains a URL to insert at the Quill cursor. A notice save associates referenced image IDs, deletes unreferenced temporary images, and physically removes saved images omitted from the newly saved Delta, all in one transaction. Published notices' images become public, unpublished notices retain their images privately. A maintenance pass expires unassociated images after 24 hours, checking hourly. A physical notice deletion removes associated image binaries too.

The first iteration stores image bytes in PostgreSQL, purpose `notice`, with an explicit link table to permit different media purposes (e.g. future albums) without an image gallery or image reuse capability today.

## Verification

`npm run test:backend` exercises tests in `apps/backend/test`. Run `npm run build` and a PostgreSQL-backed request matrix (draft/edit/publish/unpublish/delete, title conflict, CSRF, images, timestamps) before promoting a feature branch to develop or production. Discord OAuth callback requires configured credentials and a real Discord application. Do not put credentials or production data in Git.
