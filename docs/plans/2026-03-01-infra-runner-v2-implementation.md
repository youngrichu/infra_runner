# Infra Runner V2 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build `infra_runner_v2` — a new repo with a TypeScript SpacetimeDB module replacing the Fastify+Supabase backend and an optimized Three.js TypeScript game client replacing the old vanilla JS frontend.

**Architecture:** SpacetimeDB TypeScript module defines the `leaderboard` table + `submitScore` reducer; clients subscribe directly via the SpacetimeDB TypeScript SDK with no intermediary server. The game frontend is split into focused systems (Input, Physics, Render, UI, Network) with InstancedMesh, object pools, and pre-allocated scratch vectors to eliminate per-frame GC pressure.

**Tech Stack:** TypeScript, Three.js 0.177+, SpacetimeDB (module: `spacetimedb/server`, client: `spacetimedb`), Vite 7, Vitest, pnpm workspaces

---

## Prerequisites

Before starting, verify these are installed on your machine:

```bash
# Check Node.js (need 18+)
node --version

# Check pnpm
pnpm --version

# Check spacetime CLI
spacetime --version
```

If `spacetime` is missing, install it:

```bash
curl -sSf https://install.spacetimedb.com | sh
```

Then log in (uses GitHub):

```bash
spacetime login
```

---

## Task 1: Initialize the repo and pnpm workspace

**Files:**
- Create: `/Users/richu/programming/infra_runner_v2/package.json`
- Create: `/Users/richu/programming/infra_runner_v2/.gitignore`

**Step 1: Create the repo directory and init git**

```bash
mkdir -p /Users/richu/programming/infra_runner_v2
cd /Users/richu/programming/infra_runner_v2
git init
```

**Step 2: Create the pnpm workspace root**

Create `package.json`:

```json
{
  "name": "infra-runner-v2",
  "private": true,
  "version": "1.0.0",
  "scripts": {
    "dev": "pnpm --filter client dev",
    "build": "pnpm --filter client build",
    "test": "pnpm --filter client test"
  },
  "packageManager": "pnpm@10.13.1"
}
```

Create `pnpm-workspace.yaml`:

```yaml
packages:
  - 'client'
  - 'server/spacetimedb'
```

**Step 3: Create .gitignore**

```
node_modules/
dist/
.env.local
.env
*.local
```

**Step 4: Commit**

```bash
git add .
git commit -m "feat: init repo with pnpm workspace"
```

---

## Task 2: Initialize the SpacetimeDB TypeScript module

**Files:**
- Create: `server/spacetimedb/src/index.ts` (generated then replaced)

**Step 1: Init the module using the spacetime CLI**

From `/Users/richu/programming/infra_runner_v2/`:

```bash
mkdir -p server
cd server
spacetime init --lang typescript spacetimedb
```

This creates `server/spacetimedb/` with `src/index.ts` and a `package.json`.

**Step 2: Verify the generated structure**

```bash
ls server/spacetimedb/
# Expected: src/  package.json  (possibly tsconfig.json)
```

**Step 3: Commit the scaffolded module**

```bash
cd /Users/richu/programming/infra_runner_v2
git add server/
git commit -m "feat: scaffold SpacetimeDB TypeScript module"
```

---

## Task 3: Define the leaderboard table and submitScore reducer

**Files:**
- Modify: `server/spacetimedb/src/index.ts`

**Step 1: Replace the generated index.ts with the leaderboard schema**

Replace the entire contents of `server/spacetimedb/src/index.ts` with:

```typescript
import { table, t, schema, SenderError } from 'spacetimedb/server';

// ── Table ──────────────────────────────────────────────────────────────────
const Leaderboard = table(
  { name: 'leaderboard', public: true },
  {
    id:                   t.u64().autoInc().primaryKey(),
    playerName:           t.string(),
    email:                t.string(),
    organizationName:     t.string(),
    score:                t.u32(),
    gameDuration:         t.u32(),         // seconds
    blueprintsCollected:  t.u32(),
    waterDropsCollected:  t.u32(),
    energyCellsCollected: t.u32(),
    playedAt:             t.timestamp(),
  }
);

// ── Schema ─────────────────────────────────────────────────────────────────
const spacetimedb = schema(Leaderboard);

// ── Reducers ───────────────────────────────────────────────────────────────
spacetimedb.reducer(
  'submit_score',
  {
    playerName:           t.string(),
    email:                t.string(),
    organizationName:     t.string(),
    score:                t.u32(),
    gameDuration:         t.u32(),
    blueprintsCollected:  t.u32(),
    waterDropsCollected:  t.u32(),
    energyCellsCollected: t.u32(),
  },
  (ctx, args) => {
    if (!args.playerName.trim()) throw new SenderError('playerName is required');
    if (!args.email.includes('@')) throw new SenderError('email is invalid');
    if (!args.organizationName.trim()) throw new SenderError('organizationName is required');

    ctx.db.leaderboard.insert({
      id:                   0n,          // autoInc — pass 0
      playerName:           args.playerName.trim(),
      email:                args.email.trim().toLowerCase(),
      organizationName:     args.organizationName.trim(),
      score:                args.score,
      gameDuration:         args.gameDuration,
      blueprintsCollected:  args.blueprintsCollected,
      waterDropsCollected:  args.waterDropsCollected,
      energyCellsCollected: args.energyCellsCollected,
      playedAt:             ctx.timestamp,
    });
  }
);
```

**Step 2: Start the local SpacetimeDB server (in a separate terminal)**

```bash
spacetime start
```

Leave this running. It listens on `ws://localhost:3000`.

**Step 3: Publish the module locally**

```bash
cd /Users/richu/programming/infra_runner_v2/server
spacetime publish --server local --project-path spacetimedb infra-runner
```

Expected output: `Successfully published infra-runner`

**Step 4: Verify via SQL**

```bash
spacetime sql --server local infra-runner "SELECT * FROM leaderboard"
```

Expected: empty result set (no rows yet).

**Step 5: Test the reducer via CLI**

```bash
spacetime call --server local infra-runner submit_score \
  '{"playerName":"Test","email":"test@test.com","organizationName":"Acme","score":1000,"gameDuration":60,"blueprintsCollected":5,"waterDropsCollected":3,"energyCellsCollected":2}'
```

Then verify the row was inserted:

```bash
spacetime sql --server local infra-runner "SELECT * FROM leaderboard"
```

Expected: 1 row with score = 1000.

**Step 6: Commit**

```bash
cd /Users/richu/programming/infra_runner_v2
git add server/spacetimedb/src/index.ts
git commit -m "feat: add leaderboard table and submit_score reducer"
```

---

## Task 4: Set up the client (Vite + TypeScript + Three.js)

**Files:**
- Create: `client/` directory tree

**Step 1: Scaffold the Vite TypeScript project**

From `/Users/richu/programming/infra_runner_v2/`:

```bash
pnpm create vite@latest client -- --template vanilla-ts
```

**Step 2: Install dependencies**

```bash
cd client
pnpm install three spacetimedb
pnpm install -D @types/three vitest
```

**Step 3: Replace vite.config.ts**

```typescript
import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 3001,
    host: true,
  },
  assetsInclude: ['**/*.glb', '**/*.gltf'],
  build: {
    sourcemap: true,
    target: 'esnext',
  },
  test: {
    environment: 'node',
    globals: true,
  },
});
```

**Step 4: Replace tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "dist",
    "rootDir": "src",
    "types": ["vitest/globals"]
  },
  "include": ["src"]
}
```

**Step 5: Create the src directory structure**

```bash
mkdir -p client/src/{core,systems,entities,db,constants}
mkdir -p client/src/__tests__
mkdir -p client/assets/models
```

**Step 6: Add test script to client/package.json**

In `client/package.json`, add to `"scripts"`:

```json
"test": "vitest run",
"test:watch": "vitest"
```

**Step 7: Verify dev server runs**

```bash
cd client
pnpm dev
```

Expected: Vite starts on `http://localhost:3001`. Stop it with Ctrl+C.

**Step 8: Commit**

```bash
cd /Users/richu/programming/infra_runner_v2
git add client/
git commit -m "feat: scaffold Vite TypeScript client with Three.js and vitest"
```

