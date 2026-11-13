# Resource Directory

A healthcare directory with a public provider survey and an admin portal for reviewing submissions, publishing resources, managing surveys and inviting administrators.

Built with Next.js 16, React, strict TypeScript, Tailwind, shadcn/ui, NextAuth, PostgreSQL 17 and Prisma 7. Zod validates inputs, Nodemailer sends invitations, PostHog tracks public activity, and Recharts displays category usage.

## Local setup

Use Node.js 22.12 or newer within version 22. Run these commands from this folder:

```powershell
npm ci
if (!(Test-Path .env)) { Copy-Item .env.example .env }
```

Fill in the environment file below. Keep existing credentials when updating a working checkout. Start Docker Desktop, then run:

```powershell
docker compose up -d postgres
npm run db:migrate:deploy
npm run db:seed
npm run dev
```

PostgreSQL listens on `127.0.0.1:5433`. The seed creates the first super admin, the default seven-section survey with 29 items, categories and fictional sample resources. Repeating it preserves existing passwords and published edits. Seeding is always explicit.

Open [the directory](http://localhost:3000), [admin sign-in](http://localhost:3000/admin/login), or [the default survey](http://localhost:3000/survey/seed-practice-provider-survey). Sign in with the seed credentials you chose. Never commit `.env` or share passwords publicly.

## Environment variables

Copy the placeholders from `.env.example`. Database, authentication and initial-admin settings are needed for local setup. Other settings enable the integrations described below.

| Group               | Variables                                                                           | Notes                                                                                                              |
| ------------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Local PostgreSQL    | `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `DATABASE_URL`                 | Use the same password in Compose and the URL; URL-encode it. Railway supplies its own database URL.                |
| Authentication      | `AUTH_SECRET`, `NEXTAUTH_URL`                                                       | Use a random secret of at least 32 bytes and the canonical application URL; HTTPS on Railway.                      |
| First administrator | `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`, `SEED_ADMIN_NAME`                        | Choose a password of 12–72 UTF-8 bytes. Used only by explicit seeding.                                             |
| Invitations         | `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`  | Required for invitation emails. Port 465 normally uses implicit TLS; port 587 uses STARTTLS.                       |
| Images              | `S3_ENDPOINT`, `S3_BUCKET`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | Private S3-compatible storage, required only when uploading images. Railway buckets use virtual-hosted addressing. |
| Address lookup      | `GEOCODING_ENDPOINT`, `GEOCODING_USER_AGENT`                                        | Optional private/self-hosted Nominatim-compatible endpoint. Manual coordinates work without it.                    |
| Public analytics    | `NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN`, `NEXT_PUBLIC_POSTHOG_HOST`                     | Public project token and ingestion host. Rebuild after changing public variables.                                  |
| Session reporting   | `POSTHOG_PERSONAL_API_KEY`, `POSTHOG_PROJECT_ID`, `POSTHOG_API_HOST`                | Server-only values. Restrict the personal key to the project with `query:read` access.                             |

Railway supplies `PORT`. GitHub deployment configuration is listed under Deployment; those values do not belong in the browser or a committed environment file.

## Survey, review and resource data

The public form comes from a published database snapshot. It supports validation, Other/N/A answers, a live word counter and required terms acknowledgement. The server validates everything again. Submissions start as `PENDING`; they do not publish a resource.

Under **Survey → Survey Responses**, admins can search, filter, page through and inspect submissions. Approval creates exactly one active resource and records the reviewer, time, note and audit entry in one transaction. Rejection records the decision without creating a resource. Original submission answers remain separate from later resource edits.

The builder supports creating, editing, duplicating, previewing, publishing, unpublishing and deleting surveys. Drafts stay separate from the public form. Every publication creates an immutable version, and answers use stable field keys so changing a label does not change their meaning. Existing responses and resources keep their saved version. Revision checks reject conflicting saves. Deleting published history archives the survey.

The builder's display mappings control the directory projection:

| Survey data / mapping                                                                                                    | Directory display                                                        |
| ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------ |
| Practice name / `TITLE`, provider name / `PROVIDER_NAME`                                                                 | Title and provider name; provider name is the fallback title.            |
| Category / `CATEGORY`                                                                                                    | Category badges and filters.                                             |
| Specialty / `SPECIALTY`, additional information / `DESCRIPTION`                                                          | Card/list description; full answers in Read more.                        |
| Street, city, state and ZIP mappings                                                                                     | Combined address.                                                        |
| Phone / `PHONE`, website / `WEBSITE`                                                                                     | Contact links. N/A websites have no link.                                |
| Start/end day and time, plus `TIME_ZONE`                                                                                 | Office hours and current opening status.                                 |
| Age range / `AGE_RANGE`, waiting time / `AVERAGE_WAIT`                                                                   | Card/list highlights.                                                    |
| Image / `IMAGE`                                                                                                          | Uploaded provider image or the default image.                            |
| Gender, new-patient acceptance/availability, same-day appointments, online scheduling, insurance, languages and services | Full answers under their saved survey headings in Read more.             |
| Terms text, acknowledgement and any additional fields                                                                    | Preserved and displayed with the saved response definition in Read more. |

Admins can search and filter resources, edit their full saved survey data, activate/deactivate listings and delete them after confirmation. Edits use the resource's original survey version and do not rewrite its source submission. Public list, detail and image requests check active status and use no-store responses.

## Directory, coordinates and images

Search, category filters, A–Z/Z–A sorting and pagination run in PostgreSQL, with 10 results per page. Card/list view and filters stay in the URL. Daily ordering uses a PostgreSQL hash of the UTC date and resource ID, with an ID tie-breaker, so it stays stable during a UTC day. Adding or deactivating resources can move page boundaries.

Approval reuses verified coordinates for the same address, uses the configured private geocoder, or asks for manually checked coordinates. Changed addresses need new coordinates. My Location requests browser permission and sends temporary coordinates in headers. PostgreSQL applies Haversine distance in miles before sorting and pagination. Visitor coordinates are not saved or added to URLs. Resources without coordinates sort last. Opening status uses the provider's time zone and supports overnight hours; ambiguous hours show as unavailable.

Images accept one PNG, JPG or WEBP up to 2 MB. The server checks size, MIME type and file signatures. Only private object keys are stored; images are served through endpoints that check admin access or active-resource status. Missing storage uses the default image. Failed saves attempt object cleanup. Resource edits retain old images because the original response may still reference them.

## Administrators and invitations

Super admins manage accounts, roles, status and invitations. Self-deletion and removal of the last active super admin are blocked. Disabled/deleted accounts lose access through current database authorization checks. Passwords use bcrypt, and sign-in is credentials-only with CSRF-protected NextAuth sessions. Credential callbacks allow 20 attempts per minute per proxy-address key.

Invitation emails use Nodemailer and the canonical `NEXTAUTH_URL`. Remote SMTP requires TLS. If `SMTP_FROM` is blank, an email address in `SMTP_USER` is used. Gmail app passwords may include their displayed spaces. A failed send removes the unused invitation so it can be retried.

Links expire after 24 hours and can be used once. Only token hashes are stored. Acceptance creates the account, consumes the invitation and notifies existing active admins in one transaction. The bell shows unread notifications; each admin can read and mark only their own notifications. Optional new-admin announcement emails are not implemented.

## Analytics

The dashboard shows current resource, pending-response and administrator totals. Category usage and PostHog sessions use the selected UTC year, month, day or date range. Ranges include both dates and can cover up to 366 days. Current resource/admin totals include active and inactive records.

Category-filter changes are stored in the existing PostgreSQL `AnalyticsEvent` table as `CATEGORY_SELECTION`, linked to a verified category. UUIDs deduplicate retries. Refreshing, searching, sorting and paging do not add selections. Recharts includes zero-use categories and identifies most/least usage. PostgreSQL keeps the chart available independently of PostHog.

PostHog records anonymous public page views, sessions and `category_selected`. US ingestion uses `https://us.i.posthog.com`; EU uses `https://eu.i.posthog.com`. The private API host is `https://us.posthog.com` or `https://eu.posthog.com`. The server queries distinct SDK session IDs with public activity in the selected period and caches results for one minute. After that cache expires, it requests a fresh calculation instead of PostHog's older cached result. Missing credentials or provider errors show **Unavailable**.

Admin/invitation routes, query strings, referrers, answers, contact details and precise coordinates are excluded from analytics. Replay, autocapture and optional tracking features are disabled. Do Not Track, Global Privacy Control and SDK opt-out are respected. Also enable PostHog's Discard IP data setting.

## PWA

The manifest, 192px/512px icons, maskable icon and Apple touch icon support browser installation. Use the browser's Install option on supported desktop/Android browsers, or Safari's **Share → Add to Home Screen** on iOS. No app-store build or custom install button is needed.

The worker registers in a production build over HTTPS or secure localhost. Test it locally with `npm run build` followed by `npm start`; development mode does not register it. After the first successful visit, failed public navigation shows `/offline`. Try again performs a normal GET navigation back to the directory.

Only the offline page, its referenced build assets and app icons are precached. Admin pages, invitations, APIs, resource results, uploads and submissions stay on the network. Nothing is queued for later submission. Cache names are versioned; bump the version in `public/sw.js` when changing the offline shell. Activation removes only old application caches and does not force a reload.

## Checks and limitations

`npm run mail:verify` checks SMTP connection, TLS and authentication without sending email. Database integration tests create, migrate and remove a disposable local database; the local user needs `CREATEDB` permission. They refuse remote database targets. `auth:verify` checks existing seed credentials without changing them.

```powershell
npm test
npm run test:db
npm run db:validate
npm run auth:verify
npm run mail:verify
npm run lint
npm run typecheck
npm run format:check
npm run build
```

Public pages, forms, resource details, admin pages and dialogs were checked at **300, 360, 768, 1024, 1440, 1920 and 3000px**, plus landscape and 200% zoom reflow emulation. Local production Chrome checks cover manifest diagnostics, offline recovery and cache exclusions. Physical Android/iOS installation still needs a device check. Current Lighthouse versions no longer include the old PWA audit category.

Public submission, approval/rejection, resource editing/visibility, survey versioning, invitations, notifications and category reporting were exercised locally with fictional data in a disposable database. SMTP connection/TLS/authentication passed; invitation delivery was captured locally, not sent through a real mail provider. Real S3 upload/read remains unverified. Live PostHog browser ingestion and the private session-count query passed. Public SDK payload privacy was also checked against local capture.

Request limits are bounded and process-local; they reset on restart and are not shared between Railway instances. Automatic geocoding requires the optional private endpoint; manual coordinates remain available. No push notifications, background sync, offline submission, native app tooling or drag-and-drop builder were added.

Files/folders use kebab-case, identifiers use camelCase, and JSX components use PascalCase. TypeScript is strict, explicit `any` and `ts-ignore` are forbidden, and commits/PR titles use Conventional Commits. Server services own validation, authorization and database writes; client components handle interactive forms and charts. Directory and reporting queries use database counts, grouping and pagination rather than loading entire tables.

## Deployment and handover

The existing GitHub Actions workflow checks PRs and pushes to `main`, `dev` and `test`. It runs lint, schema validation, unit/database tests, type checking, build, formatting and Conventional Commit checks. Only successful pushes to `dev`/`test` proceed to Railway deployment.

GitHub environments `development` and `test` need their own `RAILWAY_PROJECT_ID`, `RAILWAY_SERVICE_ID`, `RAILWAY_ENVIRONMENT_ID` and `RAILWAY_PUBLIC_URL` variables. Store the corresponding project tokens as `RAILWAY_TOKEN_DEV` and `RAILWAY_TOKEN_TEST` secrets. Each Railway environment needs an independent PostgreSQL database, authentication settings and integration credentials. Confirm Railway's own GitHub auto-deploy is disabled when this workflow owns deployment.

`railway.json` builds the app, runs `npm run db:migrate:deploy` before starting, and checks `/`. That command runs `prisma migrate deploy`; a migration failure must stop deployment. Seeding is not automatic. Prisma Client is generated during installation, type checking and builds.

Development: [Railway app](https://web-development-3187fa5c.up.railway.app). Test: [Railway app](https://web-test-test-7ff28964.up.railway.app). These deployments still contain the older Phase 2 code, as last reported. The current local changes have not been deployed or verified there. After deployment, check both HTTPS apps, separate databases, migrations, login, survey, directory, manifest, service worker and configured integrations. Share reviewer credentials privately.

For the 5–10 minute walkthrough, prepare a fictional **Oak Lane Community Practice**, a provider name, a safe example address/phone and an invitation inbox you control. Keep credentials and invite tokens off-screen:

1. **0:00–1:00:** Show the directory, search, category filter, card/list view and Read more.
2. **1:00–2:30:** Submit the provider survey and show the pending confirmation.
3. **2:30–4:00:** Sign in, review and approve it, then find the new resource publicly.
4. **4:00–5:00:** Edit/deactivate the resource, show its disappearance, and reactivate it.
5. **5:00–6:00:** Show a draft question, preview and published version history.
6. **6:00–7:30:** Send/accept an invitation, sign in and show the existing admin's unread notification.
7. **7:30–9:00:** Show category analytics/date filters, browser installation and the offline fallback.

The recording, final deployment verification and private reviewer credentials are still manual submission steps.

## Project structure

This tree lists the application files. Dependencies, generated Prisma/Next.js output, local environment files and ignored review notes are omitted.

```text
resource-directory/
├── .github/ # GitHub automation
│   └── workflows/ # Quality checks and Railway deployment
│       └── ci-cd.yaml
├── prisma/ # Database schema, migrations and seed data
│   ├── migrations/ # Versioned database changes
│   │   ├── 20261112000100_initial/ # Migration SQL
│   │   │   └── migration.sql # Database migration
│   │   ├── 20261112000200_integrity_guards/ # Migration SQL
│   │   │   └── migration.sql # Database migration
│   │   └── migration_lock.toml
│   ├── seed-data/ # Default survey and fictional providers
│   │   ├── default-survey.ts
│   │   └── sample-resources.ts
│   ├── schema.prisma # Models, relationships, indexes and enums
│   ├── seed-database.ts # Repeatable initial-data creation
│   └── seed.ts # Explicit seed entry point
├── public/ # Public static files
│   ├── icons/ # PWA icons and editable SVG source
│   │   ├── apple-touch-icon.png # Static image asset
│   │   ├── icon-192.png # Static image asset
│   │   ├── icon-512.png # Static image asset
│   │   ├── icon-maskable-512.png # Static image asset
│   │   └── icon.svg # Static image asset
│   ├── file.svg # Static image asset
│   ├── globe.svg # Static image asset
│   ├── next.svg # Static image asset
│   ├── provider-default.svg # Default provider image
│   ├── sw.js # Versioned offline shell cache and network-first public navigation
│   ├── vercel.svg # Static image asset
│   └── window.svg # Static image asset
├── scripts/ # Database, sign-in and SMTP verification
│   ├── run-database-tests.ts
│   ├── verify-admin-login.ts
│   ├── verify-database.ts
│   ├── verify-invitation-smtp.ts
│   └── verify-seed-data.ts
├── src/ # Application source
│   ├── app/ # Next.js pages, layouts and HTTP endpoints
│   │   ├── admin/ # Administrator portal
│   │   │   ├── (protected)/ # Pages that require an active administrator
│   │   │   │   ├── admins/ # admins routes
│   │   │   │   │   ├── error.tsx # Recoverable error boundary
│   │   │   │   │   ├── loading.tsx # Loading feedback
│   │   │   │   │   └── page.tsx # Page UI
│   │   │   │   ├── resources/ # resources routes
│   │   │   │   │   ├── [id]/ # Dynamic URL parameter
│   │   │   │   │   │   └── edit/ # edit routes
│   │   │   │   │   │       └── page.tsx # Page UI
│   │   │   │   │   ├── error.tsx # Recoverable error boundary
│   │   │   │   │   ├── loading.tsx # Loading feedback
│   │   │   │   │   └── page.tsx # Page UI
│   │   │   │   ├── responses/ # responses routes
│   │   │   │   │   ├── [id]/ # Dynamic URL parameter
│   │   │   │   │   │   ├── not-found.tsx # Missing-record page
│   │   │   │   │   │   └── page.tsx # Page UI
│   │   │   │   │   ├── error.tsx # Recoverable error boundary
│   │   │   │   │   ├── loading.tsx # Loading feedback
│   │   │   │   │   └── page.tsx # Page UI
│   │   │   │   ├── surveys/ # surveys routes
│   │   │   │   │   ├── [id]/ # Dynamic URL parameter
│   │   │   │   │   │   ├── edit/ # edit routes
│   │   │   │   │   │   │   └── page.tsx # Page UI
│   │   │   │   │   │   └── preview/ # preview routes
│   │   │   │   │   │       └── page.tsx # Page UI
│   │   │   │   │   ├── error.tsx # Recoverable error boundary
│   │   │   │   │   └── page.tsx # Page UI
│   │   │   │   ├── error.tsx # Recoverable error boundary
│   │   │   │   ├── layout.tsx # Shared page layout
│   │   │   │   ├── loading.tsx # Loading feedback
│   │   │   │   └── page.tsx # Page UI
│   │   │   ├── login/ # login routes
│   │   │   │   └── page.tsx # Page UI
│   │   │   └── layout.tsx # Shared page layout
│   │   ├── api/ # Server endpoints
│   │   │   ├── admin/ # Protected administrative endpoints
│   │   │   │   ├── admins/ # admins routes
│   │   │   │   │   └── [id]/ # Dynamic URL parameter
│   │   │   │   │       └── route.ts # HTTP handlers
│   │   │   │   ├── analytics/ # analytics routes
│   │   │   │   │   └── route.ts # HTTP handlers
│   │   │   │   ├── invitations/ # invitations routes
│   │   │   │   │   ├── [id]/ # Dynamic URL parameter
│   │   │   │   │   │   └── route.ts # HTTP handlers
│   │   │   │   │   └── route.ts # HTTP handlers
│   │   │   │   ├── me/ # me routes
│   │   │   │   │   └── route.ts # HTTP handlers
│   │   │   │   ├── notifications/ # notifications routes
│   │   │   │   │   ├── [id]/ # Dynamic URL parameter
│   │   │   │   │   │   └── route.ts # HTTP handlers
│   │   │   │   │   └── route.ts # HTTP handlers
│   │   │   │   ├── resources/ # resources routes
│   │   │   │   │   └── [id]/ # Dynamic URL parameter
│   │   │   │   │       ├── image/ # image routes
│   │   │   │   │       │   └── route.ts # HTTP handlers
│   │   │   │   │       └── route.ts # HTTP handlers
│   │   │   │   ├── responses/ # responses routes
│   │   │   │   │   └── [id]/ # Dynamic URL parameter
│   │   │   │   │       ├── approve/ # approve routes
│   │   │   │   │       │   └── route.ts # HTTP handlers
│   │   │   │   │       ├── image/ # image routes
│   │   │   │   │       │   └── route.ts # HTTP handlers
│   │   │   │   │       └── reject/ # reject routes
│   │   │   │   │           └── route.ts # HTTP handlers
│   │   │   │   └── surveys/ # surveys routes
│   │   │   │       ├── [id]/ # Dynamic URL parameter
│   │   │   │       │   ├── duplicate/ # duplicate routes
│   │   │   │       │   │   └── route.ts # HTTP handlers
│   │   │   │       │   ├── publish/ # publish routes
│   │   │   │       │   │   └── route.ts # HTTP handlers
│   │   │   │       │   ├── unpublish/ # unpublish routes
│   │   │   │       │   │   └── route.ts # HTTP handlers
│   │   │   │       │   └── route.ts # HTTP handlers
│   │   │   │       └── route.ts # HTTP handlers
│   │   │   ├── analytics/ # Public category-event ingestion
│   │   │   │   └── category/ # category routes
│   │   │   │       └── route.ts # HTTP handlers
│   │   │   ├── auth/ # NextAuth endpoints
│   │   │   │   └── [...nextauth]/ # Dynamic URL parameter
│   │   │   │       └── route.ts # HTTP handlers
│   │   │   ├── invitations/ # Invitation acceptance
│   │   │   │   └── [token]/ # Dynamic URL parameter
│   │   │   │       └── route.ts # HTTP handlers
│   │   │   ├── resources/ # Active public resources
│   │   │   │   ├── [id]/ # Dynamic URL parameter
│   │   │   │   │   ├── image/ # image routes
│   │   │   │   │   │   └── route.ts # HTTP handlers
│   │   │   │   │   └── route.ts # HTTP handlers
│   │   │   │   └── route.ts # HTTP handlers
│   │   │   └── surveys/ # Public survey submissions
│   │   │       └── [id]/ # Dynamic URL parameter
│   │   │           └── responses/ # responses routes
│   │   │               └── route.ts # HTTP handlers
│   │   ├── invite/ # Public invitation pages
│   │   │   └── [token]/ # Dynamic URL parameter
│   │   │       └── page.tsx # Page UI
│   │   ├── offline/ # Offline fallback page
│   │   │   └── page.tsx # Page UI
│   │   ├── survey/ # Published public surveys
│   │   │   └── [id]/ # Dynamic URL parameter
│   │   │       ├── not-found.tsx # Missing-record page
│   │   │       └── page.tsx # Page UI
│   │   ├── error.tsx # Recoverable error boundary
│   │   ├── favicon.ico # Resource Directory browser icon
│   │   ├── globals.css # Tailwind setup and theme
│   │   ├── layout.tsx # Shared metadata, fonts, analytics and worker registration
│   │   ├── manifest.ts # Installable web app manifest
│   │   └── page.tsx # Public directory homepage
│   ├── components/ # Shared UI
│   │   ├── admin/ # Portal navigation and sign-in
│   │   │   ├── admin-brand.tsx
│   │   │   ├── admin-shell.tsx
│   │   │   ├── login-form.tsx
│   │   │   ├── logout-button.tsx
│   │   │   └── section-placeholder.tsx
│   │   ├── shared/ # Service-worker registration
│   │   │   └── service-worker-registration.tsx
│   │   └── ui/ # shadcn/ui primitives
│   │       └── button.tsx
│   ├── lib/ # Database, image-storage and shared helpers
│   │   ├── database-client.ts
│   │   ├── db.ts
│   │   ├── image-storage.ts
│   │   └── utils.ts
│   ├── modules/ # Feature services and components
│   │   ├── analytics/ # Public tracking and dashboard reporting
│   │   │   ├── components/ # Feature UI components
│   │   │   │   ├── analytics-dashboard.tsx
│   │   │   │   ├── analytics-filters.tsx
│   │   │   │   ├── category-usage-chart.tsx
│   │   │   │   └── public-analytics.tsx
│   │   │   ├── analytics-data.ts
│   │   │   ├── analytics-period.ts
│   │   │   ├── category-events.ts
│   │   │   ├── posthog-config.ts
│   │   │   ├── posthog-sessions.ts
│   │   │   └── public-tracking.ts
│   │   ├── auth/ # Credentials, sessions, roles and request limits
│   │   │   ├── admin-api.ts
│   │   │   ├── auth-types.ts
│   │   │   ├── authorization.ts
│   │   │   ├── credentials.ts
│   │   │   ├── login-limiter.ts
│   │   │   ├── page-access.ts
│   │   │   └── session-data.ts
│   │   ├── management/ # Administrators, invitations and notifications
│   │   │   ├── components/ # Feature UI components
│   │   │   │   ├── accept-invitation-form.tsx
│   │   │   │   ├── admin-manager.tsx
│   │   │   │   └── notification-center.tsx
│   │   │   ├── admin-management.ts
│   │   │   ├── client-request.ts
│   │   │   ├── invitation-mail.ts
│   │   │   ├── invitation-service.ts
│   │   │   ├── management-api.ts
│   │   │   ├── management-lock.ts
│   │   │   ├── management-types.ts
│   │   │   └── notifications.ts
│   │   ├── resources/ # Public directory and resource editing
│   │   │   ├── components/ # Feature UI components
│   │   │   │   ├── directory-client.tsx
│   │   │   │   ├── resource-card.tsx
│   │   │   │   ├── resource-details-dialog.tsx
│   │   │   │   ├── resource-editor.tsx
│   │   │   │   ├── resource-image.tsx
│   │   │   │   └── resource-manager.tsx
│   │   │   ├── directory-api.ts
│   │   │   ├── directory-query.ts
│   │   │   ├── directory-types.ts
│   │   │   ├── office-hours.ts
│   │   │   ├── project-resource.ts
│   │   │   ├── resource-details.ts
│   │   │   └── resource-management.ts
│   │   ├── responses/ # Submission review and approval
│   │   │   ├── components/ # Feature UI components
│   │   │   │   ├── response-answers.tsx
│   │   │   │   ├── response-image.tsx
│   │   │   │   ├── response-list.tsx
│   │   │   │   ├── response-status.tsx
│   │   │   │   └── review-actions.tsx
│   │   │   ├── approval-projection.ts
│   │   │   ├── resolve-coordinates.ts
│   │   │   ├── response-data.ts
│   │   │   ├── review-api.ts
│   │   │   ├── review-mutations.ts
│   │   │   └── review-types.ts
│   │   └── surveys/ # Survey definitions, validation, publishing and forms
│   │       ├── components/ # Feature UI components
│   │       │   ├── builder-client-api.ts
│   │       │   ├── builder-confirm.tsx
│   │       │   ├── public-survey-form.tsx
│   │       │   ├── question-editor.tsx
│   │       │   ├── survey-editor.tsx
│   │       │   ├── survey-field.tsx
│   │       │   ├── survey-image-input.tsx
│   │       │   ├── survey-introduction.tsx
│   │       │   ├── survey-manager.tsx
│   │       │   ├── survey-preview.tsx
│   │       │   └── survey-renderer.tsx
│   │       ├── answer-display.ts
│   │       ├── answer-validation.ts
│   │       ├── builder-api.ts
│   │       ├── builder-draft.ts
│   │       ├── builder-schema.ts
│   │       ├── builder-service.ts
│   │       ├── image-rules.ts
│   │       ├── published-survey.ts
│   │       ├── snapshot-from-draft.ts
│   │       ├── submission-limiter.ts
│   │       ├── submission-request.ts
│   │       ├── submit-survey.ts
│   │       ├── survey-definition.ts
│   │       ├── survey-error.ts
│   │       ├── survey-snapshot.ts
│   │       └── validate-image.ts
│   ├── types/ # Shared TypeScript declarations
│   │   └── next-auth.d.ts
│   ├── auth.ts # NextAuth credentials and session configuration
│   └── instrumentation-client.ts # Guarded public PostHog initialization
├── tests/ # Unit tests and disposable-database integration tests
│   ├── fixtures/ # Fictional image fixtures
│   │   └── survey-images.ts
│   ├── analytics.integration.test.ts
│   ├── analytics.test.ts
│   ├── auth-authorization.test.ts
│   ├── auth-config.test.ts
│   ├── auth-credentials.test.ts
│   ├── auth-database.integration.test.ts
│   ├── auth-login-limiter.test.ts
│   ├── auth-session.test.ts
│   ├── database.integration.test.ts
│   ├── directory-hours.test.ts
│   ├── directory.integration.test.ts
│   ├── invitation-mail.test.ts
│   ├── management.integration.test.ts
│   ├── response-review.integration.test.ts
│   ├── survey-builder.integration.test.ts
│   ├── survey-data.test.ts
│   ├── survey-images.test.ts
│   ├── survey-request.test.ts
│   ├── survey-storage.test.ts
│   ├── survey-submission.integration.test.ts
│   ├── survey-submission.test.ts
│   └── survey-validation.test.ts
├── .env.example # Environment variable placeholders
├── .gitattributes # Consistent line endings
├── .gitignore # Local and generated files to exclude
├── .nvmrc # Required Node.js major version
├── .prettierignore # Formatting exclusions
├── .prettierrc.json # Formatting rules
├── .railwayignore # Files excluded from Railway uploads
├── AGENTS.md # Installed Next.js development guidance
├── commitlint.config.mjs # Conventional Commit rules
├── components.json # shadcn/ui configuration
├── compose.yaml # Local PostgreSQL service
├── eslint.config.mjs # Lint, naming and forbidden-any rules
├── next.config.ts # Next.js settings and security headers
├── package-lock.json # Locked dependency versions
├── package.json # Dependencies and project commands
├── prisma.config.ts # Prisma paths and explicit seed command
├── railway.json # Build, migration, startup and health check commands
├── README.md # Setup, architecture and handover
├── tsconfig.json # Strict TypeScript configuration
├── vitest.config.mts # Unit-test configuration
└── vitest.database.config.mts # Database-test configuration
```
