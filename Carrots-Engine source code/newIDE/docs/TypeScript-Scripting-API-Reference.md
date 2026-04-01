# TypeScript Scripting API Reference

## 1) Script Context Kinds

Each script is associated with one context:
- `project`
- `scene`
- `object`
- `behavior`

Context metadata fields:
- `contextKind`
- `sceneName`
- `objectName`
- `behaviorName`

Runtime helper in editor typings:

```ts
declare const scriptContext: {
  kind: 'project' | 'scene' | 'object' | 'behavior';
  sceneName: string;
  objectName: string;
  behaviorName: string;
};
```

## 2) Global Runtime Helpers

### 2.1 `tsModules`

```ts
declare const tsModules: {
  setExternal(moduleName: string, moduleValue: any): void;
  evalJavaScript(code: string): any;
  registerTest(testName: string, testFunction: () => void): void;
  runTests(): {
    total: number;
    passed: number;
    failed: number;
    failures: Array<{ name: string; message: string }>;
  };
  clearTests(): void;
};
```

### 2.2 Global helpers

```ts
declare function registerProjectBehavior(
  behaviorType: string,
  behaviorConstructor: typeof gdjs.RuntimeBehavior
): void;

declare function liveRepl(code: string): any;
```

### 2.3 `gdjs.ts` namespace

```ts
declare namespace gdjs {
  namespace ts {
    function setExternalModule(moduleName: string, moduleValue: any): void;
    function registerProjectBehavior(
      behaviorType: string,
      behaviorConstructor: typeof gdjs.RuntimeBehavior
    ): void;
    function evalJavaScript(code: string): any;
    function test(testName: string, testFunction: () => void): void;
    function runTests(): {
      total: number;
      passed: number;
      failed: number;
      failures: Array<{ name: string; message: string }>;
    };
    function clearTests(): void;
  }
}
```

## 3) Project-Typed Globals Injected in Editor

```ts
declare const sceneObjects: __GDevelopProjectObjectLists;
declare const scene: gdjs.RuntimeScene & __GDevelopProjectObjectLists;
declare const evtTools: typeof gdjs.evtTools;
```

Generated object typing:
- One property per known project object name, mapped to `gdjs.RuntimeObject[]`.

Generated behavior typing:
- One property per known behavior name.
- Type inferred from runtime behavior registration mapping when available.

RuntimeObject behavior typing override:

```ts
interface RuntimeObject {
  getBehavior<Name extends keyof __GDevelopProjectBehaviorByName>(
    name: Name
  ): __GDevelopProjectBehaviorByName[Name];
}
```

## 4) Lifecycle Hook APIs

## 4.1 Scene scripts

Primary hook names:

```ts
export function onSceneLoaded(runtimeScene: gdjs.RuntimeScene): void;
export function onScenePreEvents(runtimeScene: gdjs.RuntimeScene): void;
export function onScenePostEvents(runtimeScene: gdjs.RuntimeScene): void;
export function onSceneUnloading(runtimeScene: gdjs.RuntimeScene): void;
export function onSceneUnloaded(runtimeScene: gdjs.RuntimeScene): void;
```

Legacy aliases accepted:
- `onSceneStart`, `onReady`, `on<SceneName>SceneStart`
- `onSceneUpdate`, `_process`
- `onSceneLateUpdate`, `_lateProcess`
- `onSceneDispose`, `onDispose`

## 4.2 Object scripts

Primary hook names:

```ts
export function onObjectCreated(
  runtimeScene: gdjs.RuntimeScene,
  owner: gdjs.RuntimeObject
): void;

export function onObjectPreEvents(
  runtimeScene: gdjs.RuntimeScene,
  objects: gdjs.RuntimeObject[]
): void;

export function onObjectPostEvents(
  runtimeScene: gdjs.RuntimeScene,
  objects: gdjs.RuntimeObject[]
): void;

export function onObjectDestroyed(
  runtimeScene: gdjs.RuntimeScene,
  owner: gdjs.RuntimeObject
): void;
```

Legacy aliases accepted:
- `onCreated`
- `onObjectUpdate`, `updateObject`, `update<ObjectName>Object`
- `onObjectLateUpdate`
- `onDestroy`

## 4.3 Behavior scripts

Primary hook names:

```ts
export function onBehaviorCreated(
  runtimeScene: gdjs.RuntimeScene,
  owner: gdjs.RuntimeObject,
  behavior: gdjs.RuntimeBehavior
): void;

export function onBehaviorActivate(
  runtimeScene: gdjs.RuntimeScene,
  owner: gdjs.RuntimeObject,
  behavior: gdjs.RuntimeBehavior
): void;

export function onBehaviorDeActivate(
  runtimeScene: gdjs.RuntimeScene,
  owner: gdjs.RuntimeObject,
  behavior: gdjs.RuntimeBehavior
): void;

export function doStepPreEvents(
  runtimeScene: gdjs.RuntimeScene,
  owner: gdjs.RuntimeObject,
  behavior: gdjs.RuntimeBehavior
): void;

export function doStepPostEvents(
  runtimeScene: gdjs.RuntimeScene,
  owner: gdjs.RuntimeObject,
  behavior: gdjs.RuntimeBehavior
): void;

export function onBehaviorDestroy(
  runtimeScene: gdjs.RuntimeScene,
  owner: gdjs.RuntimeObject,
  behavior: gdjs.RuntimeBehavior
): void;
```

Legacy aliases accepted:
- `onCreated`
- `onActivate`
- `onBehaviorDeactivate`, `onDeActivate`, `onDeactivate`
- `onBehaviorPreEvents`, `onBehaviorUpdate`, `update<ObjectName><BehaviorName>Behavior`
- `onBehaviorPostEvents`, `onBehaviorLateUpdate`
- `onDestroy`

## 5) Include Order API

Each script supports:
- `includePosition: 'first' | 'last'`

Meaning:
- `first`: loaded before regular game includes.
- `last`: loaded after the first group.

Use `first` for foundational modules and shared setup.

## 6) Behavior Registration Contract

Use type prefix:
- `TypeScriptBehaviors::`

Example type ID:
- `TypeScriptBehaviors::EnemyDashBehavior`

If the prefix is missing, the behavior will not be picked up by the project behavior registry scanner.

## 7) Error Handling Guarantees

- Lifecycle calls are wrapped in safe-call guards; runtime exceptions are logged, then execution continues.
- Missing modules produce explicit module resolution errors.
- Typo auto-fix is conservative and does not apply unsafe replacements.

## 8) Internal File Generation (Export)

Generated module runtime files:
- `project-ts-modules-runtime.js`
- `project-ts-modules-definitions.js`
- `project-ts-modules-bootstrap-first.js` (when needed)
- `project-ts-modules-bootstrap-last.js` (when needed)
- `project-ts-modules-lifecycle.js`
