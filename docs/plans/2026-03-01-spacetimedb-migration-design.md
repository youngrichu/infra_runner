# SpacetimeDB Migration Design

**Date:** 2026-03-01
**Status:** Approved
**Scope:** New repo (`infra_runner_v2`) — full rewrite with SpacetimeDB, TypeScript, and optimized Three.js architecture

---

## Background

The current stack consists of two repos:
- `infra_runner` — Three.js game (vanilla JS, Vite), talks to a REST API + Socket.IO
- `infra_runner_leaderboard-api` — Fastify + Supabase (PostgreSQL) backend, Socket.IO for real-time

The migration replaces both with a single new repo. SpacetimeDB acts as database, server runtime, and real-time transport — eliminating the need for a separate backend server.

Data migration: **none** — starting with an empty leaderboard.

---

## Approach: Full Replacement (Approach A)

- New repo: `infra_runner_v2`
- SpacetimeDB TypeScript module handles tables + reducers (replaces Fastify + Supabase)
- Frontend connects directly via SpacetimeDB TypeScript SDK (replaces `api-client.js` + Socket.IO)
- Real-time leaderboard updates via SpacetimeDB table subscriptions (no Socket.IO)
- `infra_runner_leaderboard-api` is retired

---

## Repo Structure

```
infra_runner_v2/
├── server/                          # SpacetimeDB TypeScript module
│   └── spacetimedb/
│       ├── src/
│       │   └── index.ts             # Tables + reducers
│       └── package.json
│
├── client/                          # Three.js game (TypeScript + Vite)
│   ├── src/
│   │   ├── core/
│   │   │   ├── GameLoop.ts          # requestAnimationFrame, delta time, update/render dispatch
│   │   │   └── Scene.ts             # Three.js scene, camera, renderer setup
│   │   ├── systems/
│   │   │   ├── InputSystem.ts       # Keyboard, touch, gamepad — emits events
│   │   │   ├── PhysicsSystem.ts     # Collision detection, lane logic
│   │   │   ├── RenderSystem.ts      # Lighting, post-processing, shadow config
│   │   │   ├── UISystem.ts          # Score HUD, game over screen, registration modal
│   │   │   └── NetworkSystem.ts     # SpacetimeDB SDK wrapper, leaderboard sync
│   │   ├── entities/
│   │   │   ├── Player.ts            # State machine: running / jumping / sliding / dead
│   │   │   ├── Environment.ts       # InstancedMesh for buildings, trees, ground tiles
│   │   │   ├── ObstaclePool.ts      # Object pool — pre-allocate meshes, never new in loop
│   │   │   └── CollectablePool.ts   # Same pattern for collectables
│   │   ├── db/
│   │   │   ├── connection.ts        # DbConnection setup, token persistence
│   │   │   └── leaderboard.ts       # Typed reducer calls + table subscription handlers
│   │   ├── constants/
│   │   │   └── index.ts             # Physics, scoring, colors, spawn config
│   │   └── main.ts                  # Entry point
│   ├── assets/
│   │   └── models/                  # .glb files (copied from current repo)
│   ├── index.html
│   ├── vite.config.ts
│   ├── tsconfig.json
│   └── package.json
│
├── package.json                     # pnpm workspace root
└── README.md
```

---

## SpacetimeDB Module

### Table

```typescript
import { table, t } from 'spacetimedb/server';

const Leaderboard = table(
  { name: 'leaderboard', public: true },
  {
    id:                   t.u64().autoInc().primaryKey(),
    playerName:           t.string(),
    email:                t.string(),
    organizationName:     t.string(),
    score:                t.u32(),
    gameDuration:         t.u32(),        // seconds
    blueprintsCollected:  t.u32(),
    waterDropsCollected:  t.u32(),
    energyCellsCollected: t.u32(),
    playedAt:             t.timestamp(),
  }
);
```

### Reducers

