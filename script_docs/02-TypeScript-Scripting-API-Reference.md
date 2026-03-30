# TypeScript Scripting API Reference

## 1) Context and Injected Globals

```ts
declare const sceneObjects: { [name: string]: gdjs.RuntimeObject[] };
declare const scene: gdjs.RuntimeScene & { [name: string]: gdjs.RuntimeObject[] };
declare const evtTools: typeof gdjs.evtTools;
```

## 2) `tsModules` (Primary Bridge API)

```ts
declare const tsModules: {
  // External module interop
  setExternal(moduleName: string, moduleValue: any): void;
  setExternalAlias(moduleName: string, globalPath: string): void;
  hasExternal(moduleName: string): boolean;
  getExternal(moduleName: string): any;
  requireExternal(moduleName: string): any;
  importExternal(moduleName: string): Promise<any>;
  resolveGlobal(globalPath: string): any;
  bindDefaultExternals(): void;

  // Script module access
  listModuleIds(): string[];
  require(moduleName: string): any;
  callExport(moduleId: string, exportName?: string, ...args: any[]): any;

  // Shared state
  hasSharedState(key: string): boolean;
  setSharedState(key: string, value: any): void;
  getSharedState(key: string, defaultValue?: any): any;
  deleteSharedState(key: string): boolean;
  patchSharedState(key: string, patchValue: any): any;
  clearSharedState(): void;
  listSharedStateKeys(): string[];

  // Event bus
  on(
    eventName: string,
    listener: (payload?: any, metadata?: any) => any
  ): () => void;
  once(
    eventName: string,
    listener: (payload?: any, metadata?: any) => any
  ): () => void;
  off(
    eventName: string,
    listener?: (payload?: any, metadata?: any) => any
  ): number;
  emit(eventName: string, payload?: any): number;
  clearEventListeners(eventName?: string): number;
  listEventNames(): string[];

  // Utilities
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

## 3) Global Helper Aliases

```ts
declare function registerProjectBehavior(
  behaviorType: string,
  behaviorConstructor: typeof gdjs.RuntimeBehavior
): void;

declare function requireModule(moduleName: string): any;

declare function callScriptExport(
  moduleId: string,
  exportName?: string,
  ...args: any[]
): any;

declare function setScriptSharedState(key: string, value: any): void;
declare function getScriptSharedState(key: string, defaultValue?: any): any;

declare function emitScriptEvent(eventName: string, payload?: any): number;
declare function onScriptEvent(
  eventName: string,
  listener: (payload?: any, metadata?: any) => any
): () => void;
declare function offScriptEvent(
  eventName: string,
  listener?: (payload?: any, metadata?: any) => any
): number;

declare function requireExternalModule(moduleName: string): any;
declare function importExternalModule(moduleName: string): Promise<any>;

declare function liveRepl(code: string): any;
```

## 4) `gdjs.ts` Namespace

```ts
declare namespace gdjs {
  namespace ts {
    // Full bridge object (same API as tsModules)
    const bridge: typeof tsModules;

    // Wrappers
    function setExternalModule(moduleName: string, moduleValue: any): void;
    function setExternalModuleAlias(moduleName: string, globalPath: string): void;
    function requireExternalModule(moduleName: string): any;
    function importExternalModule(moduleName: string): Promise<any>;
    function resolveGlobal(globalPath: string): any;
    function bindDefaultExternalModules(): void;
    function requireModule(moduleName: string): any;

    // Script export call
    function callScriptExport(
      moduleId: string,
      exportName?: string,
      ...args: any[]
    ): any;

    // Shared state
    function setSharedState(key: string, value: any): void;
    function getSharedState(key: string, defaultValue?: any): any;

    // Event bus
    function emit(eventName: string, payload?: any): number;
    function on(
      eventName: string,
      listener: (payload?: any, metadata?: any) => any
    ): () => void;
    function off(
      eventName: string,
      listener?: (payload?: any, metadata?: any) => any
    ): number;