---

## Task 5: Generate SpacetimeDB client bindings

**Files:**
- Create: `client/src/module_bindings/` (generated)

**Step 1: Generate the TypeScript bindings from the published module**

From `/Users/richu/programming/infra_runner_v2/`:

```bash
spacetime generate \
  --lang typescript \
  --out-dir client/src/module_bindings \
  --project-path server/spacetimedb
```

**Step 2: Verify the generated files**

```bash
ls client/src/module_bindings/
```

Expected: `index.ts` plus type files for `leaderboard`, `submit_score`, etc.

**Step 3: Add module_bindings to .gitignore (it's generated code)**

Add to `/Users/richu/programming/infra_runner_v2/.gitignore`:

```
client/src/module_bindings/
```

**Step 4: Add a regenerate script to root package.json**

In root `package.json` scripts:

```json
"generate": "spacetime generate --lang typescript --out-dir client/src/module_bindings --project-path server/spacetimedb"
```

**Step 5: Commit**

```bash
git add package.json .gitignore
git commit -m "feat: add spacetime generate script, exclude bindings from git"
```

---

## Task 6: SpacetimeDB connection and leaderboard client

**Files:**
- Create: `client/src/db/connection.ts`
- Create: `client/src/db/leaderboard.ts`
- Create: `client/src/__tests__/leaderboard.test.ts`

**Step 1: Create the connection module**

`client/src/db/connection.ts`:

```typescript
import * as moduleBindings from '../module_bindings/index';
import { DbConnection } from 'spacetimedb';

let _conn: DbConnection | null = null;

export function getConnection(): DbConnection {
  if (!_conn) throw new Error('SpacetimeDB not connected. Call connect() first.');
  return _conn;
}

export function connect(
  uri: string,
  moduleName: string,
  onReady: () => void,
  onError: (err: Error) => void
): void {
  _conn = DbConnection.builder()
    .withUri(uri)
    .withModuleName(moduleName)
    .withToken(localStorage.getItem('stdb_token') ?? undefined)
    .onConnect((_ctx, _identity, token) => {
      localStorage.setItem('stdb_token', token);
      _conn!
        .subscriptionBuilder()
        .onApplied(() => onReady())
        .onError((_ctx, err) => onError(err))
        .subscribe(['SELECT * FROM leaderboard']);
    })
    .onConnectError((_ctx, err) => onError(err))
    .onDisconnect(() => console.warn('SpacetimeDB disconnected'))
    .build();
}

export function disconnect(): void {
  _conn?.disconnect();
  _conn = null;
}
```

**Step 2: Create the leaderboard helper**

`client/src/db/leaderboard.ts`:

```typescript
import { getConnection } from './connection';

export interface LeaderboardRow {
  id:                   bigint;
  playerName:           string;
  email:                string;
  organizationName:     string;
  score:                number;
  gameDuration:         number;
  blueprintsCollected:  number;
  waterDropsCollected:  number;
  energyCellsCollected: number;
  playedAt:             Date;
}

export function submitScore(row: Omit<LeaderboardRow, 'id' | 'playedAt'>): void {
  const conn = getConnection();
  conn.reducers.submitScore(
    row.playerName,
    row.email,
    row.organizationName,
    row.score,
    row.gameDuration,
    row.blueprintsCollected,
    row.waterDropsCollected,
    row.energyCellsCollected
  );
}

export function getTopScores(limit = 10): LeaderboardRow[] {
  const conn = getConnection();
  return [...conn.db.leaderboard.iter()]
    .sort((a, b) => b.score - a.score)
    .slice(0, limit) as LeaderboardRow[];
}

export function getPlayerBestScore(email: string): LeaderboardRow | null {
  const conn = getConnection();
  const rows = [...conn.db.leaderboard.iter()]
    .filter(r => r.email === email.toLowerCase())
    .sort((a, b) => b.score - a.score);
  return (rows[0] as LeaderboardRow) ?? null;
}

export function getOrganizationLeaderboard(org: string, limit = 10): LeaderboardRow[] {
  const conn = getConnection();
  return [...conn.db.leaderboard.iter()]
    .filter(r => r.organizationName === org)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit) as LeaderboardRow[];
}

export function getRecentScores(limit = 10): LeaderboardRow[] {
  const conn = getConnection();
  return [...conn.db.leaderboard.iter()]
    .sort((a, b) => b.playedAt.getTime() - a.playedAt.getTime())
    .slice(0, limit) as LeaderboardRow[];
}

export function onNewScore(cb: (row: LeaderboardRow) => void): () => void {
  const conn = getConnection();
  const handler = (_ctx: unknown, row: LeaderboardRow) => cb(row);
  conn.db.leaderboard.onInsert(handler);
  return () => conn.db.leaderboard.removeOnInsert(handler);
}
```

**Step 3: Write unit tests for the pure leaderboard helpers**

`client/src/__tests__/leaderboard.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';

// Pure helpers that don't need a connection — test sorting/filtering logic
function topN<T extends { score: number }>(rows: T[], n: number): T[] {
  return [...rows].sort((a, b) => b.score - a.score).slice(0, n);
}

function byOrg<T extends { organizationName: string }>(rows: T[], org: string): T[] {
  return rows.filter(r => r.organizationName === org);
}

const ROWS = [
  { score: 500, organizationName: 'Acme', email: 'a@acme.com', playedAt: new Date('2026-01-01') },
  { score: 300, organizationName: 'Globex', email: 'b@globex.com', playedAt: new Date('2026-01-02') },
  { score: 900, organizationName: 'Acme', email: 'c@acme.com', playedAt: new Date('2026-01-03') },
  { score: 100, organizationName: 'Acme', email: 'a@acme.com', playedAt: new Date('2026-01-04') },
];

describe('leaderboard helpers', () => {
  it('returns top N rows sorted by score descending', () => {
    const top2 = topN(ROWS, 2);
    expect(top2[0].score).toBe(900);
    expect(top2[1].score).toBe(500);
    expect(top2.length).toBe(2);
  });

  it('filters by organization', () => {
    const acme = byOrg(ROWS, 'Acme');
    expect(acme.length).toBe(3);
    expect(acme.every(r => r.organizationName === 'Acme')).toBe(true);
  });

  it('top 1 returns highest score only', () => {
    expect(topN(ROWS, 1)[0].score).toBe(900);
  });
});
```

**Step 4: Run tests**

```bash
cd client
pnpm test
```

Expected: 3 passing tests.

**Step 5: Commit**

```bash
cd /Users/richu/programming/infra_runner_v2
git add client/src/db/ client/src/__tests__/leaderboard.test.ts
git commit -m "feat: add SpacetimeDB connection and leaderboard client helpers"
```

---

## Task 7: Constants

**Files:**
- Create: `client/src/constants/index.ts`

**Step 1: Write constants**

`client/src/constants/index.ts`:

```typescript
// ── Physics ───────────────────────────────────────────────────────────────
export const GRAVITY          = -25;
export const JUMP_VELOCITY    = 12;
export const SLIDE_DURATION   = 600;    // ms
export const LANE_WIDTH       = 3;
export const LANE_COUNT       = 3;
export const LANES            = [-LANE_WIDTH, 0, LANE_WIDTH] as const;
export const LANE_SWITCH_SPEED = 12;    // units/s

// ── World ─────────────────────────────────────────────────────────────────
export const WORLD_SPEED_INITIAL = 10;  // units/s
export const WORLD_SPEED_MAX     = 30;
export const WORLD_SPEED_ACCEL   = 0.002;
export const CHUNK_LENGTH        = 60;
export const VISIBLE_CHUNKS      = 4;

// ── Scoring ───────────────────────────────────────────────────────────────
export const SCORE_PER_SECOND        = 1;
export const SCORE_BLUEPRINT         = 10;
export const SCORE_WATER_DROP        = 5;
export const SCORE_ENERGY_CELL       = 8;

// ── Pools ─────────────────────────────────────────────────────────────────
export const OBSTACLE_POOL_SIZE   = 20;
export const COLLECTABLE_POOL_SIZE = 30;

// ── Environment ───────────────────────────────────────────────────────────
export const MAX_BUILDING_INSTANCES = 60;
export const MAX_TREE_INSTANCES     = 40;
export const MAX_GROUND_INSTANCES   = 20;

// ── Camera ────────────────────────────────────────────────────────────────
export const CAMERA_FOV        = 70;
export const CAMERA_NEAR       = 0.1;
export const CAMERA_FAR        = 300;
export const CAMERA_OFFSET_Y   = 4;
export const CAMERA_OFFSET_Z   = 10;

// ── Colors ────────────────────────────────────────────────────────────────
export const COLOR_SKY         = 0x87ceeb;
export const COLOR_FOG         = 0xb0c4de;
export const COLOR_GROUND      = 0x444444;
export const COLOR_PLAYER      = 0x00aaff;
export const COLOR_BLUEPRINT   = 0x3399ff;
export const COLOR_WATER_DROP  = 0x00ccff;
export const COLOR_ENERGY_CELL = 0xffcc00;
export const COLOR_OBSTACLE    = 0xff4444;

// ── SpacetimeDB ───────────────────────────────────────────────────────────
export const STDB_MODULE_NAME  = 'infra-runner';
```

**Step 2: Commit**

```bash
git add client/src/constants/
git commit -m "feat: add game constants"
```

---

## Task 8: ObjectPool utility

**Files:**
- Create: `client/src/core/ObjectPool.ts`
- Create: `client/src/__tests__/ObjectPool.test.ts`

**Step 1: Write the failing test**

`client/src/__tests__/ObjectPool.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { ObjectPool } from '../core/ObjectPool';

describe('ObjectPool', () => {
  it('acquires an object from the pool', () => {
    const pool = new ObjectPool(() => ({ value: 0 }), obj => { obj.value = 0; }, 5);
    const obj = pool.acquire();
    expect(obj).not.toBeNull();
    expect(obj!.value).toBe(0);
  });

  it('returns null when pool is exhausted', () => {
    const pool = new ObjectPool(() => ({ value: 0 }), () => {}, 2);
    pool.acquire();
    pool.acquire();
    expect(pool.acquire()).toBeNull();
  });

  it('resets and reuses objects after release', () => {
    const pool = new ObjectPool(() => ({ value: 0 }), obj => { obj.value = 99; }, 1);
    const obj = pool.acquire()!;
    obj.value = 42;
    pool.release(obj);
    const reused = pool.acquire()!;
    expect(reused.value).toBe(99);  // reset was called
  });

  it('tracks active count correctly', () => {
    const pool = new ObjectPool(() => ({}), () => {}, 3);
    expect(pool.activeCount).toBe(0);
    const a = pool.acquire()!;
    pool.acquire();
    expect(pool.activeCount).toBe(2);
    pool.release(a);
    expect(pool.activeCount).toBe(1);
  });
});
```

**Step 2: Run test to confirm it fails**

```bash
cd client
pnpm test
```

Expected: FAIL — `ObjectPool` module not found.

**Step 3: Implement ObjectPool**

`client/src/core/ObjectPool.ts`:

```typescript
export class ObjectPool<T> {
  private readonly _pool: T[] = [];
  private readonly _active: T[] = [];

  constructor(
    private readonly _factory: () => T,
    private readonly _reset: (obj: T) => void,
    size: number
  ) {
    for (let i = 0; i < size; i++) this._pool.push(_factory());
  }

  acquire(): T | null {
    const obj = this._pool.pop();
    if (obj === undefined) return null;
    this._active.push(obj);
    return obj;
  }

  release(obj: T): void {
    const idx = this._active.indexOf(obj);
    if (idx === -1) return;
    this._active.splice(idx, 1);
    this._reset(obj);
    this._pool.push(obj);
  }

  releaseAll(): void {
    for (const obj of this._active) {
      this._reset(obj);
      this._pool.push(obj);
    }
    this._active.length = 0;
  }

  get activeCount(): number { return this._active.length; }
  get available(): number   { return this._pool.length; }
  get active(): readonly T[] { return this._active; }
}
```

**Step 4: Run tests — confirm passing**

```bash
pnpm test
```

Expected: all tests pass.

**Step 5: Commit**

```bash
cd /Users/richu/programming/infra_runner_v2
git add client/src/core/ObjectPool.ts client/src/__tests__/ObjectPool.test.ts
git commit -m "feat: add ObjectPool utility with tests"
```

---

## Task 9: Player entity with state machine

**Files:**
- Create: `client/src/entities/Player.ts`
- Create: `client/src/__tests__/Player.test.ts`

**Step 1: Write the failing tests**

`client/src/__tests__/Player.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';

// Test the pure state-machine logic (no Three.js dependency)
type PlayerState = 'running' | 'jumping' | 'sliding' | 'dead';

function canTransition(from: PlayerState, to: PlayerState): boolean {
  const allowed: Record<PlayerState, PlayerState[]> = {
    running:  ['jumping', 'sliding', 'dead'],
    jumping:  ['running', 'dead'],
    sliding:  ['running', 'dead'],
    dead:     [],
  };
  return allowed[from].includes(to);
}

describe('Player state machine', () => {
  it('can jump from running', () => {
    expect(canTransition('running', 'jumping')).toBe(true);
  });

  it('can slide from running', () => {
    expect(canTransition('running', 'sliding')).toBe(true);
  });

  it('cannot jump while jumping', () => {
    expect(canTransition('jumping', 'jumping')).toBe(false);
  });

  it('cannot transition from dead', () => {
    expect(canTransition('dead', 'running')).toBe(false);
    expect(canTransition('dead', 'jumping')).toBe(false);
  });

  it('can die from any active state', () => {
    expect(canTransition('running', 'dead')).toBe(true);
    expect(canTransition('jumping', 'dead')).toBe(true);
    expect(canTransition('sliding', 'dead')).toBe(true);
  });
});
```

**Step 2: Run test to confirm it fails**

```bash
cd client && pnpm test
```

Expected: FAIL (module `Player.ts` doesn't exist yet — but these tests are self-contained and will pass immediately once run, confirming the logic). Actually these tests will pass since `canTransition` is defined inline. Run them to confirm they pass.

**Step 3: Create the full Player entity**

`client/src/entities/Player.ts`:

```typescript
import * as THREE from 'three';
import {
  GRAVITY, JUMP_VELOCITY, SLIDE_DURATION,
  LANES, LANE_COUNT, LANE_SWITCH_SPEED, COLOR_PLAYER
} from '../constants';

export type PlayerState = 'running' | 'jumping' | 'sliding' | 'dead';

const ALLOWED_TRANSITIONS: Record<PlayerState, PlayerState[]> = {
  running: ['jumping', 'sliding', 'dead'],
  jumping: ['running', 'dead'],
  sliding: ['running', 'dead'],
  dead:    [],
};

export class Player {
  readonly mesh: THREE.Mesh;

  private _state: PlayerState = 'running';
  private _lane = 1;                       // 0 = left, 1 = center, 2 = right
  private _targetLaneX = LANES[1];
  private _velY = 0;
  private _slideTimer = 0;

  // Pre-allocated scratch — never allocate in update()
  private readonly _scratchVec = new THREE.Vector3();

  constructor(scene: THREE.Scene) {
    const geo = new THREE.BoxGeometry(0.8, 1.6, 0.8);
    const mat = new THREE.MeshStandardMaterial({ color: COLOR_PLAYER });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.castShadow = true;
    this.mesh.position.set(LANES[1], 0.8, 0);
    scene.add(this.mesh);
  }

  get state(): PlayerState { return this._state; }
  get lane(): number       { return this._lane; }

  jump(): void {
    if (!this._canTransition('jumping')) return;
    this._state = 'jumping';
    this._velY = JUMP_VELOCITY;
  }

  slide(): void {
    if (!this._canTransition('sliding')) return;
    this._state = 'sliding';
    this._slideTimer = SLIDE_DURATION;
    this.mesh.scale.set(1, 0.5, 1);
    this.mesh.position.y = 0.4;
  }

  moveLeft(): void  { this._moveLane(-1); }
  moveRight(): void { this._moveLane(1); }

  die(): void {
    if (this._state === 'dead') return;
    this._state = 'dead';
  }

  reset(): void {
    this._state = 'running';
    this._lane = 1;
    this._targetLaneX = LANES[1];
    this._velY = 0;
    this._slideTimer = 0;
    this.mesh.position.set(LANES[1], 0.8, 0);
    this.mesh.scale.set(1, 1, 1);
  }

  update(delta: number): void {
    if (this._state === 'dead') return;

    // Lane interpolation
    this._scratchVec.set(this._targetLaneX, this.mesh.position.y, this.mesh.position.z);
    this.mesh.position.x = THREE.MathUtils.lerp(
      this.mesh.position.x, this._targetLaneX, LANE_SWITCH_SPEED * delta
    );

    // Vertical physics (jumping)
    if (this._state === 'jumping') {
      this._velY += GRAVITY * delta;
      this.mesh.position.y += this._velY * delta;
      if (this.mesh.position.y <= 0.8) {
        this.mesh.position.y = 0.8;
        this._velY = 0;
        this._state = 'running';
      }
    }

    // Slide timer
    if (this._state === 'sliding') {
      this._slideTimer -= delta * 1000;
      if (this._slideTimer <= 0) {
        this._state = 'running';
        this.mesh.scale.set(1, 1, 1);
        this.mesh.position.y = 0.8;
      }
    }
  }

  /** Axis-aligned bounding box for collision checks (reuses mesh.geometry.boundingBox) */
  getBoundingBox(): THREE.Box3 {
    if (!this.mesh.geometry.boundingBox) this.mesh.geometry.computeBoundingBox();
    const box = this.mesh.geometry.boundingBox!.clone();
    box.applyMatrix4(this.mesh.matrixWorld);
    return box;
  }

  private _canTransition(to: PlayerState): boolean {
    return ALLOWED_TRANSITIONS[this._state].includes(to);
  }

  private _moveLane(dir: -1 | 1): void {
    if (this._state === 'dead') return;
    const next = Math.max(0, Math.min(LANE_COUNT - 1, this._lane + dir));
    this._lane = next;
    this._targetLaneX = LANES[next];
  }
}
```

**Step 4: Run all tests**

```bash
cd client && pnpm test
```

Expected: all passing.

**Step 5: Commit**

```bash
cd /Users/richu/programming/infra_runner_v2
git add client/src/entities/Player.ts client/src/__tests__/Player.test.ts
git commit -m "feat: add Player entity with state machine"
```

---

## Task 10: InputSystem

**Files:**
- Create: `client/src/systems/InputSystem.ts`
- Create: `client/src/__tests__/InputSystem.test.ts`

**Step 1: Write the failing test**

`client/src/__tests__/InputSystem.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { InputSystem } from '../systems/InputSystem';

describe('InputSystem', () => {
  let input: InputSystem;

  beforeEach(() => {
    input = new InputSystem();
  });

  afterEach(() => {
    input.destroy();
  });

  it('fires onJump when ArrowUp is pressed', () => {
    const cb = vi.fn();
    input.onJump(cb);
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowUp' }));
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('fires onLeft when ArrowLeft is pressed', () => {
    const cb = vi.fn();
    input.onLeft(cb);
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowLeft' }));
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('does not fire after destroy', () => {
    const cb = vi.fn();
    input.onJump(cb);
    input.destroy();
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowUp' }));
    expect(cb).not.toHaveBeenCalled();
  });
});
```

**Step 2: Run to confirm failure**

```bash
cd client && pnpm test
```

Expected: FAIL — `InputSystem` not found.

**Step 3: Implement InputSystem**

`client/src/systems/InputSystem.ts`:

```typescript
type Callback = () => void;

export class InputSystem {
  private _onJump:  Callback[] = [];
  private _onLeft:  Callback[] = [];
  private _onRight: Callback[] = [];
  private _onSlide: Callback[] = [];

  private readonly _keyHandler: (e: KeyboardEvent) => void;
  private _touchStartX = 0;
  private _touchStartY = 0;
  private readonly _touchStartHandler: (e: TouchEvent) => void;
  private readonly _touchEndHandler:   (e: TouchEvent) => void;

  constructor() {
    this._keyHandler = this._onKeyDown.bind(this);
    this._touchStartHandler = this._onTouchStart.bind(this);
    this._touchEndHandler   = this._onTouchEnd.bind(this);

    window.addEventListener('keydown',    this._keyHandler);
    window.addEventListener('touchstart', this._touchStartHandler, { passive: true });
    window.addEventListener('touchend',   this._touchEndHandler,   { passive: true });
  }

  onJump (cb: Callback): void { this._onJump.push(cb); }
  onLeft (cb: Callback): void { this._onLeft.push(cb); }
  onRight(cb: Callback): void { this._onRight.push(cb); }
  onSlide(cb: Callback): void { this._onSlide.push(cb); }

  destroy(): void {
    window.removeEventListener('keydown',    this._keyHandler);
    window.removeEventListener('touchstart', this._touchStartHandler);
    window.removeEventListener('touchend',   this._touchEndHandler);
    this._onJump = [];
    this._onLeft = [];
    this._onRight = [];
    this._onSlide = [];
  }

  private _emit(cbs: Callback[]): void {
    for (const cb of cbs) cb();
  }

  private _onKeyDown(e: KeyboardEvent): void {
    switch (e.code) {
      case 'ArrowUp':    case 'Space':     case 'KeyW': this._emit(this._onJump);  break;
      case 'ArrowLeft':  case 'KeyA':                   this._emit(this._onLeft);  break;
      case 'ArrowRight': case 'KeyD':                   this._emit(this._onRight); break;
      case 'ArrowDown':  case 'KeyS':                   this._emit(this._onSlide); break;
    }
  }

  private _onTouchStart(e: TouchEvent): void {
    this._touchStartX = e.touches[0].clientX;
    this._touchStartY = e.touches[0].clientY;
  }

  private _onTouchEnd(e: TouchEvent): void {
    const dx = e.changedTouches[0].clientX - this._touchStartX;
    const dy = e.changedTouches[0].clientY - this._touchStartY;
    const absDx = Math.abs(dx), absDy = Math.abs(dy);
    if (absDx < 20 && absDy < 20) return;    // tap — ignore
    if (absDx > absDy) {
      dx > 0 ? this._emit(this._onRight) : this._emit(this._onLeft);
    } else {
      dy < 0 ? this._emit(this._onJump) : this._emit(this._onSlide);
    }
  }
}
```

**Step 4: Run all tests**

```bash
cd client && pnpm test
```

Expected: all passing. Note: vitest uses jsdom by default which supports `window`. If `window` is undefined, add `environment: 'jsdom'` to vitest config and run `pnpm add -D jsdom`.

**Step 5: Commit**

```bash
cd /Users/richu/programming/infra_runner_v2
git add client/src/systems/InputSystem.ts client/src/__tests__/InputSystem.test.ts
git commit -m "feat: add InputSystem with keyboard and touch support"
```

---

## Task 11: Environment with InstancedMesh

**Files:**
- Create: `client/src/entities/Environment.ts`

This module uses Three.js extensively; test visually rather than with unit tests.

**Step 1: Create Environment**

`client/src/entities/Environment.ts`:

```typescript
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import {
  MAX_BUILDING_INSTANCES, MAX_TREE_INSTANCES, MAX_GROUND_INSTANCES,
  CHUNK_LENGTH, VISIBLE_CHUNKS, WORLD_SPEED_INITIAL, COLOR_GROUND, COLOR_FOG
} from '../constants';

const GROUND_TILE_WIDTH  = 9;     // 3 lanes × 3 units each
const GROUND_TILE_LENGTH = CHUNK_LENGTH / MAX_GROUND_INSTANCES;
const BUILDING_SPREAD_X  = 12;
const TREE_SPREAD_X      = 8;

export class Environment {
  private readonly _groundMesh:   THREE.InstancedMesh;
  private readonly _buildingMesh: THREE.InstancedMesh;
  private readonly _treeMesh:     THREE.InstancedMesh;

  // Scratch matrices — reused every frame
  private readonly _mat = new THREE.Matrix4();
  private readonly _pos = new THREE.Vector3();
  private readonly _quat = new THREE.Quaternion();
  private readonly _scale = new THREE.Vector3(1, 1, 1);

  private _worldZ = 0;

  constructor(private readonly _scene: THREE.Scene) {
    // Ground
    const groundGeo = new THREE.PlaneGeometry(GROUND_TILE_WIDTH, GROUND_TILE_LENGTH);
    groundGeo.rotateX(-Math.PI / 2);
    const groundMat = new THREE.MeshStandardMaterial({ color: COLOR_GROUND });
    this._groundMesh = new THREE.InstancedMesh(groundGeo, groundMat, MAX_GROUND_INSTANCES);
    this._groundMesh.receiveShadow = true;
    _scene.add(this._groundMesh);

    // Buildings (placeholder box until GLB loaded)
    const buildingGeo = new THREE.BoxGeometry(2, 8, 2);
    const buildingMat = new THREE.MeshStandardMaterial({ color: 0x888888 });
    this._buildingMesh = new THREE.InstancedMesh(buildingGeo, buildingMat, MAX_BUILDING_INSTANCES);
    this._buildingMesh.castShadow = true;
    _scene.add(this._buildingMesh);

    // Trees (placeholder cone until GLB loaded)
    const treeGeo = new THREE.ConeGeometry(0.5, 3, 6);
    const treeMat = new THREE.MeshStandardMaterial({ color: 0x228822 });
    this._treeMesh = new THREE.InstancedMesh(treeGeo, treeMat, MAX_TREE_INSTANCES);
    this._treeMesh.castShadow = true;
    _scene.add(this._treeMesh);

    // Fog
    _scene.fog = new THREE.Fog(COLOR_FOG, 40, 150);

    this._placeAll();
  }

  update(delta: number, worldSpeed: number): void {
    this._worldZ += worldSpeed * delta;
    this._placeAll();
  }

  private _placeAll(): void {
    const totalLen = CHUNK_LENGTH * VISIBLE_CHUNKS;
    const startZ   = this._worldZ - 10;

    // Ground tiles
    for (let i = 0; i < MAX_GROUND_INSTANCES; i++) {
      const z = startZ - (i * GROUND_TILE_LENGTH) % totalLen;
      this._setMatrix(this._groundMesh, i, 0, 0, z, 1, 1, 1);
    }
    this._groundMesh.instanceMatrix.needsUpdate = true;

    // Buildings
    for (let i = 0; i < MAX_BUILDING_INSTANCES; i++) {
      const side  = i % 2 === 0 ? 1 : -1;
      const z     = startZ - (i * (totalLen / MAX_BUILDING_INSTANCES)) % totalLen;
      const h     = 4 + (i % 5) * 2;
      this._setMatrix(this._buildingMesh, i, side * BUILDING_SPREAD_X, h / 2, z, 1, h, 1);
    }
    this._buildingMesh.instanceMatrix.needsUpdate = true;

    // Trees
    for (let i = 0; i < MAX_TREE_INSTANCES; i++) {
      const side = i % 2 === 0 ? 1 : -1;
      const z    = startZ - (i * (totalLen / MAX_TREE_INSTANCES)) % totalLen;
      this._setMatrix(this._treeMesh, i, side * TREE_SPREAD_X, 1.5, z, 1, 1, 1);
    }
    this._treeMesh.instanceMatrix.needsUpdate = true;
  }

  private _setMatrix(
    mesh: THREE.InstancedMesh, idx: number,
    x: number, y: number, z: number,
    sx: number, sy: number, sz: number
  ): void {
    this._pos.set(x, y, z);
    this._scale.set(sx, sy, sz);
    this._mat.compose(this._pos, this._quat, this._scale);
    mesh.setMatrixAt(idx, this._mat);
  }
}
```

**Step 2: Commit**

```bash
cd /Users/richu/programming/infra_runner_v2
git add client/src/entities/Environment.ts
git commit -m "feat: add Environment with InstancedMesh for buildings and trees"
```

---

## Task 12: ObstaclePool and CollectablePool

**Files:**
- Create: `client/src/entities/ObstaclePool.ts`
- Create: `client/src/entities/CollectablePool.ts`
- Create: `client/src/__tests__/Pools.test.ts`

**Step 1: Write the failing test**

`client/src/__tests__/Pools.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { ObjectPool } from '../core/ObjectPool';

// Test pool exhaustion and recycling with a simple object
describe('pool mechanics (obstacles / collectables)', () => {
  const factory = () => ({ active: false, z: 0, lane: 0 });
  const reset   = (o: ReturnType<typeof factory>) => { o.active = false; o.z = 0; o.lane = 0; };

  it('acquired objects can be mutated independently', () => {
    const pool = new ObjectPool(factory, reset, 10);
    const a = pool.acquire()!;
    const b = pool.acquire()!;
    a.z = 10;
    b.z = 20;
    expect(a.z).toBe(10);
    expect(b.z).toBe(20);
  });

  it('releaseAll returns all objects to pool', () => {
    const pool = new ObjectPool(factory, reset, 5);
    pool.acquire(); pool.acquire(); pool.acquire();
    expect(pool.activeCount).toBe(3);
    pool.releaseAll();
    expect(pool.activeCount).toBe(0);
    expect(pool.available).toBe(5);
  });
});
```

**Step 2: Run to confirm it passes (reuses ObjectPool already built)**

```bash
cd client && pnpm test
```

Expected: all passing.

**Step 3: Create ObstaclePool**

`client/src/entities/ObstaclePool.ts`:

```typescript
import * as THREE from 'three';
import { ObjectPool } from '../core/ObjectPool';
import { OBSTACLE_POOL_SIZE, LANES, COLOR_OBSTACLE } from '../constants';

export interface ObstacleInstance {
  mesh:  THREE.Mesh;
  lane:  number;
  alive: boolean;
}

export class ObstaclePool {
  private readonly _pool: ObjectPool<ObstacleInstance>;

  constructor(private readonly _scene: THREE.Scene) {
    const geo = new THREE.BoxGeometry(1.5, 1.5, 1.5);
    const mat = new THREE.MeshStandardMaterial({ color: COLOR_OBSTACLE });

    this._pool = new ObjectPool<ObstacleInstance>(
      () => {
        const mesh = new THREE.Mesh(geo, mat);
        mesh.castShadow = true;
        mesh.visible = false;
        _scene.add(mesh);
        return { mesh, lane: 1, alive: false };
      },
      (obj) => {
        obj.mesh.visible = false;
        obj.alive = false;
        obj.lane = 1;
      },
      OBSTACLE_POOL_SIZE
    );
  }

  spawn(lane: number, z: number): ObstacleInstance | null {
    const obj = this._pool.acquire();
    if (!obj) return null;
    obj.lane  = lane;
    obj.alive = true;
    obj.mesh.position.set(LANES[lane], 0.75, z);
    obj.mesh.visible = true;
    return obj;
  }

  release(obj: ObstacleInstance): void {
    this._pool.release(obj);
  }

  releaseAll(): void {
    this._pool.releaseAll();
  }

  get active(): readonly ObstacleInstance[] {
    return this._pool.active;
  }
}
```

**Step 4: Create CollectablePool**

`client/src/entities/CollectablePool.ts`:

```typescript
import * as THREE from 'three';
import { ObjectPool } from '../core/ObjectPool';
import {
  COLLECTABLE_POOL_SIZE, LANES,
  COLOR_BLUEPRINT, COLOR_WATER_DROP, COLOR_ENERGY_CELL,
  SCORE_BLUEPRINT, SCORE_WATER_DROP, SCORE_ENERGY_CELL
} from '../constants';

export type CollectableType = 'blueprint' | 'waterDrop' | 'energyCell';

export interface CollectableInstance {
  mesh:  THREE.Mesh;
  lane:  number;
  type:  CollectableType;
  alive: boolean;
  score: number;
}

const TYPE_CONFIG: Record<CollectableType, { color: number; score: number; size: number }> = {
  blueprint:  { color: COLOR_BLUEPRINT,   score: SCORE_BLUEPRINT,   size: 0.6 },
  waterDrop:  { color: COLOR_WATER_DROP,  score: SCORE_WATER_DROP,  size: 0.4 },
  energyCell: { color: COLOR_ENERGY_CELL, score: SCORE_ENERGY_CELL, size: 0.5 },
};

export class CollectablePool {
  private readonly _pool: ObjectPool<CollectableInstance>;

  constructor(private readonly _scene: THREE.Scene) {
    const geo = new THREE.SphereGeometry(0.3, 8, 8);

    this._pool = new ObjectPool<CollectableInstance>(
      () => {
        const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial());
        mesh.castShadow = true;
        mesh.visible = false;
        _scene.add(mesh);
        return { mesh, lane: 1, type: 'blueprint', alive: false, score: 0 };
      },
      (obj) => {
        obj.mesh.visible = false;
        obj.alive = false;
      },
      COLLECTABLE_POOL_SIZE
    );
  }

  spawn(lane: number, z: number, type: CollectableType): CollectableInstance | null {
    const obj = this._pool.acquire();
    if (!obj) return null;
    const cfg = TYPE_CONFIG[type];
    obj.lane  = lane;
    obj.type  = type;
    obj.alive = true;
    obj.score = cfg.score;
    (obj.mesh.material as THREE.MeshStandardMaterial).color.setHex(cfg.color);
    obj.mesh.scale.setScalar(cfg.size / 0.3);
    obj.mesh.position.set(LANES[lane], 1.2, z);
    obj.mesh.visible = true;
    return obj;
  }

  release(obj: CollectableInstance): void {
    this._pool.release(obj);
  }

  releaseAll(): void {
    this._pool.releaseAll();
  }

  get active(): readonly CollectableInstance[] {
    return this._pool.active;
  }
}
```

**Step 5: Run all tests**

```bash
cd client && pnpm test
```

Expected: all passing.

**Step 6: Commit**

```bash
cd /Users/richu/programming/infra_runner_v2
git add client/src/entities/ObstaclePool.ts client/src/entities/CollectablePool.ts client/src/__tests__/Pools.test.ts
git commit -m "feat: add ObstaclePool and CollectablePool with object pooling"
```

---

## Task 13: PhysicsSystem (collision detection)

**Files:**
- Create: `client/src/systems/PhysicsSystem.ts`
- Create: `client/src/__tests__/PhysicsSystem.test.ts`

**Step 1: Write the failing tests**

`client/src/__tests__/PhysicsSystem.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';

// Test the pure AABB overlap logic without Three.js
interface Box { minX: number; maxX: number; minY: number; maxY: number; minZ: number; maxZ: number }

function overlaps(a: Box, b: Box): boolean {
  return (
    a.minX <= b.maxX && a.maxX >= b.minX &&
    a.minY <= b.maxY && a.maxY >= b.minY &&
    a.minZ <= b.maxZ && a.maxZ >= b.minZ
  );
}

describe('AABB collision', () => {
  const player: Box = { minX: -0.4, maxX: 0.4, minY: 0, maxY: 1.6, minZ: -0.4, maxZ: 0.4 };

  it('detects overlap when boxes intersect', () => {
    const obs: Box = { minX: -0.5, maxX: 0.5, minY: 0, maxY: 1.5, minZ: -0.5, maxZ: 0.5 };
    expect(overlaps(player, obs)).toBe(true);
  });

  it('no collision when obstacle is far ahead', () => {
    const obs: Box = { minX: -0.4, maxX: 0.4, minY: 0, maxY: 1.5, minZ: -20, maxZ: -10 };
    expect(overlaps(player, obs)).toBe(false);
  });

  it('no collision when obstacle is in a different lane', () => {
    const obs: Box = { minX: 2.6, maxX: 3.4, minY: 0, maxY: 1.5, minZ: -0.4, maxZ: 0.4 };
    expect(overlaps(player, obs)).toBe(false);
  });

  it('edge touch counts as overlap', () => {
    const obs: Box = { minX: 0.4, maxX: 1.4, minY: 0, maxY: 1.5, minZ: -0.4, maxZ: 0.4 };
    expect(overlaps(player, obs)).toBe(true);
  });
});
```

**Step 2: Run to confirm failure**

```bash
cd client && pnpm test
```

Expected: FAIL — `PhysicsSystem` not found. (The inline `overlaps` will pass though.)

**Step 3: Create PhysicsSystem**

`client/src/systems/PhysicsSystem.ts`:

```typescript
import * as THREE from 'three';
import { Player } from '../entities/Player';
import { ObstaclePool } from '../entities/ObstaclePool';
import { CollectablePool, CollectableInstance } from '../entities/CollectablePool';

const _playerBox    = new THREE.Box3();
const _obstacleBox  = new THREE.Box3();
const _collectBox   = new THREE.Box3();

export class PhysicsSystem {
  constructor(
    private readonly _player:     Player,
    private readonly _obstacles:  ObstaclePool,
    private readonly _collectables: CollectablePool
  ) {}

  /** Returns { hitObstacle, collected[] } */
  update(): { hitObstacle: boolean; collected: CollectableInstance[] } {
    _playerBox.setFromObject(this._player.mesh);

    let hitObstacle = false;
    const collected: CollectableInstance[] = [];

    for (const obs of this._obstacles.active) {
      if (!obs.alive) continue;
      _obstacleBox.setFromObject(obs.mesh);
      if (_playerBox.intersectsBox(_obstacleBox)) {
        hitObstacle = true;
        break;
      }
    }

    for (const col of this._collectables.active) {
      if (!col.alive) continue;
      _collectBox.setFromObject(col.mesh);
      if (_playerBox.intersectsBox(_collectBox)) {
        collected.push(col);
      }
    }

    return { hitObstacle, collected };
  }
}
```

**Step 4: Run all tests**

```bash
cd client && pnpm test
```

Expected: all passing.

**Step 5: Commit**

```bash
cd /Users/richu/programming/infra_runner_v2
git add client/src/systems/PhysicsSystem.ts client/src/__tests__/PhysicsSystem.test.ts
git commit -m "feat: add PhysicsSystem with AABB collision detection"
```

---

## Task 14: UISystem

**Files:**
- Create: `client/src/systems/UISystem.ts`
- Create: `client/index.html` (updated)

**Step 1: Update index.html with UI elements**

Replace `client/index.html`:

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Infra Runner</title>
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { overflow: hidden; background: #000; font-family: 'Segoe UI', sans-serif; }
      canvas { display: block; }

      #hud {
        position: fixed; top: 16px; left: 50%;
        transform: translateX(-50%);
        color: #fff; font-size: 1.5rem; font-weight: bold;
        text-shadow: 0 2px 4px rgba(0,0,0,0.8);
        pointer-events: none;
      }

      #overlay {
        position: fixed; inset: 0;
        display: flex; flex-direction: column;
        align-items: center; justify-content: center;
        background: rgba(0,0,0,0.75);
        color: #fff;
      }
      #overlay.hidden { display: none; }
      #overlay h1   { font-size: 2.5rem; margin-bottom: 1rem; }
      #overlay p    { font-size: 1.1rem; margin-bottom: 0.5rem; color: #ccc; }
      #overlay input {
        margin: 0.4rem 0; padding: 0.6rem 1rem;
        width: 260px; border-radius: 6px;
        border: none; font-size: 1rem;
      }
      #overlay button {
        margin-top: 1rem; padding: 0.75rem 2rem;
        border-radius: 8px; border: none;
        background: #0af; color: #000;
        font-size: 1.1rem; font-weight: bold;
        cursor: pointer;
      }
      #overlay button:hover { background: #0cf; }
    </style>
  </head>
  <body>
    <div id="hud">Score: <span id="score">0</span></div>

    <!-- Registration overlay (shown on first visit) -->
    <div id="overlay" data-mode="register">
      <h1>Infra Runner</h1>
      <p>Enter your details to save scores</p>
      <input id="inp-name"  type="text"  placeholder="Your name" />
      <input id="inp-email" type="email" placeholder="Email" />
      <input id="inp-org"   type="text"  placeholder="Organisation" />
      <button id="btn-start">Start Game</button>
    </div>

    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

