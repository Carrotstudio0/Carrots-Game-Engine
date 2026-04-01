# TypeScript Scripting System Guide

## 1) Overview

The engine now provides a full hybrid scripting model:
- Dedicated **TypeScript Script workspace** (file-based).
- **JavaScript inside Events** (event code blocks).
- Direct **Script <-> Events bridge APIs** for production workflows.

This means you can keep visual event orchestration while moving reusable systems to TypeScript modules.

## 2) Core Workflow

1. Write reusable systems in `source/scripts/...` TypeScript files.
2. Use lifecycle hooks for scene/object/behavior wiring.
3. Call script exports from Events when needed.
4. Share state and messages between both sides through the bridge.

## 3) Script Workspace

Script editor features:
- File list + include order (`first` / `last`)
- Monaco diagnostics and autocomplete
- Project/runtime typings (`sceneObjects`, behaviors, runtime APIs)
- Script source persistence in `source/scripts`

## 4) Runtime Export Wiring

At export/preview, script runtime files are generated:
- `project-ts-modules-runtime.js`
- `project-ts-modules-definitions.js`
- `project-ts-modules-bootstrap-first.js` (if needed)
- `project-ts-modules-bootstrap-last.js` (if needed)
- `project-ts-modules-lifecycle.js`

## 5) Lifecycle Execution Model

Supported contexts:
- `project`
- `scene`
- `object`
- `behavior`

Hooks are auto-connected and safe-called at runtime.

## 6) Script <-> Events Bridge (New)

The bridge is available through:
- `tsModules` (global modules API)
- `gdjs.ts.bridge` (same bridge APIs under `gdjs.ts`)
- Event globals (for event JavaScript blocks):
  - `callScriptExport`
  - `setScriptSharedState` / `getScriptSharedState`
  - `emitScriptEvent` / `onScriptEvent` / `offScriptEvent`

This allows:
- Calling TypeScript functions directly from Events.
- Emitting/listening custom events across both systems.
- Managing shared in-memory state safely.

## 7) Runtime Capabilities Expansion (New)

`gdjs.runtimeCapabilities` now exposes:
- Dynamic engine access by path (`readEnginePath`, `invokeEnginePath`)
- Input snapshot (`getInputSnapshot`)
- Programmatic input injection (keyboard/mouse/touch)
- Gamepad inspection (`listConnectedGamepads`)
- Behavior/extension runtime capability discovery and invocation helpers

## 8) JavaScript in Events Status

JavaScript event code is available and supported in hybrid mode.
Use it for local glue code, event-level integration, or calling script exports.

## 9) Recommended Production Strategy

1. Keep Event Sheets for readable orchestration.
2. Move reusable systems to TypeScript modules.
3. Use bridge APIs instead of duplicate logic.
4. Use shared state keys for cross-system data.
5. Use event bus for decoupled communication.
6. Use runtimeCapabilities only where deep runtime control is required.

## 10) Troubleshooting

### Bridge call fails
- Verify `moduleId` path is correct.
- Verify `exportName` exists and is callable.

### Shared state not found
- Confirm key name consistency.
- Use `listSharedStateKeys()` for debugging.

### Event listeners leak
- Store unsubscribe function from `on(...)` and call it when no longer needed.
- Use `off(...)` or `clearEventListeners(...)` where appropriate.

### Input injection has no effect
- Ensure source runtime context is valid (`runtimeScene` or runtime game source).
- Verify key codes/button codes are correct.
