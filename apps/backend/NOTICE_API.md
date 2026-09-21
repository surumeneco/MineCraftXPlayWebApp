# Notice API and database operations

Canonical requirements: Google Drive `forGPT/XPlayServer/周辺アプリ/Webアプリ設計詳細/お知らせ設計.md`, including the latest reversible account-merge amendments. Production VPS deployment is not verified.

## Local setup

1. Copy root `.env.example` to `.env`; configure PostgreSQL.
2. Set `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, `DISCORD_REDIRECT_URI`. For local development register `http://localhost:3001/api/auth/discord/callback` verbatim with Discord OAuth2. Login is available to all Discord users.
3. `ADMIN_DISCORD_IDS` is a comma-separated bootstrap list, used only when DB has no administrator. Keep protected initial administrator IDs configured: matching authenticated accounts cannot have the role revoked, be deleted, or be merged **as the source**. They can be merge destinations. At least one administrator must remain.
4. Set `FRONTEND_ORIGIN` and external API bases `NUXT_PUBLIC_API_BASE`/`PUBLIC_API_BASE` without trailing slashes. Configure HTTPS and Secure cookies in production; do not expose PostgreSQL publicly.
5. Run `npm ci`, then `npm run dev`. Explicit migrations: `npm run db:migrate --workspace @xplay/backend` with `DATABASE_URL`.

Shared `Database` provider uses postgres.js (`postgres@3.4.7` in lockfile), with checksummed incremental SQL migrations. **Never modify an applied migration.** Keep 001 notices, 002 legacy account transition, 003 account profile defaults; 004 adds reversible account merge metadata. Test the actual deployed revision and back up production DB before migration.

## Public APIs

- `GET /api/notices`: published notices in frontend-compatible schema.
- `GET /api/notices/:title`: published article; non-public or absent returns 404.
- `GET /api/tags`: tags associated with published articles only.
- `GET /api/images/:id`: published article images accessible publicly; private and temporary images need ownership/admin authorization; no public image listing.

## Authentication and account model

- `GET /api/auth/discord`: begin `identify`-scope Discord OAuth2 for any Discord account.
- `GET /api/auth/discord/callback`: validate state and Discord identity, find/create internal account, update authenticated Discord username/display name, issue HttpOnly session cookies and redirect to `/account`.
- `GET /api/auth/discord/refresh`: OAuth refresh for the currently authenticated Discord identity only. Refresh cannot switch to another account or accept client-asserted Discord names; other linked identities must log in independently to refresh their own profile.
- `GET /api/auth/session`: authentication state, internal account ID, `is_admin`, CSRF token when supplied cookies match.
- `POST /api/auth/logout`: revoke session.

`accounts` holds internal UUID, non-unique required account name and creation time. `account_discord_identities` maps globally unique Discord IDs to accounts and stores fetched usernames/display names. `account_roles` stores `admin`, and `account_sessions` references internal accounts. `account_minecraft_identities` stores self-reported JE/BE username (not UUID); multiple per account and globally unique `(edition,username)`. Minecraft names do not prove ownership and cannot determine permissions. Migration 002 preserves legacy administrators/sessions/image ownership; 003 backfills account names and profile fields without rewriting old migrations.

A new account starts with the Discord global display name, or username, or Discord ID fallback. Subsequent logins update only that Discord identity's profile. Account name does not silently change; it is read-only in the UI, and the user or administrator may explicitly adopt an **existing fetched** linked Discord profile name. Placeholder-only profiles cannot be adopted. Arbitrary account-name update APIs do not exist. Similar Discord names never trigger automatic merging.

### Authenticated user account APIs

- `GET /api/accounts/me`: active internal account, linked Discord profiles, roles and Minecraft usernames.
- `POST /api/accounts/me/adopt-discord-name`: `{ "discord_id": "..." }`; adopt a fetched Discord name from one of the account's linked profiles. No arbitrary name strings.
- `POST /api/accounts/me/minecraft`: `{ "edition": "je"|"be", "username": "..." }`; self-reported registration.
- `DELETE /api/accounts/me/minecraft/:identityId`: remove one own Minecraft name; transferred identities must first be separated.

### Administrator account APIs

- `GET /api/admin/accounts`: list active accounts, including `merged_sources` for merge destinations; merge sources are retained in DB but hidden from this normal list.
- `GET /api/admin/accounts/:id`: one **active** account and its associated Discord/Minecraft identities; a dormant merged source is not individually accessible until restored.
- `POST /api/admin/accounts/:id/adopt-discord-name`: `{ "discord_id": "..." }`; adopt a linked fetched Discord profile name; admin/CSRF required.
- `PATCH /api/admin/accounts/:id/role`: `{ "is_admin": true|false }`. Protected admins and final administrator cannot be demoted; active merged accounts' roles cannot be modified until separation.
- `DELETE /api/admin/accounts/:id/discord/:discordId`: unlink an existing identity (not the protected initial or final identity), revoke affected sessions. During an active merge, unlinking identities from either participant is forbidden to preserve reversibility.
- `POST /api/admin/accounts/:id/minecraft`, `DELETE /api/admin/accounts/:id/minecraft/:identityId`: manage self-reported names. Do not remove transferred rows before separation.
- `DELETE /api/admin/accounts/:id`: reject protected/final administrators, image owners and **any account ever involved in a merge**, even after separation, to retain history.
- `POST /api/admin/accounts/merge`: `{ "target_account_id": "UUID", "source_account_id": "UUID" }`; merge two distinct existing active accounts after confirmation. Source must not be a protected initial administrator. Returns active account list.
- `POST /api/admin/accounts/merges/:source/restore`: separate an active merged source; returns active account list. Admin/CSRF required; a source without an active merge returns 404. This restores available recorded ownership, not already physically deleted content.