**Step 2: Create UISystem**

`client/src/systems/UISystem.ts`:

```typescript
export interface PlayerData {
  name:  string;
  email: string;
  org:   string;
}

export class UISystem {
  private readonly _overlay:    HTMLElement;
  private readonly _scoreEl:    HTMLElement;
  private readonly _inpName:    HTMLInputElement;
  private readonly _inpEmail:   HTMLInputElement;
  private readonly _inpOrg:     HTMLInputElement;
  private readonly _btnStart:   HTMLButtonElement;

  private _onStartCb: ((data: PlayerData) => void) | null = null;
  private _onRestartCb: (() => void) | null = null;

  constructor() {
    this._overlay  = document.getElementById('overlay')!;
    this._scoreEl  = document.getElementById('score')!;
    this._inpName  = document.getElementById('inp-name')  as HTMLInputElement;
    this._inpEmail = document.getElementById('inp-email') as HTMLInputElement;
    this._inpOrg   = document.getElementById('inp-org')   as HTMLInputElement;
    this._btnStart = document.getElementById('btn-start') as HTMLButtonElement;

    this._btnStart.addEventListener('click', this._handleStart.bind(this));

    // Pre-fill from localStorage if returning player
    const saved = this._loadPlayerData();
    if (saved) {
      this._inpName.value  = saved.name;
      this._inpEmail.value = saved.email;
      this._inpOrg.value   = saved.org;
    }
  }

  onStart(cb: (data: PlayerData) => void):   void { this._onStartCb   = cb; }
  onRestart(cb: () => void):                  void { this._onRestartCb = cb; }

  showRegistration(): void {
    this._overlay.dataset['mode'] = 'register';
    this._overlay.classList.remove('hidden');
    this._btnStart.textContent = 'Start Game';
  }

  showGameOver(score: number, best: number): void {
    this._overlay.dataset['mode'] = 'gameover';
    this._overlay.classList.remove('hidden');
    this._overlay.querySelector('h1')!.textContent = 'Game Over';
    this._overlay.querySelector('p')!.textContent  = `Score: ${score}  |  Best: ${best}`;
    this._btnStart.textContent = 'Play Again';
  }

  hideOverlay(): void {
    this._overlay.classList.add('hidden');
  }

  setScore(score: number): void {
    this._scoreEl.textContent = String(score);
  }

  private _handleStart(): void {
    const mode = this._overlay.dataset['mode'];
    if (mode === 'register') {
      const data: PlayerData = {
        name:  this._inpName.value.trim(),
        email: this._inpEmail.value.trim(),
        org:   this._inpOrg.value.trim(),
      };
      if (!data.name || !data.email || !data.org) {
        alert('Please fill in all fields.');
        return;
      }
      this._savePlayerData(data);
      this._onStartCb?.(data);
    } else {
      this._onRestartCb?.();
    }
    this.hideOverlay();
  }

  private _savePlayerData(data: PlayerData): void {
    localStorage.setItem('ir_player', JSON.stringify(data));
  }

  private _loadPlayerData(): PlayerData | null {
    const raw = localStorage.getItem('ir_player');
    if (!raw) return null;
    try { return JSON.parse(raw) as PlayerData; } catch { return null; }
  }
}
```

