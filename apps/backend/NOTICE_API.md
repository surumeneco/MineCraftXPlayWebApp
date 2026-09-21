# Notice API and database operations

Canonical requirements: Google Drive `forGPT/XPlayServer/周辺アプリ/Webアプリ設計詳細/お知らせ設計.md`. Code in this repository has not been deployed to the production VPS.

## Local setup

1. Copy `.env.example` to `.env` in the repository root; configure PostgreSQL.
2. Set `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, and `DISCORD_REDIRECT_URI` to enable Discord login. In local development use `http://localhost:3001/api/auth/discord/callback`, registered exactly as a Discord OAuth2 redirect. `ADMIN_DISCORD_IDS` is a comma-separated **initial administrator bootstrap** allow-list: it only grants a role when no administrator exists yet. Once admins exist, they grant/remove roles in the account administration page. Use HTTPS and Secure cookies in production.
3. Set `FRONTEND_ORIGIN` to the browser origin, `NUXT_PUBLIC_API_BASE` to the API base URL, and `PUBLIC_API_BASE` to the same externally reachable API base URL (no trailing slash). Configure an HTTPS reverse proxy in production; do not expose PostgreSQL.
4. Run `npm ci` at repository root and then `npm run dev`. This starts Docker PostgreSQL and the Nuxt/NestJS host processes. The backend applies migrations before listening. Explicit migration: `npm run db:migrate --workspace @xplay/backend` with `DATABASE_URL` provided.

`postgres@3.4.7` and TypeScript 6 are present in the checked-in lockfile. Database access uses `postgres.js` through the shared NestJS `Database` provider and versioned, checksummed SQL migrations (not an ORM). Never rewrite an applied migration: add a new one.

## Public REST APIs

- `GET /api/notices` returns published notices compatible with the existing frontend.
- `GET /api/notices/:title` returns a published article or 404.
- `GET /api/tags` returns tags linked to published notices only.
- `GET /api/images/:id` returns public images when their notice is published; otherwise administrator rights are required. No public image listing.

## Account authentication and administration

- `GET /api/auth/discord` starts Discord OAuth2 for **any Discord user** (not only administrators).
- `GET /api/auth/discord/callback` validates Discord, creates an internal account on first login or finds the account by linked Discord ID, issues HttpOnly session/CSRF cookies, and redirects to `/account`.
- `GET /api/auth/session` returns `authenticated`, `account_id`, `is_admin`, and (only when the cookie matches) `csrf_token`.
- `POST /api/auth/logout` logs out any authenticated account.
- `GET /api/admin/accounts` lists internal UUIDs, linked Discord IDs, creation dates and roles (admin only).
- `PATCH /api/admin/accounts/:id/role` with `{ "is_admin": true|false }` grants/revokes administrator role (admin only). Removing the final administrator is forbidden.
- `POST /api/admin/accounts/merge` with `{ "target_account_id": "UUID", "source_account_id": "UUID" }` merges two accounts (admin only). Source Discord IDs and image ownership move to target, administrator role is inherited, source sessions are invalidated, and source record is deleted transactionally. Check that the accounts belong to the same person before merging.

`accounts` contains only UUID and created timestamp; Discord IDs live in `account_discord_identities` with a globally unique ID and many-to-one account relation; administrator roles live in `account_roles`; sessions use internal account IDs (`account_sessions`). Additional account-specific data should reside in dedicated account-ID foreign-keyed tables. Migration `002_accounts.sql` transfers old admin accounts, sessions and image ownership without discarding existing notice data. Current role is looked up per request, so removing a role immediately revokes admin APIs. `ADMIN_DISCORD_IDS` never overrides an existing administrators' database-controlled role assignments.

All write requests must supply a valid session cookie, allowed `Origin` and `X-XPlay-CSRF` from `/api/auth/session`. Administrator APIs additionally enforce current account role on the backend, not just in frontend navigation. Unconfigured OAuth must not allow anonymous writes.

## Administrator notice REST APIs

- `GET /api/admin/notices[?status=draft|published|unpublished]`: administrator listing.
- `GET /api/admin/notices/:id`: detail by UUID.
- `POST /api/admin/notices`: create draft. Body: `{ "title": "記事", "body_delta": {"ops":[{"insert":"本文\n"}]}, "tags": ["重要"], "upload_session_id": "UUID" }`.
- `PATCH /api/admin/notices/:id`: edit with fields above and `expected_version`; published title immutable, only draft may be empty.
- `POST /api/admin/notices/:id/publish`: `{ "expected_version": 1 }` publishes, resets published and updated timestamps together.
- `POST /api/admin/notices/:id/unpublish`: `{ "expected_version": 2 }` takes down a published notice.
- `DELETE /api/admin/notices/:id`: `{ "expected_version": 3 }` physically deletes draft or unpublished article, never published.
- `GET /api/admin/tags`: all registered tags.

Every editing/status transition increments version; stale expected_version yields 409. Database globally enforces unique exact titles, tags and notice updates in one transaction. The administration UI has separate listing (`/admin/notices`), new (`/admin/notices/new`) and edit (`/admin/notices/:id/edit`) routes with a shared editor component. Management navigation is only shown for administrators.

## Images

- `POST /api/admin/images`: JSON `{ "upload_session_id": "UUID", "purpose": "notice", "mime_type": "image/png", "data_base64": "..." }`. JPEG/PNG/WebP only, 5MiB maximum; signatures must match MIME.
- `DELETE /api/admin/images/:id`: delete owned temporary image.
- `DELETE /api/admin/images/sessions/:session`: discard owned, unassociated temporary images.
- `POST /api/admin/images/sessions/:session/refresh`: extend temporary retention.

Upload before first article save and insert URL at any Quill cursor position. Save associates referenced image IDs, deletes unreferenced temporary images and physically removes saved images absent from the new Delta, transactionally. Published images become public; unpublished images remain private. Expired temporary images (24 hours) are cleaned hourly. Physical deletion removes image bytes; image `purpose` supports future albums. Ownership now references `accounts.id`, not Discord ID.

## Verification

GitHub Actions workflow `Notice implementation verification` runs locked dependency install, PostgreSQL 18 migrations, backend unit/integration tests, frontend tests, both builds, backend Docker image and public/unauthorized API smoke tests. Verify the workflow run for the particular revision before deployment. Live Discord OAuth, production reverse proxy, browser operations and migration of a populated production database require additional real-environment verification. Never commit credentials.
