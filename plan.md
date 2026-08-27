# VYBE Development Plan

## 1. Product Vision

**VYBE** adalah dating platform dengan pendekatan *physical-attraction-first*.

**Prinsip utama:**
- **Looks first. Connection later.**
- Fisik menjadi faktor awal dalam discovery
- Aplikasi **TIDAK** memberikan rating publik terhadap tingkat kecantikan
- Sistem mempelajari preferensi pengguna untuk kandidat lebih relevan

**Target awal:**
- Android APK
- Backend REST API
- PostgreSQL
- Setelah MVP stabil → PWA/Web

---

## 2. Technology Stack

### Backend
| Teknologi | Versi/Detail |
|-----------|--------------|
| Node.js | LTS |
| TypeScript | Strict mode |
| Fastify | Web framework |
| PostgreSQL | 15+ |
| Prisma ORM | Latest |
| Zod | Validation |
| JWT | Access token |
| Refresh Token | Rotation |
| Argon2id | Password hashing |
| Swagger/OpenAPI | Documentation |
| pnpm | Package manager |

### Storage
- **Cloudflare R2** untuk foto profil
- PostgreSQL hanya menyimpan metadata foto

### Mobile
| Teknologi | Detail |
|-----------|--------|
| React Native | Via Expo |
| Expo | Managed workflow |
| TypeScript | Strict |
| Expo Router | File-based routing |
| TanStack Query | Server state |
| Zustand | Client state |
| NativeWind/StyleSheet | Styling |
| Expo Image Picker | Photo upload |

### Web (Phase 3)
- Next.js
- TypeScript
- PWA
- Responsive mobile-first
- Shared API/types dengan mobile

### Infrastructure
**Development:**
```yaml
Docker Compose:
  - PostgreSQL
  - Redis (optional initially)
```

**Production:**
```
Android / PWA
      │
      ▼
   Fastify API
      │
 ┌────┴────┐
 ▼         ▼
Postgres   R2
 │
 ▼
Redis
```

---

## 3. Repository Structure

```
vybe/
├── apps/
│   ├── api/
│   ├── mobile/
│   └── web/
│
├── packages/
│   ├── database/
│   ├── shared/
│   └── config/
│
├── docs/
│   ├── architecture.md
│   ├── api.md
│   └── development-plan.md
│
├── docker-compose.yml
├── package.json
├── pnpm-workspace.yaml
├── README.md
└── .gitignore
```

> `web/` dibuat di Phase 3

---

## 4. PHASE 1 — Backend Foundation

### Objective
Membangun backend VYBE yang stabil dengan seluruh core business logic tersedia via REST API.

### Task Breakdown — SINGLE SOURCE OF TRUTH
Gunakan **hanya** urutan di **Section 10** sebagai referensi eksekusi. Bagian ini hanya ringkasan modul.

### Database Core Models

```
users
 ├── profiles
 ├── photos
 ├── preferences
 ├── likes
 ├── passes
 ├── matches
 │     └── messages
 ├── blocks
 ├── reports
 └── refresh_tokens
```

### Authentication Endpoints
```
POST /auth/register
POST /auth/login
POST /auth/refresh
POST /auth/logout
```

**Security:**
- Argon2id password hashing
- Short-lived access token (15m)
- Refresh token dengan rotation
- Input validation via Zod
- Rate limiting (basic)

### Profile Endpoints
```
GET  /me                    # Current user (profile + preferences + photos)
GET  /me/profile            # Current user profile only
PUT  /me/profile            # Update own profile
GET  /users/:userId/profile # Public profile of another user
```

**Data minimum:**
- name
- date_of_birth (ISO 8601) — **umur dihitung dari field ini, jangan simpan age**
- gender
- height (cm)
- bio
- location (lat/lng) — **hanya disimpan di DB, tidak diekspos ke user lain**

**Response ke user lain (discovery/profile public):**
```json
{
  "name": "Budi",
  "age": 27,
  "gender": "male",
  "height": 175,
  "bio": "...",
  "distance": 3.4,
  "locationLabel": "Jakarta Selatan"
}
```
> **Exact coordinates never exposed.** Distance calculated server-side via Haversine.

