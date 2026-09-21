# Notice API and database operations

Canonical requirements: Google Drive `forGPT/XPlayServer/周辺アプリ/Webアプリ設計詳細/お知らせ設計.md`, especially the second UI/account extension in section 11. The application has not been deployed to the production VPS.

## Local setup

1. Copy root `.env.example` to `.env` and configure PostgreSQL.
2. Configure `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET` and `DISCORD_REDIRECT_URI`. Register `http://localhost:3001/api/auth/discord/callback` verbatim as a Discord OAuth2 redirect for local development. Login is available to any Discord user, not only administrators.
3. `ADMIN_DISCORD_IDS` (comma-separated Discord IDs) grants admin on login **only when no DB administrator exists**. Once set up, administrator role is managed in `/admin/accounts/:id/edit`. **Keep the initial administrator Discord IDs in this environment variable:** an account currently holding admin rights and linked to one of these IDs cannot be demoted, deleted, or used as a merge source. Its name and non-role profile information remain editable. The final admin cannot be removed.
4. Set `FRONTEND_ORIGIN` to the browser origin, and both `NUXT_PUBLIC_API_BASE` and `PUBLIC_API_BASE` to the external API base URL without a trailing slash. Configure HTTPS/reverse proxy and Secure cookies in production. Never expose PostgreSQL publicly.
5. Run `npm ci` from repository root, then `npm run dev`; Docker PostgreSQL, Nuxt and NestJS start, with migrations before backend listen. Explicit migration: `npm run db:migrate --workspace @xplay/backend` with `DATABASE_URL`.

`postgres@3.4.7` and TypeScript 6 are in the lockfile. Shared NestJS `Database` provider uses postgres.js and checksummed, versioned SQL migrations. **Never edit an already applied migration**: `001_notices.sql`, `002_accounts.sql`, and additive `003_account_profiles.sql` are retained.

## Public APIs

- `GET /api/notices`: published notices, frontend-compatible schema.
- `GET /api/notices/:title`: published article or 404.
- `GET /api/tags`: only tags associated with published articles.
- `GET /api/images/:id`: public only for published article images. Private/temporary images require appropriate administrator and ownership; no public listing.

## Authentication and account model

- `GET /api/auth/discord`: start OAuth2 with `identify` scope for any Discord user.
- `GET /api/auth/discord/callback`: validate OAuth2, find or create an internal account, update the authenticated Discord identity's `username` and `display_name` from Discord, issue HttpOnly cookies, then redirect to `/account`.
- `GET /api/auth/discord/refresh`: run OAuth2 again for the current logged-in Discord ID. Callback only accepts a result already associated with the same authenticated internal account; other linked IDs require login as that Discord identity for their profile refresh. Never accept arbitrary user-provided names as an authenticated Discord profile.
- `GET /api/auth/session`: authenticated, account_id, is_admin, and csrf_token when cookie matches.
- `POST /api/auth/logout`: revoke the session.

`accounts` holds UUID, name (non-unique, required) and created time. `account_discord_identities` maps globally unique Discord IDs to accounts and stores username/display name. `account_roles` holds `admin`; `account_sessions` references the internal account ID. `account_minecraft_identities` contains JE/BE edition and Minecraft **username**, not UUID, with multiple names per internal account and uniqueness on edition+name. Minecraft names are self-reported, **not authenticated**; never infer admin rights or confirmed ownership from them. Migration 002 preserves legacy administrators, sessions and image ownership; migration 003 backfills account/profile names and adds Minecraft identity records without rewriting 001/002.

Internal account names initialize from Discord global display name or username (fallback ID) at first login; subsequent logins refresh only their corresponding Discord profile. Existing manually chosen master names are not silently overwritten. Linked Discord IDs remain independent identifiers; accounts are never automatically merged from similar names.

### User account APIs (authenticated user)

- `GET /api/accounts/me`: own account record including internal name, role, Discord identities and Minecraft identities.
- `PATCH /api/accounts/me/name`: `{ "name": "表示名" }` (1–100 chars, non-unique).
- `POST /api/accounts/me/adopt-discord-name`: `{ "discord_id": "..." }`; copy name from a linked saved Discord profile into the internal account name.
- `POST /api/accounts/me/minecraft`: `{ "edition": "je"|"be", "username": "surumeneko164" }`; self-reported registration.
- `DELETE /api/accounts/me/minecraft/:identityId`: unlink own Minecraft username.

### Administrator account APIs