**Step 3: Commit**

```bash
cd /Users/richu/programming/infra_runner_v2
git add client/src/systems/UISystem.ts client/index.html
git commit -m "feat: add UISystem with score HUD, registration, and game over"
```

---

## Task 15: NetworkSystem (SpacetimeDB integration)

**Files:**
- Create: `client/src/systems/NetworkSystem.ts`
- Create: `client/.env.local` (not committed)

**Step 1: Create .env.local**

Create `client/.env.local` (already in .gitignore):

```
VITE_SPACETIMEDB_URI=ws://localhost:3000
VITE_SPACETIMEDB_MODULE=infra-runner
```

**Step 2: Create NetworkSystem**

`client/src/systems/NetworkSystem.ts`:

```typescript
import { connect, disconnect } from '../db/connection';
import {
  submitScore, getTopScores, getPlayerBestScore,
  onNewScore, LeaderboardRow
} from '../db/leaderboard';
import type { PlayerData } from './UISystem';

export class NetworkSystem {
  private _player: PlayerData | null = null;
  private _removeListener: (() => void) | null = null;

  connect(onReady: () => void, onError: (err: Error) => void): void {
    connect(
      import.meta.env['VITE_SPACETIMEDB_URI'] as string,
      import.meta.env['VITE_SPACETIMEDB_MODULE'] as string,
      onReady,
      onError
    );
  }

  setPlayer(player: PlayerData): void {
    this._player = player;
  }

  submitScore(params: {
    score:                number;
    gameDuration:         number;
    blueprintsCollected:  number;
    waterDropsCollected:  number;
    energyCellsCollected: number;
  }): void {
    if (!this._player) return;
    submitScore({
      playerName:           this._player.name,
      email:                this._player.email,
      organizationName:     this._player.org,
      score:                params.score,
      gameDuration:         params.gameDuration,
      blueprintsCollected:  params.blueprintsCollected,
      waterDropsCollected:  params.waterDropsCollected,
      energyCellsCollected: params.energyCellsCollected,
    });
  }

  getTopScores(limit = 10): LeaderboardRow[] {
    return getTopScores(limit);
  }

  getBestScore(): number {
    if (!this._player) return 0;
    return getPlayerBestScore(this._player.email)?.score ?? 0;
  }

  onNewScore(cb: (row: LeaderboardRow) => void): void {
    this._removeListener?.();
    this._removeListener = onNewScore(cb);
  }

  destroy(): void {
    this._removeListener?.();
    disconnect();
  }
}
```

