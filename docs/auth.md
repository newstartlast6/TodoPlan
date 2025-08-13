### Auth plan: Supabase Auth + Drizzle + Express

This plan adds Google OAuth, Email/Password, and Password Reset using Supabase Auth, integrates the Supabase session with the existing Express API, and scopes all app data per user via schema changes and access control.

## Outcomes
- **Providers**: Google OAuth, Email/Password, Password Reset
- **Security**: All `/api` routes require a valid Supabase JWT; data is scoped by `user_id`
- **Schema**: Add `user_id` columns referencing `auth.users(id)`; introduce `profiles` table; add indexes and RLS (optional but recommended)
- **UX**: Login page + session persistence; logout; reset password flow; error messaging

## Non-goals
- Multi-tenant orgs/teams
- External IdP beyond Google (e.g., Apple/GitHub) — can be added later

## Architecture overview
- Client uses `@supabase/supabase-js` for authentication only.
- Client calls existing Express API with `Authorization: Bearer <supabase_access_token>`.
- Server verifies Supabase JWT, extracts `userId` and scopes all reads/writes per-user through Drizzle.
- Database stores app data in `public` schema with a `user_id` foreign key to `auth.users(id)`.
- Optional: enable Postgres RLS policies for defense-in-depth if any direct client DB access is added later.

## Tasks and subtasks

### 1) Supabase project setup
- **Create project** in Supabase (or use existing).
- **Configure site URL and redirect URLs** for development and production:
  - Web: `http(s)://localhost:5002` (adjust to your dev port) and production URL
  - Electron (optional): custom scheme `todoplan://auth-callback`
- **Enable providers**: Google
  - Configure Google OAuth consent screen; add authorized redirect URLs from Supabase provider page
- **Auth settings**:
  - Decide on email confirmation requirement for Email/Password
  - Set access token lifetime and refresh token lifetime
  - Customize email templates and sender domain (optional)
- **Keys and secrets**:
  - Get `SUPABASE_URL`, `SUPABASE_ANON_KEY` (client)
  - Get `SERVICE_ROLE_KEY` (server only, do not expose to client)
  - Locate `JWT_SECRET` and JWKS URL (for server token verification)

### 2) Environment and configuration
- **Server (.env)**: `AUTH_ENABLED`, `SUPABASE_URL`, `SUPABASE_JWT_SECRET` (or JWKS), `SUPABASE_SERVICE_ROLE_KEY`, `PORT`, `DATABASE_URL`
- **Client (.env)**: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- **Electron**: if using deep links, register custom scheme and redirect to app route handling `auth-callback`
- **Do not commit secrets**; update README with env setup steps

### 3) Database and Drizzle schema changes
- **Replace `users` with `profiles` table** (app-managed):
  - Columns: `user_id uuid primary key references auth.users(id)`, `display_name text`, `avatar_url text`, `created_at timestamp default now()`, `updated_at timestamp default now()`
  - Purpose: store app-specific profile fields; identity lives in `auth.users`
  - Migration: copy/merge from legacy `users` if needed, then deprecate old `users` table
- **Add `user_id not null` to per-user tables**:
  - `lists`, `tasks`, `goals`, `reviews`, `notes`, `timer_sessions`, `task_estimates`
  - Implemented in migration `0016_add_user_scoping.sql` with indexes and common composites
  - Backfill strategy: defaults to `DEV_USER_ID` placeholder; replace with a real Supabase user in staging/prod
- **Indexes and constraints**:
  - Index on `user_id` for each table; composites on hot paths done in `0016_add_user_scoping.sql`
  - Keep current PKs as-is; `user_id` scopes all data
- **Foreign key considerations**:
  - If a child table references a parent (e.g., `tasks.list_id`), ensure both belong to the same `user_id`; enforce in application layer and tests
  - Optional defensive constraint: create partial unique indexes or triggers to prevent cross-user references

### 4) Row Level Security (optional but recommended)
- Enable RLS on all per-user tables
- Policies:
  - Select/Insert/Update/Delete: allowed when `user_id = auth.uid()`
  - For tables that only reference a parent (e.g., `task_estimates` references `tasks`), you can either store `user_id` redundantly and apply the policy, or use join-based policies — prefer redundant `user_id` for simple, index-friendly RLS
- If the server uses `SERVICE_ROLE_KEY`, it bypasses RLS. Keep RLS primarily for defense-in-depth and any future direct client access.

### 5) Backend (Express) integration
- **Install JWT verification** (e.g., `jose`): verify `Authorization: Bearer <token>` issued by Supabase
- **Auth middleware**:
  - Verify token (via `SUPABASE_JWT_SECRET` or JWKS)
  - Extract `userId` (JWT `sub` claim) and attach to `req.user`
  - Reject with 401 if missing/invalid/expired