### Photos Endpoints
```
GET    /photos
POST   /photos
PUT    /photos/:id
DELETE /photos/:id
```

**Support:**
- Multiple photos
- Primary photo
- Ordering
- Deletion
- Storage metadata (R2 key, dimensions, size)

### Preferences Endpoints
```
GET /preferences
PUT /preferences
```

**Fields:**
- preferred_gender: `male` | `female` | `both`
- min_age / max_age: number (18-99)
- max_distance: number (km, 1-100)
- min_height / max_height: number (cm)
- physical_preferences: JSON (Zod-validated)

**Physical Preferences Schema (Zod):**
```typescript
const PhysicalPreferencesSchema = z.object({
  bodyTypes: z.array(z.enum(['slim', 'average', 'athletic', 'curvy', 'plus'])).optional(),
  style: z.array(z.enum(['casual', 'streetwear', 'formal', 'sporty', 'vintage', 'minimalist'])).optional(),
  hair: z.array(z.enum(['short', 'medium', 'long', 'bald', 'curly'])).optional(),
  heightImportance: z.number().min(0).max(1).optional(), // weight for scoring
});
```
> **Tidak boleh arbitrary JSON.** Semua preferensi fisik divalidasi schema.

### Discovery Endpoint
```
GET /discovery
```

**Query params:** `limit` (default 20), `cursor` (pagination)