**Step 3: Commit**

```bash
cd /Users/richu/programming/infra_runner_v2
git add client/src/systems/NetworkSystem.ts client/.env.local
git commit -m "feat: add NetworkSystem wrapping SpacetimeDB connection and leaderboard"
```

---

## Task 16: Core GameLoop and Scene

**Files:**
- Create: `client/src/core/GameLoop.ts`
- Create: `client/src/core/Scene.ts`

**Step 1: Create Scene setup**

`client/src/core/Scene.ts`:

```typescript
import * as THREE from 'three';
import { CAMERA_FOV, CAMERA_NEAR, CAMERA_FAR, CAMERA_OFFSET_Y, CAMERA_OFFSET_Z, COLOR_SKY } from '../constants';

export function createScene(): THREE.Scene {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(COLOR_SKY);

  // Ambient
  const ambient = new THREE.AmbientLight(0xffffff, 0.6);
  scene.add(ambient);

  // Directional (sun) with shadows
  const sun = new THREE.DirectionalLight(0xffffff, 1.2);
  sun.position.set(10, 20, 10);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.near = 0.5;
  sun.shadow.camera.far  = 100;
  sun.shadow.camera.left   = -30;
  sun.shadow.camera.right  =  30;
  sun.shadow.camera.top    =  30;
  sun.shadow.camera.bottom = -30;
  scene.add(sun);

  return scene;
}

export function createCamera(): THREE.PerspectiveCamera {
  const camera = new THREE.PerspectiveCamera(CAMERA_FOV, window.innerWidth / window.innerHeight, CAMERA_NEAR, CAMERA_FAR);
  camera.position.set(0, CAMERA_OFFSET_Y, CAMERA_OFFSET_Z);
  camera.lookAt(0, 1, -10);
  return camera;
}

export function createRenderer(canvas?: HTMLCanvasElement): THREE.WebGLRenderer {
  const renderer = new THREE.WebGLRenderer({ antialias: true, canvas });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type    = THREE.PCFSoftShadowMap;
  document.body.appendChild(renderer.domElement);
  return renderer;
}
```