- **Route protection**:
  - Require auth for all `/api` routes that handle user data
  - Define a `/api/me` endpoint that returns basic profile/session info
- **Storage layer changes**:
  - Updated: `server/storage.ts` now scopes all methods by `userId`
  - Inserts set `user_id = userId`; reads/updates/deletes filter by `user_id`
  - Cross-resource ownership validated by scoping queries
- **Error handling**:
  - Standardize 401/403 responses and error codes
  - Log token verification failures with minimal PII

### 6) Frontend integration
- **Client setup**:
  - Add `@supabase/supabase-js` and create a singleton Supabase client using `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
  - Add an AuthProvider to hold session state and expose `signInWithGoogle`, `signInWithPassword`, `signUpWithPassword`, `signOut`
  - Handle `onAuthStateChange` to react to token refresh and sign-out
- **Login flows**:
  - Google OAuth: popup/redirect flow; handle errors (popup blocked, denied consent)
  - Email/Password: sign up (with optional email confirmation), sign in, error states (invalid creds, rate limiting)
  - Password reset: request reset email; handle redirect route to set a new password using the provided access token
- **API calls**:
  - Implemented token injection and 401 retry in `client/src/lib/queryClient.ts`
- **Routing/UX**:
  - Add a `/login` page; gate app routes (`/lists`, `/calendar`, etc.) behind auth
  - Show loading and error states; surface email verification pending if required
  - Provide a visible Sign out option

### 7) Data migration
- Write migrations to:
  - Add `user_id` to all per-user tables (not null), plus indexes (done in `0016_add_user_scoping.sql`)
  - Backfill existing rows to a known dev user via column defaults, then remove defaults later
  - Drop legacy `users` table after confirming no references (or keep temporarily and mark deprecated)
- Update seed scripts to create data under a test `user_id`
- Validate migrations on a staging database before production

### 8) Edge cases to handle
- **Token issues**: expired/revoked tokens, clock skew; return 401 and prompt re-login
- **Unverified email** (if required): restrict access until verified; provide resend link
- **Provider linking**: user signs up with email, later uses Google with same email; plan for account linking in Supabase settings
- **Concurrent sessions**: multiple devices updating the same task; last-write-wins vs conflict resolution (timer flows in particular)
- **Unauthorized access attempts**: ensure all queries are scoped by `user_id`; do not leak resource existence across users
- **Password reset**: invalid or reused reset links; show clear messages
- **Rate limiting**: throttle login attempts and password reset requests
- **Account deletion**: decide if supported; cascade delete user data or soft-delete profile
- **Offline mode**: if client queues changes offline, ensure they sync only under the correct `user_id`; discard on logout

### 9) QA and testing
- **Unit tests**: token verification middleware, storage scoping by `user_id`
- **Integration tests**: API endpoints with mocked/validated JWTs; verify 401/403 paths
- **E2E tests**: sign in/out, Google flow (if feasible with a test IdP), email/password, password reset
- **Security checks**: confirm no cross-user access; verify RLS (if enabled) with SQL tests

### 10) Monitoring and observability
- Log auth failures and 401/403 counts (no sensitive token payloads)
- Track login success/failure metrics and password reset requests
- Alerting for abnormal error rates

### 11) Rollout plan
- Behind a feature flag (`AUTH_ENABLED`), initially enabling auth on a staging environment
- Migrate data with backfill user; verify per-user isolation
- Roll out to production; provide a temporary migration banner for existing users

## Deliverables checklist (what to build)
- [ ] Supabase project configured with Google + Email/Password + Reset Password
- [ ] Env files for server and client with Supabase config
- [ ] Database migrations: `profiles` table
- [x] Database migrations: `user_id` added to per-user tables; indexes created
- [ ] Database migrations: Optional RLS enabled and policies written
- [x] Express middleware verifying Supabase JWT and attaching `userId`
- [x] All `/api` routes protected and scoped by `userId`
- [x] Frontend auth provider
- [x] Frontend login page (Google + Email/Password)
- [ ] Frontend password reset page
- [x] Token injection on API calls (with one retry on 401)
- [ ] Tests: unit, integration, and basic E2E

## Notes on type/column choices
- Keep existing table PKs as-is; add `user_id uuid` referencing `auth.users(id)`
- Prefer redundant `user_id` on child tables (e.g., `timer_sessions`, `task_estimates`) for simple, efficient filtering and RLS
- Add composite indexes aligned with main queries to avoid regressions after scoping by `user_id`