**Manual Discord ID creation is disabled:** `POST /api/admin/accounts/:id/discord` no longer exists. To link profiles, choose an existing account in the editor's merge dropdown. There is no separate `/admin/accounts/merge` frontend page; `/admin/accounts/:id/edit` is the merge source editor, and it provides a confirmation dialog and an existing-account destination dropdown. The destination editor displays its merged sources with confirmation-backed separation. `/admin/accounts` only lists accounts and opens their editors; `/account` edits the current user's permitted information. Mobile account navigation uses an accordion.

### Merge and separation semantics (migration 004)

- `account_merges` stores the immutable source/target UUIDs, their pre-merge `admin` flags, `merged_at`, optional `restored_at`. Source `accounts` record (UUID/name) is **never deleted by merging**. A merged source is merely excluded from active listings. Active-source and active-target uniqueness plus application checks prevent nested or concurrent multi-account chains; separate first before merging again.
- A single database transaction and shared advisory lock move source Discord profiles, Minecraft identities and `images.uploaded_by` to the destination while writing original source UUID to each row's `merge_origin`. Source's administrator role is inherited by destination if needed; source's role is removed until restoration. Source sessions expire immediately. Destination name and UUID are retained. Protected initial administrator IDs can only be destinations. No external identity is fabricated.
- Separation reassigns rows with this exact source `merge_origin` to their source UUID, resets ownership markers, restores the two recorded role states and sets `restored_at`; other destination information remains there. Both accounts' sessions are revoked, requiring fresh authentication so a former source identity cannot retain destination privileges. Unexpected ownership changes cause a conflict instead of silent mixed-account transfer.
- Active merges prevent Discord unlinking, role changes, nested merges and deleting transferred Minecraft identities. Accounts with merge history cannot be physically deleted, preserving records. Existing images subsequently **physically deleted** by normal notice editing/deletion or temporary cleanup cannot be resurrected; separation restores only surviving rows. Audit and identity separation are not a backup system. Take DB backups for production data recovery.

All mutation APIs require an authenticated session, an allowed `Origin` and `X-XPlay-CSRF` token from `/api/auth/session`. Administrator endpoints recheck DB roles server-side on every request. Cookies use HttpOnly, SameSite and Secure in production. If OAuth is unconfigured, anonymous writes remain denied.

## Administrator notice APIs

- `GET /api/admin/notices[?status=draft|published|unpublished]`: notices including tags, `created_at`, `updated_at`, `published_at` and status.
- `GET /api/admin/notices/:id`: detail by UUID.
- `POST /api/admin/notices`: draft creation with title, Quill `body_delta`, tags and optional upload-session reference.
- `PATCH /api/admin/notices/:id`: update with `expected_version`; published titles immutable, only drafts may have empty bodies; published articles require at least one tag.
- `POST /api/admin/notices/:id/publish`: `{ "expected_version": 1 }`; requires at least one tag, resets publication/update timestamps together.
- `POST /api/admin/notices/:id/unpublish`: `{ "expected_version": 2 }`.
- `DELETE /api/admin/notices/:id`: `{ "expected_version": 3 }`; drafts/unpublished only, physical deletion.
- `GET /api/admin/tags`: master tags.

Version increments on transitions; stale version returns 409. DB enforces exact unique titles. Article/tag changes and image reconciliation use transactions. Frontend routes: list `/admin/notices`, new `/admin/notices/new`, edit `/admin/notices/:id/edit`. Common editor uses Quill Delta and custom confirmation dialogs for save/publish/unpublish/discard/return/delete. Warn about unsaved edits and temporary uploads. Lists display title, tags, creation/update/publication times and status.

## Images

- `POST /api/admin/images`: upload `{ "upload_session_id":"UUID", "purpose":"notice", "mime_type":"image/png", "data_base64":"..." }`; JPEG/PNG/WebP up to 5 MiB, signature checked against MIME.
- `DELETE /api/admin/images/:id`: remove owned temporary image.
- `DELETE /api/admin/images/sessions/:session`: discard unassociated temporary images.
- `POST /api/admin/images/sessions/:session/refresh`: extend temporary retention.

Upload is possible before the first notice save; Quill inserts returned URLs at cursor. Save associates referenced images and transactionally deletes unrelated temporary or removed images. Public may fetch only images belonging to published articles. Unpublication retains images privately. Temporary images expire after about 24h, cleaned hourly. Physical article deletion removes owned image bytes. `images.uploaded_by` references internal UUID, not Discord ID. When a source was merged, provenance persists on **surviving** image rows for reversal.

## Verification

The `Notice implementation verification` GitHub Actions workflow runs locked dependency installation, PostgreSQL 18 migrations, backend unit/integration tests (including populated legacy migration and protected admins), frontend tests, both builds, backend production Docker container and public/unauthorized API smoke tests. Check status for the exact deployed revision. Real Discord OAuth, browser/mobile E2E, production reverse proxy/cookie behavior, production migration with backup and VPS deployment require separate verification. Never commit credentials.