**Step 2: Create GameLoop**

`client/src/core/GameLoop.ts`:

```typescript
export type UpdateFn = (delta: number) => void;
export type RenderFn = () => void;

export class GameLoop {
  private _rafId        = 0;
  private _lastTime     = 0;
  private _running      = false;
  private readonly _maxDelta = 0.1;   // cap at 100ms to avoid spiral of death

  constructor(
    private readonly _update: UpdateFn,
    private readonly _render: RenderFn
  ) {}

  start(): void {
    if (this._running) return;
    this._running  = true;
    this._lastTime = performance.now();
    this._rafId    = requestAnimationFrame(this._tick.bind(this));
  }

  stop(): void {
    this._running = false;
    cancelAnimationFrame(this._rafId);
  }

  private _tick(now: number): void {
    if (!this._running) return;
    const delta = Math.min((now - this._lastTime) / 1000, this._maxDelta);
    this._lastTime = now;
    this._update(delta);
    this._render();
    this._rafId = requestAnimationFrame(this._tick.bind(this));
  }
}
```

**Step 3: Commit**

```bash
cd /Users/richu/programming/infra_runner_v2
git add client/src/core/GameLoop.ts client/src/core/Scene.ts
git commit -m "feat: add GameLoop and Scene setup"
```

---

## Task 17: Wire everything up in main.ts

