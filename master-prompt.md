# VYBE Master Prompt for AI Agent

> **Gunakan ini sebagai prompt utama saat memulai development VYBE.**

---

## PROJECT PRINCIPLE

VYBE follows:

**"Looks first. Connection later."**

Physical attraction is an important part of the initial discovery experience.

The application must **NOT** publicly rate users by attractiveness or assign public beauty scores.

The system should learn individual user preferences and use those preferences to improve candidate relevance.

---

## TECH STACK

### Backend
- Node.js
- TypeScript
- Fastify
- PostgreSQL
- Prisma ORM
- Zod
- JWT
- Refresh tokens
- Argon2id
- Swagger/OpenAPI
- pnpm

### Storage
- Cloudflare R2 for profile photos

### Mobile
- React Native
- Expo
- TypeScript
- Expo Router
- TanStack Query
- Zustand

### Web
- Next.js
- TypeScript
- PWA

### Infrastructure
- Docker Compose
- PostgreSQL
- Redis when required

---

## ARCHITECTURE

The repository should eventually follow:

```
vybe/
├── apps/
│   ├── api/
│   ├── mobile/
│   └── web/
├── packages/
│   ├── database/
│   ├── shared/
│   └── config/
├── docs/
├── docker-compose.yml
├── package.json
├── pnpm-workspace.yaml
└── README.md
```

---

## DEVELOPMENT PHASES

**PHASE 1:** Backend foundation.

**PHASE 2:** Android MVP.

**PHASE 3:** Production infrastructure, recommendation improvements, and PWA.

---

## IMPORTANT

Only work on the current phase.

Do **NOT** start the next phase until the current phase passes its Definition of Done.

---

==================================================
PHASE 1 — BACKEND FOUNDATION
==================================================

Build the backend first.

### Required modules:
- authentication
- users
- profiles
- photos
- preferences
- discovery
- likes
- passes
- matches
- blocks
- reports

### Required authentication endpoints:
```
POST /auth/register
POST /auth/login
POST /auth/refresh
POST /auth/logout
```

### Required profile endpoints:
```
GET /me                    # Current user (profile + preferences + photos)
GET /me/profile            # Current user profile only
PUT /me/profile            # Update own profile
GET /users/:userId/profile # Public profile of another user
```

### Required photo endpoints:
```
GET /photos
POST /photos
PUT /photos/:id
DELETE /photos/:id
```

### Required preference endpoints:
```
GET /preferences
PUT /preferences
```

### Required discovery endpoints:
```
GET /discovery
```

### Required interaction endpoints:
```
POST /users/:id/like
POST /users/:id/pass
```

### Required match endpoints:
```
GET /matches
POST /matches/:id/unmatch
```

### Required safety endpoints:
```
POST /users/:id/block
POST /users/:id/report
```

### Required account lifecycle endpoints:
```
POST /account/deactivate    # Soft deactivate (status: DEACTIVATED)
DELETE /account             # Hard delete (status: DELETED, cascade cleanup)
```

---

## DATABASE

Use PostgreSQL.

Use Prisma migrations.

### Core models:
- User
- Profile
- Photo
- Preference
- Like
- Pass
- Match
- Block
- Report
- RefreshToken

> **Message model added in Phase 2.** Phase 1 does not include chat endpoints.

The schema must use proper indexes and foreign keys.

Avoid unnecessary denormalization during MVP.

---

## SECURITY

- Passwords must use Argon2id.
- Never store plaintext passwords.
- Use short-lived access tokens (15 min) and refresh tokens (7 days) with rotation.
- Validate all external input with Zod.
- Never trust client-provided authorization data.
- Protect private endpoints.
- Never commit secrets.
- Use environment variables.

## LOCATION PRIVACY

- Database stores `latitude` and `longitude` for distance calculation.
- **API never returns exact coordinates to other users.**
- Discovery/profile public returns:
  - `distance` (km, calculated server-side via Haversine)
  - `locationLabel` (e.g., "Jakarta Selatan")
