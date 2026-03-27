# TypeScript Scripting Examples

## 1) Scene Script Example

File:
- `source/scripts/scenes/Level1/scene.ts`

```ts
export function onSceneLoaded(runtimeScene: gdjs.RuntimeScene): void {
  console.log('Scene loaded:', runtimeScene.getName());
}

export function onScenePreEvents(runtimeScene: gdjs.RuntimeScene): void {
  // Example: read shared project object lists
  const players = sceneObjects.Player || [];
  if (players.length > 0) {
    const hero = players[0];
    hero.setX(hero.getX() + 0.1);
  }
}

export function onScenePostEvents(runtimeScene: gdjs.RuntimeScene): void {
  void runtimeScene;
}
```

## 2) Object Script Example

File:
- `source/scripts/scenes/Level1/objects/Enemy.ts`

```ts
export function onObjectCreated(
  runtimeScene: gdjs.RuntimeScene,
  owner: gdjs.RuntimeObject
): void {
  console.log('Enemy instance created in', runtimeScene.getName(), owner);
}

export function onObjectPreEvents(
  runtimeScene: gdjs.RuntimeScene,
  objects: gdjs.RuntimeObject[]
): void {
  for (const enemy of objects) {
    enemy.rotate(1);
  }
  void runtimeScene;
}

export function onObjectDestroyed(
  runtimeScene: gdjs.RuntimeScene,
  owner: gdjs.RuntimeObject
): void {
  console.log('Enemy removed:', owner.getName(), 'from', runtimeScene.getName());
}
```

## 3) Behavior Script Example

File:
- `source/scripts/scenes/Level1/behaviors/Enemy.Patrol.ts`

```ts
export function onBehaviorCreated(
  runtimeScene: gdjs.RuntimeScene,
  owner: gdjs.RuntimeObject,
  behavior: gdjs.RuntimeBehavior
): void {
  console.log('Behavior created:', owner.getName(), behavior);
  void runtimeScene;
}

export function onBehaviorActivate(
  runtimeScene: gdjs.RuntimeScene,
  owner: gdjs.RuntimeObject,
  behavior: gdjs.RuntimeBehavior
): void {
  console.log('Behavior activated:', owner.getName(), behavior);
  void runtimeScene;
}

export function doStepPreEvents(
  runtimeScene: gdjs.RuntimeScene,
  owner: gdjs.RuntimeObject,
  behavior: gdjs.RuntimeBehavior
): void {
  // Move owner in a simple patrol pattern
  const time = runtimeScene.getTimeManager().getTimeFromStartInSeconds();
  owner.setX(owner.getX() + Math.sin(time) * 0.5);
  void behavior;
}
```

## 4) Registering a Custom Project Behavior

File:
- `source/scripts/game/behaviors/my-behavior.ts`

```ts
class EnemyDashBehavior extends gdjs.RuntimeBehavior {
  doStepPreEvents(runtimeScene: gdjs.RuntimeScene): void {
    const owner = this.owner;
    owner.setX(owner.getX() + 2);
    void runtimeScene;
  }
}

registerProjectBehavior('TypeScriptBehaviors::EnemyDashBehavior', EnemyDashBehavior);
```

After registration:
- The behavior type is discovered by the editor scanner.
- It appears in the Behavior picker through the TypeScript behavior extension.

## 5) Shared Utilities + Imports Example

File:
- `source/scripts/shared/math.ts`

```ts
export const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));
```

File:
- `source/scripts/scenes/Level1/scene.ts`

```ts
import { clamp } from '../../shared/math';

export function onScenePreEvents(runtimeScene: gdjs.RuntimeScene): void {
  const players = sceneObjects.Player || [];
  for (const player of players) {
    player.setX(clamp(player.getX(), 0, 1920));
  }
  void runtimeScene;
}
```

## 6) Runtime External Module Injection

```ts
// inject once
if ((globalThis as any).myService) {
  tsModules.setExternal('myService', (globalThis as any).myService);
}

// consume in another module
const myService = require('myService');
myService.log('Hello from TypeScript modules');
```

## 7) Quick Runtime Tests

```ts
gdjs.ts.clearTests();

gdjs.ts.test('Math sanity', () => {
  if (1 + 1 !== 2) throw new Error('Broken arithmetic');
});

const report = gdjs.ts.runTests();
console.log(report);
```

## 8) Typo Auto-Fix Behavior

If Monaco diagnostic says:
- `Cannot find name 'runtmeScene'. Did you mean 'runtimeScene'?`

The editor can auto-fix to:
- `runtimeScene`

Auto-fix is conservative and only applies near-miss identifiers.

## 9) Practical Checklist Before Shipping

1. Keep script names stable (avoid unnecessary path renames).
2. Resolve all diagnostics in the Script panel.
3. Use `first` include position only for bootstrap/foundation scripts.
4. Keep behavior type IDs under `TypeScriptBehaviors::...`.
5. Prefer lifecycle hooks over manual polling glue code.