**Initial filtering (hard filters):**
- Gender compatibility (user's preferred_gender ↔ candidate's gender)
- Age range (candidate's calculated age within user's min/max_age)
- Distance (Haversine ≤ user's max_distance)
- Profile completeness (has primary photo, bio, preferences set)
- User status = `ACTIVE`
- Blocked users (both directions)
- Already interacted: `LIKED` | `PASSED` | `MATCHED` | `BLOCKED`

**Initial scoring:** Sederhana, deterministic weighted score:
```
score = (preference_match * 0.4) + (distance_score * 0.3) + (activity_score * 0.2) + (completeness * 0.1)
```

**Return:** Paginated candidates with profile, primary photo, distance, locationLabel, compatibilityScore

### Like / Pass Endpoints
```
POST /users/:id/like
POST /users/:id/pass
```

**Match logic:**
```
A likes B AND B likes A → MATCH CREATED
```

### Match Endpoints
```
GET  /matches
POST /matches/:id/unmatch
```

### Safety Endpoints
```
POST /users/:id/block
POST /users/:id/report
```

**Rules:**
- Blocked users tidak muncul di discovery
- Reported users disimpan untuk moderasi

### Account Lifecycle Endpoints
```
POST /account/deactivate    # Soft deactivate (status: DEACTIVATED)
DELETE /account             # Hard delete (status: DELETED, cascade cleanup)
```

**User status enum:**
- `ACTIVE` — Normal usage
- `DEACTIVATED` — Hidden from discovery, can reactivate via login
- `BANNED` — Moderation action, cannot login
- `DELETED` — GDPR hard delete, data anonymized/cascaded

> Discovery hanya menampilkan user dengan status `ACTIVE`.

---

## 5. PHASE 2 — Android MVP

### Objective
User dapat menggunakan VYBE dari register sampai match dan chat.

### Flow
```
Splash → Onboarding → Register/Login → Create Profile → Upload Photos
    → Set Preferences → Discovery → Like/Pass → Match → Chat
```

### Screens
1. Splash
2. Onboarding
3. Login
4. Register
5. Create Profile
6. Photo Setup
7. Preferences
8. Discovery (Main screen)
9. Profile Detail
10. Match Animation
11. Matches List
12. Chat
13. Settings
14. Report/Block
15. Account Deletion

### Discovery UX
```
┌─────────────────────────┐
│ VYBE                    │
│                         │
│                         │
│        PROFILE          │
│          PHOTO          │
│                         │
│                         │
│  Name, Age              │
│  Height                 │
│  Distance               │
│                         │
│     ✕           ♥       │
└─────────────────────────┘
```

**Swipe:**
- ← PASS
- → LIKE

**Match Screen:**
```
YOU LIKED EACH OTHER

        [PHOTO]
        
       It's a VYBE!

      [START CHAT]
```

### Chat (Phase 2 scope)
- Text message
- Timestamp
- Read status
- Block from chat
- Unmatch from chat

### Phase 2 Features
- Push notification
- Image messaging
- Block/Report
- Logout
- Account deletion
- Loading/Error states
- Empty states

---

## 6. PHASE 3 — Production + PWA

### Backend Upgrades
| Feature | Description |
|---------|-------------|
| Redis | Caching, sessions, rate limiting |
| Rate limiting | Per-user, per-endpoint |
| Image optimization | Resize, WebP, thumbnails |
| Cloudflare R2 | Production storage |
| Email verification | OTP-based |
| Push notification | Expo push / FCM |
| Background jobs | BullMQ / similar |
| Logging | Structured (pino) |
| Monitoring | Health checks, metrics |
| Backup | Automated PG dumps |

### Recommendation Engine Evolution

#### V1 — Rule-based Scoring
```
Hard Filters
     ↓
Preference Matching
     ↓
Distance
     ↓
Activity Score
     ↓
Discovery Score
```

#### V2 — Behavior-based
```
User behavior (LIKE/PASS/MATCH/CHAT/UNMATCH)
      ↓
Preference model learning
      ↓
Personalized Discovery
```

#### V3 — ML Recommendation
> **JANGAN LANGSUNG ML.** Butuh data cukup dulu.

### PWA (After Android Stable)
```
apps/
├── api/
├── mobile/
└── web/
```

**Web Stack:**
- Next.js
- TypeScript
- PWA (service worker, manifest)
- Responsive mobile-first
- Shared types via `packages/shared`

---

## 7. Agent Development Rules

### Workflow Per Task
```
READ → PLAN → IMPLEMENT → TEST → FIX → VERIFY → COMMIT → NEXT TASK
```

### Hard Rules
| Rule | Description |
|------|-------------|
| ❌ No rewrite | Jangan rewrite tanpa alasan |
| ❌ No stack change | Jangan ganti stack tanpa alasan teknis kuat |
| ❌ No unrequested features | Jangan bikin fitur yang belum diminta |
| ❌ No delete without approval | Jangan hapus existing functionality |
| ❌ No secrets in repo | Environment variables only |
| ❌ No plaintext passwords | Argon2id only |
| ✅ All input validated | Zod di semua endpoint |
| ✅ Auth required | Private endpoints protected |
| ✅ Migrations only | Semua perubahan DB via migration |
| ✅ Tests required | Setiap fitur punya test |
| ✅ No skip failed tests | Fix dulu baru lanjut |
| ✅ No fake impl | No placeholder production code |
| ✅ Document decisions | ADR untuk arsitektur penting |
| ✅ Git checkpoints | Commit rutin, meaningful |

---

## 8. Definition of Done

### Phase 1
- [ ] Repository initialized
- [ ] Backend starts successfully
- [ ] PostgreSQL starts successfully
- [ ] Prisma migration works
- [ ] Register works (age gate 18+)
- [ ] Login works
- [ ] Refresh token works (rotation)
- [ ] Logout works (revoke refresh token)
- [ ] Profile works (GET /me, GET /me/profile, PUT /me/profile, GET /users/:id/profile)
- [ ] Location privacy: exact coords never exposed, only distance + locationLabel
- [ ] Photo API works (CRUD, primary, ordering, R2 metadata)
- [ ] Preferences work (GET/PUT, Zod-validated physical_preferences)
- [ ] Discovery works (filters, scoring, pagination, excludes LIKED/PASSED/MATCHED/BLOCKED)
- [ ] Like works (mutual → match)
- [ ] Pass works
- [ ] Mutual match works
- [ ] Unmatch works
- [ ] Block works (excluded from discovery both ways)
- [ ] Report works (stored for moderation)
- [ ] Account lifecycle: deactivate / delete endpoints
- [ ] User status enum enforced (ACTIVE only in discovery)
- [ ] Swagger works
- [ ] API tests pass
- [ ] No known critical errors

### Phase 2
- [ ] Android project works
- [ ] APK builds (debug/release)
- [ ] Register works
- [ ] Login works
- [ ] Profile works
- [ ] Photo upload works
- [ ] Preferences work
- [ ] Discovery works
- [ ] Swipe works
- [ ] Like works
- [ ] Match works (with animation)
- [ ] Chat works
- [ ] Block/report works
- [ ] Account deletion works
- [ ] Error states implemented
- [ ] Loading states implemented

### Phase 3
- [ ] Production backend deployed
- [ ] HTTPS configured
- [ ] R2 configured
- [ ] Redis configured
- [ ] Rate limiting active
- [ ] Push notification works
- [ ] Image optimization active
- [ ] Monitoring active
- [ ] Database backup automated
- [ ] Recommendation engine V1 deployed
- [ ] PWA deployed
- [ ] Production APK built
- [ ] Security review completed

---

## 9. Git Strategy

### Branch Structure
```
main
 │
 ├── phase-1-foundation
 │
 ├── phase-2-mobile
 │
 └── phase-3-production
```

### Safer: Feature Branches
```
main
 ↓
feat/auth
 ↓
feat/profile
 ↓
feat/photos
 ↓
feat/discovery
 ↓
feat/matching
```

**Rollback capability** jika agent ngaco.

### Commit Convention
```
feat(api): initialize fastify backend
feat(db): add initial prisma schema
feat(auth): implement authentication
feat(profile): implement profile module
feat(discovery): implement candidate discovery
feat(match): implement mutual matching
test(api): add integration tests
fix(auth): handle token rotation edge case
docs: update api documentation
```

---

## 10. Phase 1 Task Order (Execution Sequence)

```
TASK 01  → Initialize repository and workspace
TASK 02  → Configure TypeScript, pnpm, linting, formatting, env
TASK 03  → Create Docker Compose PostgreSQL dev environment
TASK 04  → Configure Prisma and database connection
TASK 05  → Design and implement database schema
TASK 06  → Implement authentication
TASK 07  → Implement user/profile module
TASK 08  → Implement photo metadata and storage abstraction
TASK 09  → Implement preferences
TASK 10  → Implement discovery
TASK 11  → Implement like/pass
TASK 12  → Implement mutual matching
TASK 13  → Implement block/report
TASK 14  → Implement API documentation (Swagger)
TASK 15  → Implement integration tests
TASK 16  → Perform Phase 1 verification
```

---

## 11. Reporting Format (Per Task)

Setelah setiap task selesai, agent harus melaporkan:

```
TASK: [nomor task]
STATUS: [completed/failed/blocked]
CHANGES: [ringkasan perubahan files]
TESTS: [passed/failed - detail jika ada yg gagal]
NEXT TASK: [nomor task selanjutnya]
```

---

## PRODUCT RULES

These rules are **non-negotiable** and must be enforced at every layer (DB, API, Client):

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

## 12. Master Prompt Reference

File terpisah: `master-prompt.md` - digunakan sebagai prompt utama untuk AI agent.

---

## 13. Execution Order

```
MASTER PROMPT
      ↓
Agent inspect laptop
      ↓
TASK 01 → TASK 02 → ... → TASK 16
      ↓
PHASE 1 COMPLETE
      ↓
PHASE 2 PROMPT
      ↓
Android APK
      ↓
PHASE 2 COMPLETE
      ↓
PHASE 3 PROMPT
      ↓
Production + PWA
```

---

## 14. Critical Reminders

1. **JANGAN** beri ketiga phase sekaligus sebagai instruksi eksekusi
2. Master prompt boleh menjelaskan semuanya, tapi agent hanya diberi otorisasi phase aktif
3. Ini mengurangi risiko arsitektur berantakan
4. Setiap phase harus pass Definition of Done sebelum lanjut
5. Git checkpoint rutin untuk rollback safety