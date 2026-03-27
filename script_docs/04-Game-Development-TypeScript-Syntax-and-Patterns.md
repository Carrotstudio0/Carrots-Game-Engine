# Game Development TypeScript Syntax and Patterns

## 1) Purpose

This document focuses on the TypeScript syntax and patterns you actually use in game development.
It is not a generic language manual. It is a production-oriented reference for gameplay code.

## 2) Core TypeScript Syntax You Will Use Daily

## 2.1 Variables and constants

```ts
const maxHealth: number = 100;
let currentHealth: number = 100;
let playerName = 'Hero'; // inferred string
```

Rule of thumb:
- Use `const` by default.
- Use `let` only when value changes.

## 2.2 Primitive and literal types

```ts
let lives: number = 3;
let isAlive: boolean = true;
let stageName: string = 'Forest';

type WeaponType = 'sword' | 'bow' | 'staff';
let weapon: WeaponType = 'sword';
```

Literal unions are perfect for finite gameplay states.

## 2.3 Arrays, tuples, and records

```ts
const damageHistory: number[] = [10, 12, 7];
const spawnPoint: [number, number] = [320, 180];
const cooldownBySkill: Record<string, number> = {
  dash: 1.25,
  fireball: 3.0,
};
```

## 2.4 Type aliases and interfaces

```ts
type Stats = {
  hp: number;
  atk: number;
  def: number;
};

interface InventoryItem {
  id: string;
  name: string;
  stack: number;
}
```

Use:
- `type` for unions/composition.
- `interface` for object contracts you extend.

## 2.5 Functions (optional, default, rest)

```ts
function applyDamage(amount: number, armor = 0): number {
  return Math.max(0, amount - armor);
}

function logTags(message: string, ...tags: string[]): void {
  console.log(message, tags.join(','));
}

function spawnEnemy(type: 'grunt' | 'boss', x?: number, y?: number): void {
  const spawnX = x ?? 0;
  const spawnY = y ?? 0;
  void type;
  void spawnX;
  void spawnY;
}
```

## 2.6 Union and intersection types

```ts
type DamageSource = 'melee' | 'ranged' | 'magic';

type WithId = { id: string };
type WithPosition = { x: number; y: number };
type Entity = WithId & WithPosition;
```

## 2.7 Generics

```ts
function first<T>(items: T[]): T | null {
  return items.length ? items[0] : null;
}

const firstEnemy = first<gdjs.RuntimeObject>(sceneObjects.Enemy || []);
```

Use generics for reusable helpers without losing type safety.

## 2.8 Classes and inheritance

```ts
class HealthModel {
  private _current: number;

  constructor(private readonly _max: number) {
    this._current = _max;
  }

  public hit(amount: number): void {
    this._current = Math.max(0, this._current - amount);
  }

  public get current(): number {
    return this._current;
  }
}
```

For runtime behaviors:

```ts
class EnemyDashBehavior extends gdjs.RuntimeBehavior {
  doStepPreEvents(runtimeScene: gdjs.RuntimeScene): void {
    this.owner.setX(this.owner.getX() + 2);
    void runtimeScene;
  }
}

registerProjectBehavior('TypeScriptBehaviors::EnemyDashBehavior', EnemyDashBehavior);
```

## 2.9 Enums vs literal unions

```ts
enum AiState {
  Idle = 'Idle',
  Chase = 'Chase',
  Attack = 'Attack',
}

let aiState: AiState = AiState.Idle;
```

Prefer literal unions when you do not need enum runtime object behavior.

## 2.10 Narrowing and type guards

```ts
function isAliveObject(obj: gdjs.RuntimeObject | null): obj is gdjs.RuntimeObject {
  return !!obj;
}

const maybePlayer = (sceneObjects.Player || [])[0] || null;
if (isAliveObject(maybePlayer)) {
  maybePlayer.setAngle(0);
}
```

## 2.11 Optional chaining and nullish coalescing

```ts
const player = sceneObjects.Player?.[0] ?? null;
const speed = (player as any)?.speed ?? 0;
void speed;
```

## 2.12 Async/await and promises

```ts
async function preloadGameData(): Promise<void> {
  const response = await fetch('/data/levels.json');
  const data = await response.json();
  console.log(data);
}
```

Use async for external I/O, web calls, dynamic config loading, analytics.

## 2.13 Error handling

```ts
function safeParse(jsonText: string): unknown {
  try {
    return JSON.parse(jsonText);
  } catch (error) {
    console.error('Invalid JSON', error);
    return null;
  }
}
```

## 2.14 Modules (import/export)