| Reducer | Arguments | Description |
|---------|-----------|-------------|
| `submitScore` | playerName, email, org, score, duration, blueprints, waterDrops, energyCells | Insert a new score row |
| `getTopScores` | limit: u32 | — (client reads via subscription) |
| `getPlayerBestScore` | email: string | — (client filters local cache) |
| `getOrganizationLeaderboard` | org: string, limit: u32 | — (client filters local cache) |
| `getRecentScores` | limit: u32 | — (client sorts local cache by playedAt) |

> Note: Read operations (top scores, player best, org leaderboard, recent, statistics) are handled entirely client-side by filtering/sorting the local table cache — no server round-trip needed. Only `submitScore` is a reducer.

---

## Frontend: SpacetimeDB Client Integration

### Connection setup (`db/connection.ts`)

```typescript
import * as moduleBindings from '../module_bindings';
import { DbConnection } from 'spacetimedb';

export function createConnection(): DbConnection {
  return DbConnection.builder()
    .withUri(import.meta.env.VITE_SPACETIMEDB_URI)
    .withModuleName(import.meta.env.VITE_SPACETIMEDB_MODULE)
    .withToken(localStorage.getItem('stdb_token') || undefined)
    .onConnect((ctx, identity, token) => {
      localStorage.setItem('stdb_token', token);
    })
    .onConnectError((_ctx, err) => console.error('SpacetimeDB connection error:', err))
    .build();
}
```

### Leaderboard sync (`db/leaderboard.ts`)

```typescript
// Subscribe to full leaderboard table
connection.subscriptionBuilder()
  .onApplied(() => { /* initial data ready */ })
  .subscribe(['SELECT * FROM leaderboard']);

// Real-time inserts
connection.db.leaderboard.onInsert((_ctx, row) => {
  // update UI with new score
});

// Submit a score
connection.reducers.submitScore(
  playerName, email, org, score, duration,
  blueprints, waterDrops, energyCells
);

// Read top N from local cache (no network call)
const top10 = [...connection.db.leaderboard.iter()]
  .sort((a, b) => b.score - a.score)
  .slice(0, 10);
```

---

## Performance Optimizations

### Rendering

| Technique | Applied To | Benefit |
|-----------|-----------|---------|
| `InstancedMesh` | Buildings, trees, ground tiles | Single draw call per geometry type |
| Object pools | Obstacles, collectables | Zero GC pressure in game loop |
| Pre-allocated scratch objects | `Vector3`, `Matrix4`, `Quaternion` | No per-frame heap allocation |
| Frustum culling | All pooled objects | Skip invisible geometry |
| LOD (`THREE.LOD`) | Distant buildings | Reduced polygon count |
| Shadow map size tuning | Directional light | Balance quality vs cost |

### Code Architecture

| Current Problem | Solution |
|----------------|----------|
| `ui.js` 1610 lines | `UISystem.ts` split into focused sub-components |
| `player.js` 1203 lines | `Player.ts` as explicit state machine |
| `collectables.js` 1338 lines | `CollectablePool.ts` with pooling logic |
| `direct-model-environment.js` 817 lines | `Environment.ts` with InstancedMesh |
| Hardcoded backend URLs | `.env` with `VITE_SPACETIMEDB_URI` |
| Mixed concerns in game loop | Discrete systems updated by `GameLoop.ts` |

### TypeScript Benefits

- SpacetimeDB CLI generates fully typed `module_bindings/` from the server module
- `@types/three` ships with Three.js — full autocomplete and type safety
- Compile-time errors catch mismatched reducer arguments before runtime

---

## Environment Variables

```env
# client/.env.local
VITE_SPACETIMEDB_URI=ws://localhost:3000       # local dev
VITE_SPACETIMEDB_MODULE=infra-runner           # module name
```

---

## What Gets Retired

- `infra_runner_leaderboard-api` — entire repo (Fastify + Supabase + Socket.IO)
- `infra_runner/leaderboard.js` — replaced by `db/leaderboard.ts`
- `infra_runner/api-client.js` — replaced by SpacetimeDB SDK
- `infra_runner/player-registration.js` — rebuilt as `UISystem` sub-component in TS

---

## Out of Scope

- Data migration (starting fresh)
- Authentication / user accounts
- CI/CD pipeline setup
- Deployment configuration (SpacetimeDB Cloud vs self-hosted)