- `GET /api/admin/accounts`: all accounts with `name`, `discord_profiles`, `discord_ids`, `minecraft_ids`, `is_admin`, `is_protected` and creation date.
- `GET /api/admin/accounts/:id`: one account.
- `PATCH /api/admin/accounts/:id/name`: rename an account.
- `PATCH /api/admin/accounts/:id/role`: `{ "is_admin": true|false }`; protected initial admins and final admin cannot be demoted.
- `POST /api/admin/accounts/:id/discord`: `{ "discord_id": "..." }`; explicitly associate an unclaimed Discord ID. An ID cannot belong to two accounts.
- `DELETE /api/admin/accounts/:id/discord/:discordId`: unlink an identity, but not a protected initial identity or the last identity; sessions of modified accounts are invalidated.
- `POST /api/admin/accounts/:id/minecraft`: add `{ "edition": "je"|"be", "username": "..." }`.
- `DELETE /api/admin/accounts/:id/minecraft/:identityId`: unlink.
- `DELETE /api/admin/accounts/:id`: delete account only if not protected, not the final administrator, and with no images it owns. If images exist, merge into another account first.
- `POST /api/admin/accounts/merge`: `{ "target_account_id": "UUID", "source_account_id": "UUID" }`. Target preserves its UUID/name and inherits source admin role, Discord identities, Minecraft identities and image ownership. Source sessions expire and source account is deleted in one DB transaction. Initial protected admins can be targets, never sources. Confirm both accounts represent the same person before merging.

UI routes: `/account` for own profile, `/admin/accounts` for the master list, `/admin/accounts/:id/edit` for individual editing, and `/admin/accounts/merge` for a dedicated merge workflow. Header account icon shows login for unauthenticated users or details for signed-in users; administrator-only “マスタメンテ” menu includes account administration.

All mutation APIs require an authenticated session, allowed `Origin` and `X-XPlay-CSRF` from `/api/auth/session`; admin endpoints recheck the role server-side per request. Cookies use HttpOnly, SameSite and Secure in production. When OAuth is unconfigured, no anonymous admin write access is allowed.

## Administrator notice APIs

- `GET /api/admin/notices[?status=draft|published|unpublished]`: list notices.
- `GET /api/admin/notices/:id`: detail by UUID.
- `POST /api/admin/notices`: create a draft with `{ "title":"記事", "body_delta":{"ops":[{"insert":"本文\n"}]}, "tags":["重要"], "upload_session_id":"UUID" }`.
- `PATCH /api/admin/notices/:id`: edit with the above fields and `expected_version`; published title is immutable; only drafts can be empty.
- `POST /api/admin/notices/:id/publish`: `{ "expected_version": 1 }`; reset published/updated timestamps together.
- `POST /api/admin/notices/:id/unpublish`: `{ "expected_version": 2 }`.
- `DELETE /api/admin/notices/:id`: `{ "expected_version": 3 }`; physically delete drafts or unpublished articles only.
- `GET /api/admin/tags`: all registered tags.

State transitions increment version; stale version yields 409. DB enforces unique exact titles; tag/article updates and image reconciliation are transactional. UI separates list `/admin/notices`, new `/admin/notices/new` and edit `/admin/notices/:id/edit`, with shared Quill editor. Save, publish, unpublish, discard, return to list and physical deletion use custom confirmation dialogs. The user is warned about lost unsaved edits/temporary uploads.

## Images

- `POST /api/admin/images`: `{ "upload_session_id":"UUID", "purpose":"notice", "mime_type":"image/png", "data_base64":"..." }`; JPEG/PNG/WebP, <=5 MiB, validate signatures against MIME.
- `DELETE /api/admin/images/:id`: remove owned temporary image.
- `DELETE /api/admin/images/sessions/:session`: discard owned unassociated temporary images.
- `POST /api/admin/images/sessions/:session/refresh`: extend temporary retention.

Upload before first notice save, insert returned URL at arbitrary Quill cursor position. Saving associates referenced images and removes unreferenced temporary or previously attached-but-now-removed images in one transaction. Only published article images are publicly readable; withdrawing an article retains its images privately. Temporary unassociated images expire after 24 hours and are cleaned hourly. Physical article deletion removes owned image bytes. Image `purpose` supports future albums. Image ownership references `accounts.id`, never a Discord ID.

## Verification

The `Notice implementation verification` GitHub Actions workflow runs locked dependency install, PostgreSQL 18 migrations, backend unit/integration tests including populated legacy migration and protected-admin cases, frontend tests, both builds, backend production container, and public/unauthorized API smoke checks. Check results for the exact deployed revision. Production VPS deployment, actual Discord OAuth flow, production reverse proxy/cookie behavior, real production-data backup/migration and browser/mobile E2E require separate verification. Never commit credentials.