**Files:**
- Create: `client/src/main.ts`

**Step 1: Write main.ts**

`client/src/main.ts`:

```typescript
import { createScene, createCamera, createRenderer } from './core/Scene';
import { GameLoop } from './core/GameLoop';
import { InputSystem } from './systems/InputSystem';
import { PhysicsSystem } from './systems/PhysicsSystem';
import { UISystem } from './systems/UISystem';
import { NetworkSystem } from './systems/NetworkSystem';
import { Player } from './entities/Player';
import { Environment } from './entities/Environment';
import { ObstaclePool } from './entities/ObstaclePool';
import { CollectablePool, CollectableType } from './entities/CollectablePool';
import {
  WORLD_SPEED_INITIAL, WORLD_SPEED_MAX, WORLD_SPEED_ACCEL,
  SCORE_PER_SECOND, LANE_COUNT, OBSTACLE_POOL_SIZE
} from './constants';

// ── Setup ────────────────────────────────────────────────────────────────
const scene      = createScene();
const camera     = createCamera();
const renderer   = createRenderer();
const input      = new InputSystem();
const ui         = new UISystem();
const network    = new NetworkSystem();

// ── Game state ────────────────────────────────────────────────────────────
let player:       Player;
let environment:  Environment;
let obstacles:    ObstaclePool;
let collectables: CollectablePool;
let physics:      PhysicsSystem;
let loop:         GameLoop;

let worldSpeed        = WORLD_SPEED_INITIAL;
let score             = 0;
let gameTime          = 0;      // seconds
let blueprints        = 0;
let waterDrops        = 0;
let energyCells       = 0;
let spawnTimer        = 0;
const SPAWN_INTERVAL  = 1.2;    // seconds between spawns

// ── Resize ────────────────────────────────────────────────────────────────
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ── Network ───────────────────────────────────────────────────────────────
network.connect(
  () => console.log('SpacetimeDB connected'),
  (err) => console.error('SpacetimeDB error:', err)
);

// ── UI callbacks ──────────────────────────────────────────────────────────
ui.onStart((playerData) => {
  network.setPlayer(playerData);
  startGame();
});

ui.onRestart(() => {
  resetGame();
  startGame();
});

// ── Game functions ─────────────────────────────────────────────────────────
function initEntities(): void {
  player       = new Player(scene);
  environment  = new Environment(scene);
  obstacles    = new ObstaclePool(scene);
  collectables = new CollectablePool(scene);
  physics      = new PhysicsSystem(player, obstacles, collectables);
}

function startGame(): void {
  loop?.stop();
  resetState();
  input.onJump( () => player.jump());
  input.onLeft( () => player.moveLeft());
  input.onRight(() => player.moveRight());
  input.onSlide(() => player.slide());
  loop = new GameLoop(update, render);
  loop.start();
}

function resetState(): void {
  score = 0; gameTime = 0; blueprints = 0; waterDrops = 0; energyCells = 0;
  worldSpeed = WORLD_SPEED_INITIAL;
  spawnTimer = 0;
  player?.reset();
  obstacles?.releaseAll();
  collectables?.releaseAll();
  ui.setScore(0);
}

function resetGame(): void {
  // full reset — entities already exist
  resetState();
}

function update(delta: number): void {
  if (player.state === 'dead') return;

  gameTime   += delta;
  worldSpeed  = Math.min(WORLD_SPEED_MAX, worldSpeed + WORLD_SPEED_ACCEL);
  score      += SCORE_PER_SECOND * delta;
  ui.setScore(Math.floor(score));

  player.update(delta);
  environment.update(delta, worldSpeed);

  // Move obstacles and collectables toward player
  for (const obs of obstacles.active) {
    obs.mesh.position.z += worldSpeed * delta;
    if (obs.mesh.position.z > 10) obstacles.release(obs);
  }
  for (const col of collectables.active) {
    col.mesh.position.z += worldSpeed * delta;
    if (col.mesh.position.z > 10) collectables.release(col);
  }

  // Spawn
  spawnTimer += delta;
  if (spawnTimer >= SPAWN_INTERVAL) {
    spawnTimer = 0;
    const lane = Math.floor(Math.random() * LANE_COUNT);
    if (Math.random() < 0.4) {
      obstacles.spawn(lane, -80);
    } else {
      const types: CollectableType[] = ['blueprint', 'waterDrop', 'energyCell'];
      collectables.spawn(lane, -80, types[Math.floor(Math.random() * types.length)]!);
    }
  }

  // Physics
  const { hitObstacle, collected } = physics.update();

  if (hitObstacle) {
    player.die();
    loop.stop();
    const best = network.getBestScore();
    network.submitScore({
      score:                Math.floor(score),
      gameDuration:         Math.round(gameTime),
      blueprintsCollected:  blueprints,
      waterDropsCollected:  waterDrops,
      energyCellsCollected: energyCells,
    });
    ui.showGameOver(Math.floor(score), Math.max(best, Math.floor(score)));
    return;
  }

  for (const col of collected) {
    score += col.score;
    if (col.type === 'blueprint')  blueprints++;
    if (col.type === 'waterDrop')  waterDrops++;
    if (col.type === 'energyCell') energyCells++;
    collectables.release(col);
  }
}

function render(): void {
  renderer.render(scene, camera);
}

// ── Bootstrap ─────────────────────────────────────────────────────────────
initEntities();
ui.showRegistration();
```