```ts
// math.ts
export const clamp = (v: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, v));

// usage
import { clamp } from '../../shared/math';
```

## 3) Script Runtime API Syntax (Project Integration)

## 3.1 Lifecycle hooks

Scene hooks:

```ts
export function onSceneLoaded(runtimeScene: gdjs.RuntimeScene): void {}
export function onScenePreEvents(runtimeScene: gdjs.RuntimeScene): void {}
export function onScenePostEvents(runtimeScene: gdjs.RuntimeScene): void {}
export function onSceneUnloading(runtimeScene: gdjs.RuntimeScene): void {}
export function onSceneUnloaded(runtimeScene: gdjs.RuntimeScene): void {}
```

Object hooks:

```ts
export function onObjectCreated(runtimeScene: gdjs.RuntimeScene, owner: gdjs.RuntimeObject): void {}
export function onObjectPreEvents(runtimeScene: gdjs.RuntimeScene, objects: gdjs.RuntimeObject[]): void {}
export function onObjectPostEvents(runtimeScene: gdjs.RuntimeScene, objects: gdjs.RuntimeObject[]): void {}
export function onObjectDestroyed(runtimeScene: gdjs.RuntimeScene, owner: gdjs.RuntimeObject): void {}
```

Behavior hooks:

```ts
export function onBehaviorCreated(runtimeScene: gdjs.RuntimeScene, owner: gdjs.RuntimeObject, behavior: gdjs.RuntimeBehavior): void {}
export function onBehaviorActivate(runtimeScene: gdjs.RuntimeScene, owner: gdjs.RuntimeObject, behavior: gdjs.RuntimeBehavior): void {}
export function onBehaviorDeActivate(runtimeScene: gdjs.RuntimeScene, owner: gdjs.RuntimeObject, behavior: gdjs.RuntimeBehavior): void {}
export function doStepPreEvents(runtimeScene: gdjs.RuntimeScene, owner: gdjs.RuntimeObject, behavior: gdjs.RuntimeBehavior): void {}
export function doStepPostEvents(runtimeScene: gdjs.RuntimeScene, owner: gdjs.RuntimeObject, behavior: gdjs.RuntimeBehavior): void {}
export function onBehaviorDestroy(runtimeScene: gdjs.RuntimeScene, owner: gdjs.RuntimeObject, behavior: gdjs.RuntimeBehavior): void {}
```

## 3.2 Helpers

```ts
tsModules.setExternal('service', { log: console.log });
const service = require('service');
service.log('ok');

gdjs.ts.test('HP should not go negative', () => {
  if (Math.max(0, -1) !== 0) throw new Error('failed');
});

const report = gdjs.ts.runTests();
console.log(report);
```

## 4) Production Patterns for Gameplay Code

## 4.1 State machine pattern

```ts
type PlayerState = 'idle' | 'run' | 'jump' | 'attack';

class PlayerStateMachine {
  private state: PlayerState = 'idle';

  setState(next: PlayerState): void {
    if (next === this.state) return;
    this.state = next;
  }

  getState(): PlayerState {
    return this.state;
  }
}
```

## 4.2 Cooldown pattern

```ts
class Cooldown {
  private remaining = 0;

  tick(dt: number): void {
    this.remaining = Math.max(0, this.remaining - dt);
  }

  trigger(seconds: number): void {
    this.remaining = seconds;
  }

  ready(): boolean {
    return this.remaining <= 0;
  }
}
```

## 4.3 Object pooling pattern

```ts
class Pool<T> {
  private free: T[] = [];
  constructor(private readonly factory: () => T) {}

  acquire(): T {
    return this.free.pop() ?? this.factory();
  }

  release(item: T): void {
    this.free.push(item);
  }
}
```

## 4.4 Data-driven tuning pattern

```ts
type EnemyConfig = {
  moveSpeed: number;
  hp: number;
  detectionRadius: number;
};

const enemyConfig: EnemyConfig = {
  moveSpeed: 120,
  hp: 50,
  detectionRadius: 220,
};
```

## 5) Practical Rules for Stable Large Projects

1. Keep each file responsible for one system.
2. Use strict naming for hooks and modules.
3. Prefer pure utility functions for reusable logic.
4. Avoid giant all-in-one script files.
5. Add micro-tests with `gdjs.ts.test` for critical math and rules.
6. Use TypeScript types as contracts between systems.
7. Keep Events for designer-friendly orchestration when needed.

## 6) What This Gives You

With this syntax + pattern set, you can build production-grade systems with:
- Better maintainability than pure visual logic in large projects.
- Better refactor safety with static checks.
- Better reuse through modules and typed APIs.