- Only the user themselves can see their own exact coordinates (if needed).

---

## DISCOVERY

Initial discovery must use deterministic rules.

At minimum consider (hard filters):
- gender compatibility (user's preferred_gender ↔ candidate's gender)
- age range (candidate's calculated age from date_of_birth within user's min/max_age)
- distance (Haversine ≤ user's max_distance)
- profile completeness (has primary photo, bio, preferences)
- user status = `ACTIVE`
- blocked users (bidirectional)
- already interacted: `LIKED` | `PASSED` | `MATCHED` | `BLOCKED`

**Initial scoring:** Simple weighted deterministic score:
```
score = (preference_match * 0.4) + (distance_score * 0.3) + (activity_score * 0.2) + (completeness * 0.1)
```

**Do NOT implement machine learning yet.**

**Do NOT implement an attractiveness score.**

The system calculates candidate relevance based on compatibility with the user's stated preferences.

---

## MATCHING

If:
- User A likes User B
- AND User B likes User A

Then create a Match.

Prevent duplicate matches.

---

## SAFETY

- Blocked users must not appear in discovery.
- Reported users must be stored for moderation.
- Users must be able to unmatch.

---

## API DOCUMENTATION

Expose Swagger/OpenAPI documentation.

---

## TESTING

Every major module must have tests.

At minimum test:
- registration (including age gate 18+)
- login
- invalid password
- token refresh (rotation)
- logout (revoke)
- profile CRUD (own + public)
- location privacy (coords not exposed)
- photo metadata CRUD
- preferences CRUD (physical_preferences validation)
- discovery filtering (all hard filters + interacted states)
- like/pass/match flow
- duplicate like prevention
- unmatch
- block (bidirectional exclusion)
- report
- account deactivate/delete
- user status enforcement (ACTIVE only in discovery)

---

## DEVELOPMENT PROCESS

For every task:

1. Inspect the existing project.
2. Understand the current architecture.
3. Make a small implementation.
4. Run formatting/linting.
5. Run tests.
6. Fix all failures.
7. Verify the feature manually when appropriate.
8. Update documentation.
9. Create a Git commit.
10. Only then continue.

**Do not silently skip failed tests.**

**Do not claim a feature works unless it has been verified.**

**Do not create fake endpoints.**

**Do not use placeholder implementations for core functionality.**

**Do not rewrite working code unnecessarily.**

---

==================================================
PHASE 1 TASK ORDER
==================================================

### TASK 01 — Initialize repository and workspace
- Create pnpm workspace
- Create folder structure (apps/api, packages/database, packages/shared, packages/config)
- Create root package.json, pnpm-workspace.yaml, README.md, .gitignore
- Initialize git repo

### TASK 02 — Configure TypeScript, pnpm, linting, formatting, and environment configuration
- TypeScript strict config for all packages
- ESLint + Prettier
- .env.example with all required variables
- Husky + lint-staged (optional)

### TASK 03 — Create Docker Compose PostgreSQL development environment
- docker-compose.yml with PostgreSQL 15+
- Health checks
- Volume persistence
- Optional: Redis for later phases

### TASK 04 — Configure Prisma and database connection
- Initialize Prisma in packages/database
- Configure Prisma client with proper connection pooling
- Set up migration directory
- Create database connection utility

### TASK 05 — Design and implement database schema
- Prisma schema with all core models
- Proper relations, indexes, constraints
- Run initial migration
- Verify schema with `prisma db pull` / `prisma studio`

### TASK 06 — Implement authentication
- POST /auth/register (email, password, name)
- POST /auth/login (email, password)
- POST /auth/refresh (refresh token rotation)
- POST /auth/logout (revoke refresh token)
- Argon2id hashing
- JWT access token (15 min) + refresh token (7 days)
- Zod validation for all inputs
- Rate limiting on auth endpoints

### TASK 07 — Implement user/profile module
- GET /me (current user with profile + preferences + photos)
- GET /me/profile (current user profile only)
- PUT /me/profile (update own profile)
- GET /users/:userId/profile (public profile of another user)
- Fields: name, date_of_birth (ISO 8601), gender, height (cm), bio, location (lat/lng — stored only, never exposed to others)
- **Age calculated from date_of_birth at query time. Never store age.**
- **Public profile returns:** name, age, gender, height, bio, distance, locationLabel
- Zod validation
- Proper error handling

### TASK 08 — Implement photo metadata and storage abstraction
- GET /photos (list user photos with metadata)
- POST /photos (create photo metadata, return presigned upload URL)
- PUT /photos/:id (update primary, ordering)
- DELETE /photos/:id (soft delete + cleanup)
- Storage abstraction for R2 (local mock in dev)
- Photo metadata: r2_key, width, height, size, mime_type, is_primary, order_index

### TASK 09 — Implement preferences
- GET /preferences (current user preferences)
- PUT /preferences (update preferences)
- Fields: preferred_gender (male|female|both), min_age, max_age, max_distance (km), min_height, max_height, physical_preferences (JSON)
- **Physical Preferences Zod Schema:**
```typescript
const PhysicalPreferencesSchema = z.object({
  bodyTypes: z.array(z.enum(['slim', 'average', 'athletic', 'curvy', 'plus'])).optional(),
  style: z.array(z.enum(['casual', 'streetwear', 'formal', 'sporty', 'vintage', 'minimalist'])).optional(),
  hair: z.array(z.enum(['short', 'medium', 'long', 'bald', 'curly'])).optional(),
  heightImportance: z.number().min(0).max(1).optional(),
});
```
- No arbitrary JSON — all fields validated
- Sensible defaults for all fields

### TASK 10 — Implement discovery
- GET /discovery (paginated candidates)
- Query params: limit (default 20), cursor
- Hard filters: gender compatibility, age range (calculated from date_of_birth), distance (Haversine), profile completeness, user status = ACTIVE, blocked users, already interacted (LIKED/PASSED/MATCHED/BLOCKED)
- Deterministic weighted scoring (see DISCOVERY section)
- Return candidate with profile, primary photo, distance, locationLabel, compatibilityScore

### TASK 11 — Implement like/pass
- POST /users/:id/like
- POST /users/:id/pass
- Record in likes/passes tables
- Check for mutual like → create match
- Prevent duplicate likes/passes
- Return match status if created

### TASK 12 — Implement mutual matching
- GET /matches (list user's matches with last message preview — *Phase 2 adds message, Phase 1 returns match info only*)
- POST /matches/:id/unmatch
- Soft delete match
- Prevent accessing unmatched conversations

### TASK 13 — Implement block/report
- POST /users/:id/block (add to blocks table)
- POST /users/:id/report (reason, description)
- Blocked users excluded from discovery (bidirectional)
- Report stored for admin moderation
- Users cannot interact with blocked users

### TASK 13B — Implement account lifecycle
- POST /account/deactivate (soft deactivate, status: DEACTIVATED)
- DELETE /account (hard delete, status: DELETED, cascade cleanup)
- User status enum: ACTIVE | DEACTIVATED | BANNED | DELETED
- Discovery only returns ACTIVE users
- Deactivated users can reactivate via login

### TASK 14 — Implement API documentation (Swagger)
- Fastify Swagger plugin
- OpenAPI 3.0 spec
- Document all endpoints with request/response schemas
- Authentication schemes (Bearer token)
- Serve at /docs

### TASK 15 — Implement integration tests
- Test setup with test database (Docker)
- Test auth flow (register, login, refresh, logout)
- Test profile CRUD
- Test photo metadata CRUD
- Test preferences CRUD
- Test discovery filtering
- Test like/pass/match flow
- Test block/report
- Run tests in CI pipeline

### TASK 16 — Perform Phase 1 verification
- Start all services (docker-compose up)
- Run migrations
- Start backend
- Verify Swagger at /docs
- Run full test suite
- Manual smoke test all endpoints
- Confirm all Phase 1 DoD items ✅

---

==================================================
PHASE 1 DEFINITION OF DONE
==================================================

The phase is complete only when:

- [ ] backend starts successfully
- [ ] PostgreSQL starts successfully
- [ ] migrations work
- [ ] registration works (age gate 18+)
- [ ] login works
- [ ] refresh token works (rotation)
- [ ] logout works (revoke)
- [ ] profile works (GET /me, GET /me/profile, PUT /me/profile, GET /users/:id/profile)
- [ ] location privacy: exact coords never exposed, only distance + locationLabel
- [ ] photo API works (CRUD, primary, ordering, R2 metadata)
- [ ] preferences work (GET/PUT, Zod-validated physical_preferences)
- [ ] discovery works (filters, scoring, pagination, excludes LIKED/PASSED/MATCHED/BLOCKED)
- [ ] like works (mutual → match)
- [ ] pass works
- [ ] mutual match works
- [ ] unmatch works
- [ ] block works (bidirectional exclusion)
- [ ] report works (stored for moderation)
- [ ] account lifecycle: deactivate / delete endpoints
- [ ] user status enum enforced (ACTIVE only in discovery)
- [ ] Swagger works
- [ ] tests pass
- [ ] no known critical errors remain

---

## PRODUCT RULES (NON-NEGOTIABLE)

These rules must be enforced at every layer (DB, API, Client):

1. **VYBE does not publicly rank physical attractiveness.** No leaderboards, no public scores.
2. **VYBE does not generate public beauty scores.** Attractiveness is subjective and private.
3. **Physical preferences belong to the individual user.** Each user's preferences are their own; not aggregated into a global ranking.
4. **Discovery prioritizes mutual preference compatibility.** Score = f(user_preferences, candidate_attributes), not f(candidate_popularity).
5. **Exact user coordinates are never exposed to other users.** API returns `distance` (km) and `locationLabel` (city/area) only.
6. **Blocked users never appear in discovery.** Bidirectional exclusion.
7. **Users can delete their account.** GDPR-compliant hard delete with cascade.
8. **Users can report profiles.** Reports stored for human moderation.
9. **Profile photos must belong to the user.** Verified via upload flow; no URL pasting.
10. **Users must be adults to use the platform.** Age gate at registration (date_of_birth → age ≥ 18).
11. **No ML for attractiveness ranking.** V1 = rule-based. V2 = behavior-based. V3 = ML only with sufficient data.
12. **Chat is Phase 2.** Phase 1 backend does not include messaging endpoints.

---

==================================================
GIT RULES
==================================================

Use small meaningful commits.

Example:
```
feat(api): initialize fastify backend
feat(db): add initial prisma schema
feat(auth): implement authentication
feat(profile): implement profile module
feat(discovery): implement candidate discovery
feat(match): implement mutual matching
test(api): add integration tests
```

Never force-push unless explicitly instructed.

Never delete the Git history.

---

==================================================
WHEN STARTING WORK
==================================================

First inspect the current working directory.

Determine whether a VYBE repository already exists.

Do not overwrite existing projects.

If the repository is empty, initialize it according to the architecture above.

Then begin TASK 01.

After completing each task, report:

```
TASK: [nomor task]
STATUS: [completed/failed/blocked]
CHANGES: [ringkasan perubahan files]
TESTS: [passed/failed - detail jika ada yg gagal]
NEXT TASK: [nomor task selanjutnya]
```

Keep the report concise.

Do not ask unnecessary questions.

If a decision can reasonably be made from the architecture and requirements, make the decision and document it.

Only stop and ask the user when a decision would materially change the architecture, security, data model, or product requirements.