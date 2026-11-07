# VYBE

Physical-attraction-first dating platform.

## Structure

```
vybe/
├── apps/
│   ├── api/          # Fastify backend (Phase 1)
│   ├── mobile/       # Expo React Native (Phase 2)
│   └── web/          # Next.js PWA (Phase 3)
├── packages/
│   ├── database/     # Prisma schema & client
│   ├── shared/       # Types, Zod schemas, constants
│   └── config/       # Shared configs (ESLint, TSConfig)
├── docs/
├── docker-compose.yml
├── package.json
├── pnpm-workspace.yaml
└── README.md
```

## Getting Started

### Prerequisites
- Node.js 20+
- pnpm 8.10+
- Docker & Docker Compose

### Install Dependencies
```bash
pnpm install
```

### Start Development Database
```bash
docker-compose up -d
```

### Generate Prisma Client
```bash
pnpm db:generate
```

### Run Migrations
```bash
pnpm db:migrate
```

### Start API Server
```bash
pnpm dev:api
```

API will be available at `http://localhost:3000`
Swagger docs at `http://localhost:3000/docs`

## Development Phases

- **Phase 1**: Backend Foundation (API, Auth, Profiles, Photos, Preferences, Discovery, Matching, Safety)
- **Phase 2**: Android MVP (Expo React Native)
- **Phase 3**: Production + PWA

## Tech Stack

- **Backend**: Node.js, TypeScript, Fastify, PostgreSQL, Prisma, Zod, JWT, Argon2id
- **Mobile**: React Native, Expo, TypeScript, Expo Router, TanStack Query, Zustand
- **Web**: Next.js, TypeScript, PWA
- **Infrastructure**: Docker Compose, PostgreSQL, Redis, Cloudflare R2

---

## Bahasa Indonesia

**VYBE** adalah platform kencan yang mengutamakan ketertarikan fisik sebagai titik awal perkenalan.

Repositori ini berisi aplikasi Node.js dengan struktur `apps/` dan Prisma sebagai lapisan basis data.

---

## License

Private