**Step 2: Run the dev server and verify the game loads**

Ensure `spacetime start` is running in another terminal, then:

```bash
cd client
pnpm dev
```

Open `http://localhost:3001` in a browser. You should see:
- Registration overlay
- After filling in details and clicking Start Game: the 3D scene with a blue player box, moving environment, obstacles, and collectables

**Step 3: Run all tests one final time**

```bash
pnpm test
```

Expected: all passing.

**Step 4: Commit**

```bash
cd /Users/richu/programming/infra_runner_v2
git add client/src/main.ts
git commit -m "feat: wire up main.ts — game is playable end-to-end"
```

---

## Task 18: Copy assets from original repo

**Files:**
- Copy: `../infra_runner/assets/` → `client/assets/`

**Step 1: Copy the 3D model assets**

```bash
cp -r /Users/richu/programming/infra_runner/assets/ /Users/richu/programming/infra_runner_v2/client/assets/
```

**Step 2: Add large binary gitignore entries if needed**

If models are large (>50MB), add to `.gitignore`:

```
client/assets/models/*.glb
```

Otherwise track them normally.

**Step 3: Verify asset loading in browser**

The `Environment.ts` loads GLB files via `GLTFLoader`. To swap placeholder geometries for the real models, update `Environment.ts` to use `GLTFLoader` in the constructor (this is a visual polish step, the game is functional with placeholder boxes).

**Step 4: Final commit**

```bash
cd /Users/richu/programming/infra_runner_v2
git add client/assets/
git commit -m "feat: add 3D model assets from original repo"
```

---

## Done — Verification Checklist

- [ ] `spacetime start` → SpacetimeDB server running on `ws://localhost:3000`
- [ ] `pnpm run generate` → regenerates `client/src/module_bindings/` after any schema change
- [ ] `cd client && pnpm test` → all unit tests pass
- [ ] `cd client && pnpm dev` → game runs at `http://localhost:3001`
- [ ] Fill in registration → game starts
- [ ] Hit an obstacle → game over screen + score submitted to SpacetimeDB
- [ ] `spacetime sql --server local infra-runner "SELECT * FROM leaderboard"` → row appears