    // Other helpers
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

Note:
- `gdjs.ts.bridge.once(...)`, `gdjs.ts.bridge.clearEventListeners(...)`, and other bridge-only methods are available through `bridge`.

## 5) Event JavaScript Environment (inside Events)

Typical available variables:

```ts
declare const runtimeScene: gdjs.RuntimeScene;
declare const objects: gdjs.RuntimeObject[];
declare const eventsFunctionContext: any;
declare const evtTools: typeof gdjs.evtTools;
```

Bridge helpers are available in event JavaScript as global functions too (`callScriptExport`, `setScriptSharedState`, etc.).

## 6) `gdjs.runtimeCapabilities` (Expanded Runtime Control API)

### 6.1 Engine discovery and dynamic invocation

```ts
declare namespace gdjs {
  namespace runtimeCapabilities {
    function getRuntimeCapabilitiesSummary(): any;
    function getEngineAccess(source?: any): any;
    function readEnginePath(path: string, source?: any): any;
    function invokeEnginePath(path: string, source?: any, ...args: any[]): any;
  }
}
```

### 6.2 Input snapshot + input injection

```ts
declare namespace gdjs {
  namespace runtimeCapabilities {
    function getInputSnapshot(source?: any): any;
    function listPressedKeys(source?: any): number[];
    function listActiveTouches(source?: any): any[];
    function listConnectedGamepads(): any[];

    function setKeyPressed(source: any, keyCode: number, location?: number): boolean;
    function setKeyReleased(source: any, keyCode: number, location?: number): boolean;

    function setMousePosition(
      source: any,
      x: number,
      y: number,
      movementX?: number,
      movementY?: number
    ): boolean;
    function setMouseButtonPressed(source: any, buttonCode: number): boolean;
    function setMouseButtonReleased(source: any, buttonCode: number): boolean;
    function setMouseWheelDelta(
      source: any,
      deltaY: number,
      deltaX?: number,
      deltaZ?: number
    ): boolean;

    function setTouchStarted(
      source: any,
      rawIdentifier: number,
      x: number,
      y: number
    ): boolean;
    function setTouchMoved(
      source: any,
      rawIdentifier: number,
      x: number,
      y: number
    ): boolean;
    function setTouchEnded(source: any, rawIdentifier: number): boolean;
    function setTouchSimulationForMouse(source: any, enable: boolean): boolean;
  }
}
```

### 6.3 Behavior/extension runtime capability APIs

```ts
declare namespace gdjs {
  namespace runtimeCapabilities {
    function listObjectBehaviors(object: gdjs.RuntimeObject): any[];
    function resolveBehavior(object: gdjs.RuntimeObject, behaviorNameOrType: string): any;
    function listBehaviorMethods(
      object: gdjs.RuntimeObject,
      behaviorNameOrType: string
    ): string[];
    function invokeBehaviorMethod(
      object: gdjs.RuntimeObject,
      behaviorNameOrType: string,
      methodName: string,
      ...args: any[]
    ): any;

    function registerBehaviorCapability(capability: any): void;
    function unregisterBehaviorCapability(behaviorType: string, methodName?: string): void;
    function listRegisteredBehaviorCapabilityTypes(): string[];

    function registerExtensionCapability(capability: any): void;
    function registerExtensionNamespace(extensionName: string, extensionNamespace: any): void;
    function autoRegisterKnownExtensionNamespaces(): void;
    function unregisterExtensionCapability(extensionName: string, methodName?: string): void;
    function listRegisteredExtensionCapabilityNames(): string[];
    function listExtensionMethods(extensionName: string): string[];
    function invokeExtensionMethod(
      extensionName: string,
      methodName: string,
      ...args: any[]
    ): any;

    function bindManualExtensionToObject(object: gdjs.RuntimeObject, binding: any): void;
    function unbindManualExtensionFromObject(
      object: gdjs.RuntimeObject,
      extensionName: string
    ): boolean;
    function listManualObjectExtensions(object: gdjs.RuntimeObject): string[];
    function setManualObjectExtensionConfig(
      object: gdjs.RuntimeObject,
      extensionName: string,
      configPatch: { [key: string]: unknown }
    ): boolean;
    function getManualObjectExtensionConfig(
      object: gdjs.RuntimeObject,
      extensionName: string
    ): { [key: string]: unknown } | null;
    function invokeManualObjectExtensionMethod(
      object: gdjs.RuntimeObject,
      extensionName: string,
      methodName: string,
      ...args: any[]
    ): any;
    function invokeObjectExtensionMethod(
      object: gdjs.RuntimeObject,
      extensionName: string,
      methodName: string,
      ...args: any[]
    ): any;
  }
}
```

## 7) Lifecycle Hooks

### 7.1 Scene scripts

```ts
export function onSceneLoaded(runtimeScene: gdjs.RuntimeScene): void;
export function onScenePreEvents(runtimeScene: gdjs.RuntimeScene): void;
export function onScenePostEvents(runtimeScene: gdjs.RuntimeScene): void;
export function onSceneUnloading(runtimeScene: gdjs.RuntimeScene): void;
export function onSceneUnloaded(runtimeScene: gdjs.RuntimeScene): void;
```

### 7.2 Object scripts

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

### 7.3 Behavior scripts

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

## 8) Include Order API

Each script supports:
- `includePosition: 'first' | 'last'`

Use `first` for foundational/shared bootstrap modules.

## 9) Behavior Registration Contract

Use prefix:
- `TypeScriptBehaviors::`

Example:

```ts
registerProjectBehavior('TypeScriptBehaviors::EnemyDashBehavior', EnemyDashBehavior);
```

## 10) Runtime Export Files

Generated module runtime files:
- `project-ts-modules-runtime.js`
- `project-ts-modules-definitions.js`
- `project-ts-modules-bootstrap-first.js` (when needed)
- `project-ts-modules-bootstrap-last.js` (when needed)
- `project-ts-modules-lifecycle.js`
