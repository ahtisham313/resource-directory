# Resource Directory

Resource Directory is a healthcare provider directory built with Next.js 16 and PostgreSQL. Providers submit their information through a public survey. An administrator reviews each submission before it becomes a searchable listing, and can later update or deactivate that listing without changing the original submission.

The same application includes a survey builder, administrator invitations, an analytics dashboard, and Progressive Web App (PWA) support. The public directory does not require an account; administrative work is restricted to signed-in administrators.

### Live Deployments

The application is deployed on Railway with separate development
and test environments, each using its own PostgreSQL database.

| Environment | Branch | Application URL |
|-------------|--------|-----------------|
| Development | `dev` | [Development App](https://web-development-3187fa5c.up.railway.app) |
| Test / Staging | `test` | [Test App](https://web-test-test-7ff28964.up.railway.app) |

GitHub Actions handles deployment to the corresponding Railway
environment after the required checks pass. Prisma migrations
are applied during deployment using `prisma migrate deploy`.

## Technology Stack

| Area | Implementation |
| --- | --- |
| Application | Next.js 16 App Router, React, TypeScript (strict mode) |
| Interface | Tailwind CSS and shadcn/ui |
| Database | PostgreSQL 17, Prisma ORM 7 and Prisma migrations |
| Authentication | Auth.js / NextAuth credentials, bcrypt password hashes |
| Input validation | Zod and server-side validation |
| Email invitations | Nodemailer with SMTP |
| Analytics | PostHog, PostgreSQL category events, Recharts |
| Deployment | Railway and GitHub Actions |
| Local database | Docker Compose |

The project is a single Next.js application, with its features organized into modules. Pages and API routes handle requests; the modules hold validation, queries, and business rules. Zod is used for shared input validation, and Recharts is used for the analytics chart.

## Getting Started

### Prerequisites

- Node.js 22.12 or later in the 22.x series and npm
- Docker Desktop
- Git

The commands below are written for PowerShell on Windows and should be run from the repository root.

### 1. Install and configure

```powershell
npm ci
Copy-Item .env.example .env
```

Edit `.env` and set the local PostgreSQL password, `DATABASE_URL`, `AUTH_SECRET`, and the initial administrator credentials.

For the database URL, use the same password as `POSTGRES_PASSWORD`. URL-encode special characters if needed.

The sample environment file lists the variables used by the application. Keep `.env` out of Git.

### 2. Start PostgreSQL and prepare the database

```powershell
docker compose up -d postgres
npm run db:migrate:deploy
npm run db:seed
```

The Docker database is exposed on `127.0.0.1:5433`.

The migration command applies the checked-in Prisma migrations. The seed command creates:

- The initial super administrator.
- The default survey from Appendix A, containing seven sections and 29 items.
- Healthcare categories.
- Fictional sample resources.

Seeding is explicit and repeatable. It is not part of the normal application startup or Railway deployment, and it should not overwrite existing administrator passwords or published survey edits.

### 3. Run the application

```powershell
npm run dev
```

| Page | Local address |
| --- | --- |
| Public directory | http://localhost:3000 |
| Admin sign-in | http://localhost:3000/admin/login |
| Default survey | http://localhost:3000/survey/seed-practice-provider-survey |

Sign in with the email and password set in the `SEED_ADMIN_*` variables. The admin account is created by the seed script, not by a public registration page.

## Environment Variables

Copy `.env.example` rather than creating variable names from scratch. Values for SMTP, geocoding, image storage, and PostHog depend on the services you choose to configure.

| Group | Variables | Purpose |
| --- | --- | --- |
| Database | `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `DATABASE_URL` | Local Compose database and Prisma connection. Railway uses a separate `DATABASE_URL` for each environment. |
| Authentication | `AUTH_SECRET`, `NEXTAUTH_URL` | Session secret and application base URL. Use HTTPS for deployed URLs. |
| Initial admin | `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`, `SEED_ADMIN_NAME` | Seed the first super administrator. Not needed for ordinary sign-in after seeding. |
| Email | `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM` | Nodemailer connection and sender settings for admin invitations. |
| Geocoding | `GEOCODING_ENDPOINT`, `GEOCODING_USER_AGENT` | Optional private Nominatim-compatible lookup; manual coordinates are supported. |
| Image storage | `S3_ENDPOINT`, `S3_BUCKET`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | Optional S3-compatible storage configuration. No bucket has been provisioned for this project. |
| Public PostHog | `NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN`, `NEXT_PUBLIC_POSTHOG_HOST` | Public browser tracking configuration. |
| PostHog reporting | `POSTHOG_PERSONAL_API_KEY`, `POSTHOG_PROJECT_ID`, `POSTHOG_API_HOST` | Private server-side access to session reporting. |

Only variables prefixed with `NEXT_PUBLIC_` are intended for the browser. Do not put database credentials, SMTP passwords, or private PostHog keys in client-side variables.

## Application Features

### Public Resource Directory

The homepage shows active healthcare resources as cards or a compact list. Each result includes the provider's main details, contact information, hours, and a **Read more** view containing the approved survey answers.

The detailed view uses the survey version associated with the resource, so fields added through the builder can appear without hardcoding them into the page.

Visitors can:

- Search by name, category, or address.
- Filter by healthcare category.
- Switch between card and list views.
- Sort results alphabetically (A–Z or Z–A).
- Browse resources in a default daily randomized order.
- Navigate results using server-side pagination, with 10 resources per page.
- Request browser location permission to see distances.
- Sort resources by nearest or farthest distance.

Search, filtering, sorting, and pagination are handled on the server.

Opening status is calculated from the provider's saved office hours and time zone. Inactive resources are excluded from public lists, detail responses, and image access.

### Public Survey and Submission Review

The public survey is available at `/survey/[id]` and is generated from a published definition stored in PostgreSQL.

Question labels, field types, options, required settings, and validation rules are not hardcoded into the page.

Supported fields include:

- Short and long text.
- Email, phone, and website.
- Numeric inputs.
- Dropdowns, radio buttons, and multiple selections.
- Day and time inputs.
- Image selection.
- Terms acknowledgement.
- Conditional **Other** and **N/A** options.

The browser provides immediate validation feedback, while the server validates answers again before storing them.

A honeypot and request limits provide basic spam protection.

New submissions are stored with `PENDING` status and are not published automatically.

The admin's Survey Responses section provides:

- Search and status filtering.
- Server-side pagination.
- Full response details.
- Approval or rejection with an optional note.
- Reviewer and review timestamp tracking.

Approval creates an active resource and its category relationships. Rejection records the decision without publishing a resource.

**Image upload status:** The application validates PNG, JPG, and WEBP files against a 2 MB limit and includes an optional storage adapter. However, S3 storage has not been configured or deployed. Persistent provider image uploads are therefore not available in the current setup. Listings without an uploaded image use the default provider image.

### Dynamic Survey Builder

Administrators can create, edit, duplicate, preview, publish, unpublish, and archive surveys.

The editor supports:

- Survey title and introduction.
- Editable deadline and contact information.
- Editable terms and closing message.
- Sections and questions.
- Adding, removing, and reordering questions.
- Required and optional settings.
- Selectable options and validation rules.
- Conditional Other/N/A behavior.
- Mapping survey fields to resource information.
- Previewing a survey before publication.

Drafts are separate from published survey definitions.

Publishing a draft creates an immutable `SurveyVersion`. Every submission keeps a reference to the version it used, allowing older answers to remain readable after survey changes.

### Resource Management

Administrators can search and filter approved resources, edit their details, and activate, deactivate, or delete them.

Editing a resource updates:

- `Resource.currentAnswers`
- Searchable resource fields
- Category relationships
- Coordinates when the address changes

The original `SurveyResponse.answers` remains unchanged.

Resource updates are reflected in the public directory, and deactivated resources are removed from public results.

### Administrator Management and Invitations

Authentication uses NextAuth credentials with server-side authorization checks.

Super administrators can:

- View and manage administrator accounts.
- Update roles and account status.
- Invite administrators by email.
- Remove administrators with confirmation.

Self-deletion and removal of the last active super administrator are blocked.

Invitations use Nodemailer with SMTP when configured.

Invitation links expire after 24 hours and are valid for one use. Only token hashes are stored in PostgreSQL.

Accepting an invitation creates the administrator account and notifies existing active administrators through the in-app notification center.

Each administrator can view and mark only their own notifications as read.

Actual invitation email delivery requires a configured SMTP provider.

### Analytics Dashboard

The dashboard displays:

- Total resources.
- Pending survey responses.
- Total administrators.
- Website session statistics when PostHog is configured.
- Category usage through a Recharts bar chart.

Category-filter interactions are stored in PostgreSQL.

The chart reports category usage, including categories with zero selections.

Analytics can be filtered by:

- Year.
- Month.
- Specific date.
- Date range.

PostHog is used for anonymous public page views, sessions, and `category_selected` events.

Private PostHog API credentials remain server-side. Survey answers and private administrator data are excluded from public analytics tracking.

### Progressive Web App

The application includes:

- Web app manifest.
- Application icons.
- Maskable icon.
- Service worker.
- Offline fallback page.
- Browser-based installation support.

Supported browsers can install the application directly using their built-in installation or Add to Home Screen options.

The service worker caches the offline page and selected static resources.

Authenticated pages, administrator data, invitation links, APIs, and survey submissions are not stored for offline reuse.

Offline survey submission and background synchronization are not implemented.

To test the PWA locally using a production build:

```powershell
npm run build
npm start
```

Open `http://localhost:3000`, load the site once while online, and use browser developer tools to verify the offline fallback.

## Architecture Decisions and Assumptions

The following decisions were made to keep the implementation maintainable while meeting the assessment requirements.

### 1. Modular Next.js Application

I kept the public website, admin portal, and backend API in one Next.js application instead of building separate frontend and backend projects.

This reduced deployment complexity and kept related application logic in one repository.

The code is organized into feature modules. Route handlers deal with HTTP requests and authorization, while services handle validation, database queries, and business operations.

The trade-off is that frontend and backend changes are deployed together, which is reasonable for the current project size.

### 2. Immutable Survey Versioning

Survey questions can change after providers have submitted their information.

If saved responses were displayed using the latest question definitions, older answers could become misleading or unreadable.

I used editable survey drafts and immutable published snapshots to avoid this problem.

Each `SurveyResponse` references the exact `SurveyVersion` used during submission. Answers are stored using stable field keys rather than labels or question positions.

This means a question can be renamed or reordered without changing the meaning of previously submitted answers.

Approved resources maintain their own `currentAnswers`, allowing administrators to edit public information without modifying the original submission.

### 3. Survey Field Mapping

The survey builder lets administrators specify which questions provide information for public resource listings.

This avoids depending on hardcoded question numbers or labels.

During approval, the application uses these mappings to populate searchable `Resource` fields.

The main mappings are:

| Survey mapping | Directory use |
| --- | --- |
| `TITLE`, `PROVIDER_NAME` | Listing title and provider name, with provider name as a possible fallback. |
| `CATEGORY`, `SPECIALTY`, `DESCRIPTION` | Category badges, specialty, and card description. |
| Street, city, state, and ZIP mappings | Address display, searching, and geocoding. |
| `PHONE`, `WEBSITE` | Contact links. N/A websites do not produce links. |
| Start/end day and time, `TIME_ZONE` | Office hours and current open/closed status. |
| `AGE_RANGE`, `AVERAGE_WAIT` | Summary information displayed on cards and lists. |
| `IMAGE` | Provider image when storage is configured, otherwise the default image. |
| Other published questions | Complete answers under their original headings in Read more. |

The public directory uses searchable columns for common operations and retains additional answers in `currentAnswers`.

This provides both efficient searching and support for newly added survey fields.

### 4. Deterministic Daily Random Ordering

Using PostgreSQL `ORDER BY random()` would change the ordering on every request.

That creates a pagination problem because visitors could see repeated resources or miss records while moving between pages.

Instead, the directory orders resources using a deterministic hash based on the UTC date and Resource ID.

A stable ID tie-breaker is also used.

This provides a different ordering each day while keeping results consistent during the same day.

The limitation is that adding or deactivating resources during the day can still change page boundaries.

### 5. Geocoding and Distance Calculation

A resource needs coordinates before it can participate in distance-based sorting.

I chose to resolve the submitted address during the approval workflow instead of requesting coordinates every time a visitor searches.

The application can:

- Reuse previously verified coordinates.
- Use a configured private geocoding endpoint.
- Accept manually validated coordinates when automatic lookup is unavailable.

This reduces dependency on external geocoding services during normal directory browsing.

When visitors allow location access, PostgreSQL calculates the distance using the Haversine formula.

The formula calculates great-circle distance between two latitude/longitude points.

Distances are calculated in miles and applied before pagination, allowing nearest and farthest sorting across the complete result set.

PostGIS was not introduced because the Haversine calculation is sufficient for the directory's requirements.

Visitor coordinates are used for the current request and are not stored as user records. Resources without coordinates sort last in location-based results.

### 6. PostgreSQL and PostHog for Analytics

I used PostgreSQL for healthcare category usage and PostHog for website sessions and page views.

Category interactions are already associated with known Category records, making them easy to validate and aggregate directly from the existing database.

This also allows the category chart to remain available when PostHog reporting is temporarily unavailable.

PostHog handles website session and page-view tracking, avoiding the need to build a separate session tracking system.

The dashboard distinguishes current database totals from time-filtered usage statistics.

### 7. Image Storage

The intended design uses private object storage for uploaded provider images while keeping only the object key in PostgreSQL.

This avoids storing binary images inside the application database and allows image access to be controlled through server endpoints.

The application contains an S3-compatible storage adapter and file validation logic.

However, **no S3-compatible bucket is configured in the current project**.

Image persistence is therefore not a completed deployment feature. The current application uses the default provider image where no stored image is available.

Persistent image uploads require storage configuration and end-to-end verification.

### 8. Transactions and Data Integrity

Approving a survey submission affects several related records.

These include:

- Survey response status.
- Reviewer information.
- New Resource.
- Category relationships.
- Audit log.

These updates run inside a Prisma transaction.

Database uniqueness rules and conditional status updates prevent repeated approval requests from creating duplicate Resources.

Invitation acceptance follows the same principle. Account creation, invitation consumption, and join notifications are handled together.

This prevents partial operations from leaving inconsistent data.

### 9. PWA Caching Strategy

I kept offline support limited to the offline page and necessary static assets.

Caching authenticated administrator pages, survey submissions, or private API responses could expose sensitive information or leave outdated data visible after an account logs out.

For that reason, these resources are excluded from service-worker caching.

The trade-off is that live directory browsing and form submission still require an internet connection.

This is intentional; the PWA does not attempt offline synchronization.

## Verification and Development Commands

| Command | Purpose |
| --- | --- |
| `npm test` | Run unit tests. |
| `npm run test:db` | Run database integration tests against a disposable local database. |
| `npm run db:validate` | Validate the Prisma schema. |
| `npm run auth:verify` | Verify the seeded administrator credentials without changing them. |
| `npm run mail:verify` | Check SMTP connection, TLS, and authentication without sending an invitation. |
| `npm run lint` | Run ESLint and naming checks. |
| `npm run typecheck` | Run strict TypeScript checks. |
| `npm run format:check` | Check code formatting with Prettier. |
| `npm run build` | Create a production Next.js build. |

The database integration runner uses a disposable local database and must not be directed at Railway databases containing application data.

Use fictional records when demonstrating survey submissions, approval, and administrator management.

### Responsive Design

The interface is designed to support viewport widths from 300px to 3000px.

The documented verification widths are:

| Width | Target |
| --- | --- |
| 300px | Small mobile |
| 360px | Standard mobile |
| 768px | Tablet |
| 1024px | Desktop |
| 1440px | Large desktop |
| 1920px | Full HD |
| 3000px | Ultra-wide display |

The layout also accounts for landscape orientation and 200% browser zoom.

Tables use contained scrolling or compact layouts on narrow screens, and the admin sidebar collapses into a mobile-friendly navigation menu.

## CI/CD and Deployment

The repository uses three branches:

- `main` — Main repository branch.
- `dev` — Development environment.
- `test` — Test/staging environment.

GitHub Actions runs automated checks before deployment.

The existing pipeline includes:

- ESLint.
- TypeScript checking.
- Production build.
- Prettier formatting.
- Prisma schema validation.
- Unit and database tests.
- Conventional Commit validation.

Successful pushes to `dev` and `test` are configured to deploy to their corresponding Railway environments.

| Branch | Railway environment | Database |
| --- | --- | --- |
| `dev` | Development | Independent PostgreSQL service |
| `test` | Test / staging | Separate PostgreSQL service |

Each environment uses its own database connection, authentication secret, application URL, and integration configuration.

### GitHub Deployment Configuration

GitHub environment variables:

- `RAILWAY_PROJECT_ID`
- `RAILWAY_SERVICE_ID`
- `RAILWAY_ENVIRONMENT_ID`
- `RAILWAY_PUBLIC_URL`

GitHub secrets:

- `RAILWAY_TOKEN_DEV`
- `RAILWAY_TOKEN_TEST`

Secret values are stored outside the repository.

Railway applies database migrations before starting the application:

```powershell
npm run db:migrate:deploy
```

This runs Prisma's `migrate deploy` command.

A migration failure must stop deployment.

Database seeding is not performed automatically during Railway deployments. Each target database must be seeded explicitly when first configured.

If GitHub Actions manages deployments, Railway's independent GitHub auto-deploy should remain disabled to avoid duplicate deployments.

### Coding Conventions

The project follows these conventions:

- **Files and folders:** kebab-case.
- **Variables and functions:** camelCase.
- **React components:** PascalCase.
- **TypeScript:** strict mode, without `any` or `@ts-ignore`.
- **Commits:** Conventional Commits.

Example:

```text
feat(surveys): add survey publishing
fix(auth): handle expired invitations
docs(readme): document deployment setup
```

## Current Integration Limitations

The following external services require configuration for their complete functionality.

**Image storage:** No S3-compatible bucket is configured. Image validation and default images are available, but persistent uploaded-image storage is not.

**SMTP:** Invitation emails require valid SMTP configuration. A successful connection test does not necessarily confirm delivery to an actual recipient.

**Geocoding:** Automatic address lookup requires the configured geocoding endpoint. Administrators can provide manually verified coordinates.

**PostHog:** Public tracking and session reporting require project-specific PostHog credentials. PostgreSQL-backed category analytics can operate independently.

**Offline support:** The PWA provides an offline fallback page. It does not provide an offline directory or queue survey submissions.

## Repository Structure

The following tree describes the application source and configuration based on the available project file inventory. Generated output, dependencies, and local secrets are excluded.

```text
resource-directory/
├── .github/ # Continuous integration and deployments
│   └── workflows/ # CI checks and Railway deployment
│       └── ci-cd.yaml # Quality checks and Railway deployment workflow
├── prisma/ # Database schema, migrations and seed data
│   ├── migrations/ # Versioned database changes
│   │   ├── 20261112000100_initial/
│   │   │   └── migration.sql # Initial database tables
│   │   ├── 20261112000200_integrity_guards/
│   │   │   └── migration.sql # Database integrity constraints
│   │   └── migration_lock.toml # Prisma migration provider lock
│   ├── seed-data/ # Default survey and fictional providers
│   │   ├── default-survey.ts # Appendix A survey questions and options
│   │   └── sample-resources.ts # Fictional resource records
│   ├── schema.prisma # Database models and relationships
│   ├── seed-database.ts # Repeatable seed implementation
│   └── seed.ts # Seed entry point
├── public/ # Static assets
│   ├── icons/ # PWA icons
│   │   ├── apple-touch-icon.png # iOS home screen icon
│   │   ├── icon-192.png # 192px install icon
│   │   ├── icon-512.png # 512px install icon
│   │   ├── icon-maskable-512.png # Maskable install icon
│   │   └── icon.svg # Editable icon source
│   ├── file.svg
│   ├── globe.svg
│   ├── next.svg
│   ├── provider-default.svg # Default provider image
│   ├── sw.js # Offline service worker
│   ├── vercel.svg
│   └── window.svg
├── scripts/ # Local verification utilities
│   ├── run-database-tests.ts # Database test runner
│   ├── verify-admin-login.ts # Seeded admin credentials check
│   ├── verify-database.ts # Database connectivity check
│   ├── verify-invitation-smtp.ts # SMTP verification
│   └── verify-seed-data.ts # Seed integrity verification
├── src/
│   ├── app/ # Next.js pages and API routes
│   │   ├── admin/ # Administrator portal
│   │   │   ├── (protected)/ # Authenticated admin routes
│   │   │   │   ├── admins/
│   │   │   │   │   ├── error.tsx
│   │   │   │   │   ├── loading.tsx
│   │   │   │   │   └── page.tsx # Administrator management
│   │   │   │   ├── resources/
│   │   │   │   │   ├── [id]/
│   │   │   │   │   │   └── edit/
│   │   │   │   │   │       └── page.tsx # Resource editing
│   │   │   │   │   ├── error.tsx
│   │   │   │   │   ├── loading.tsx
│   │   │   │   │   └── page.tsx # Resource management
│   │   │   │   ├── responses/
│   │   │   │   │   ├── [id]/
│   │   │   │   │   │   ├── not-found.tsx
│   │   │   │   │   │   └── page.tsx # Response details
│   │   │   │   │   ├── error.tsx
│   │   │   │   │   ├── loading.tsx
│   │   │   │   │   └── page.tsx # Response listing
│   │   │   │   ├── surveys/
│   │   │   │   │   ├── [id]/
│   │   │   │   │   │   ├── edit/
│   │   │   │   │   │   │   └── page.tsx # Survey editor
│   │   │   │   │   │   └── preview/
│   │   │   │   │   │       └── page.tsx # Survey preview
│   │   │   │   │   ├── error.tsx
│   │   │   │   │   └── page.tsx # Survey management
│   │   │   │   ├── error.tsx
│   │   │   │   ├── layout.tsx
│   │   │   │   ├── loading.tsx
│   │   │   │   └── page.tsx # Analytics dashboard
│   │   │   ├── login/
│   │   │   │   └── page.tsx # Admin login
│   │   │   └── layout.tsx
│   │   ├── api/ # Backend route handlers
│   │   │   ├── admin/ # Protected admin APIs
│   │   │   │   ├── admins/
│   │   │   │   │   └── [id]/
│   │   │   │   │       └── route.ts # Admin updates/deletion
│   │   │   │   ├── analytics/
│   │   │   │   │   └── route.ts # Dashboard analytics
│   │   │   │   ├── invitations/
│   │   │   │   │   ├── [id]/
│   │   │   │   │   │   └── route.ts # Invitation management
│   │   │   │   │   └── route.ts # Create invitations
│   │   │   │   ├── me/
│   │   │   │   │   └── route.ts # Current admin
│   │   │   │   ├── notifications/
│   │   │   │   │   ├── [id]/
│   │   │   │   │   │   └── route.ts # Mark as read
│   │   │   │   │   └── route.ts # List notifications
│   │   │   │   ├── resources/
│   │   │   │   │   └── [id]/
│   │   │   │   │       ├── image/
│   │   │   │   │       │   └── route.ts # Private image access
│   │   │   │   │       └── route.ts # Resource updates
│   │   │   │   ├── responses/
│   │   │   │   │   └── [id]/
│   │   │   │   │       ├── approve/
│   │   │   │   │       │   └── route.ts # Resource approval
│   │   │   │   │       ├── image/
│   │   │   │   │       │   └── route.ts # Response image
│   │   │   │   │       └── reject/
│   │   │   │   │           └── route.ts # Response rejection
│   │   │   │   └── surveys/
│   │   │   │       ├── [id]/
│   │   │   │       │   ├── duplicate/
│   │   │   │       │   │   └── route.ts
│   │   │   │       │   ├── publish/
│   │   │   │       │   │   └── route.ts
│   │   │   │       │   ├── unpublish/
│   │   │   │       │   │   └── route.ts
│   │   │   │       │   └── route.ts
│   │   │   │       └── route.ts # Survey management APIs
│   │   │   ├── analytics/
│   │   │   │   └── category/
│   │   │   │       └── route.ts # Category event tracking
│   │   │   ├── auth/
│   │   │   │   └── [...nextauth]/
│   │   │   │       └── route.ts # NextAuth handlers
│   │   │   ├── invitations/
│   │   │   │   └── [token]/
│   │   │   │       └── route.ts # Invitation acceptance
│   │   │   ├── resources/
│   │   │   │   ├── [id]/
│   │   │   │   │   ├── image/
│   │   │   │   │   │   └── route.ts # Public approved images
│   │   │   │   │   └── route.ts # Resource details
│   │   │   │   └── route.ts # Public search and pagination
│   │   │   └── surveys/
│   │   │       └── [id]/
│   │   │           └── responses/
│   │   │               └── route.ts # Public survey submissions
│   │   ├── invite/
│   │   │   └── [token]/
│   │   │       └── page.tsx # Invitation acceptance
│   │   ├── offline/
│   │   │   └── page.tsx # Offline fallback
│   │   ├── survey/
│   │   │   └── [id]/
│   │   │       ├── not-found.tsx
│   │   │       └── page.tsx # Public survey
│   │   ├── error.tsx
│   │   ├── favicon.ico
│   │   ├── globals.css
│   │   ├── layout.tsx
│   │   ├── manifest.ts # PWA manifest
│   │   └── page.tsx # Public homepage
│   ├── components/ # Shared components
│   │   ├── admin/
│   │   │   ├── admin-brand.tsx
│   │   │   ├── admin-shell.tsx
│   │   │   ├── login-form.tsx
│   │   │   ├── logout-button.tsx
│   │   │   └── section-placeholder.tsx
│   │   ├── shared/
│   │   │   └── service-worker-registration.tsx
│   │   └── ui/
│   │       └── button.tsx
│   ├── lib/ # Shared server utilities
│   │   ├── database-client.ts
│   │   ├── db.ts
│   │   ├── image-storage.ts # Optional storage adapter
│   │   └── utils.ts
│   ├── modules/ # Feature modules
│   │   ├── analytics/
│   │   │   ├── components/
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
│   │   ├── auth/
│   │   │   ├── admin-api.ts
│   │   │   ├── auth-types.ts
│   │   │   ├── authorization.ts
│   │   │   ├── credentials.ts
│   │   │   ├── login-limiter.ts
│   │   │   ├── page-access.ts
│   │   │   └── session-data.ts
│   │   ├── management/
│   │   │   ├── components/
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
│   │   ├── resources/
│   │   │   ├── components/
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
│   │   ├── responses/
│   │   │   ├── components/
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
│   │   └── surveys/
│   │       ├── components/
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
│   ├── types/
│   │   └── next-auth.d.ts
│   ├── auth.ts # NextAuth configuration
│   └── instrumentation-client.ts # PostHog initialization
├── tests/ # Existing test suites
│   ├── fixtures/
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
├── .env.example # Environment variable examples
├── .gitattributes
├── .gitignore
├── .nvmrc
├── .prettierignore
├── .prettierrc.json
├── .railwayignore
├── AGENTS.md
├── commitlint.config.mjs
├── components.json
├── compose.yaml
├── eslint.config.mjs
├── next.config.ts
├── package-lock.json
├── package.json
├── prisma.config.ts
├── railway.json
├── README.md
├── tsconfig.json
├── vitest.config.mts
└── vitest.database.config.mts
```
