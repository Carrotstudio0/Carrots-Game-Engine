# TypeScript Scripting System Guide

## 1) Overview

This project now ships with a dedicated **Script** workflow for TypeScript/JavaScript, designed as a professional, file-based scripting system instead of inline event-code snippets.

Key outcomes:
- A dedicated **Script** entry in the editor flow (including scene toolbar next to Events).
- Real `.ts` source files saved inside the project folder.
- Lifecycle-based execution for Scene/Object/Behavior scripts.
- Monaco-powered completion, diagnostics, and typo auto-fix support.
- Behavior registration from TypeScript scripts into the Behavior editor.

## 2) Why This Replaced Old Event Code

The old inline JavaScript event (`JsCode`) path was tightly coupled to Event Sheets and hard to scale as a full scripting workflow.

The new approach moves scripting to:
- Dedicated script files.
- Strong typing and editor assistance.
- Cleaner runtime wiring.
- Better parity with modern game engine workflows (Godot/Unity-style project scripts).

## 3) User-Facing Workflow

### 3.1 Enable the scripting workflow
Open:
- `Project Properties` -> `Scripting workflow`

Modes:
- `Event Sheet (visual logic)`
- `TypeScript + Event Sheet (hybrid)`

### 3.2 Open Script workspace
You can open Script from:
- Scene toolbar: **Events** + **Script** buttons side-by-side.
- Project Manager: top-level **Script** item.
- Commands/palette integrations where available.

### 3.3 Edit scripts in a dedicated editor
The Script editor provides:
- Left files pane (project scripts).
- Main Monaco code area.
- Diagnostics panel.
- Footer position info (line/column).
- Include order selection (`Load first` / `Load last`).

## 4) Physical File Layout in Project

Scripts are materialized into:
- `source/scripts/...`

Typical generated context paths:
- `source/scripts/scenes/<SceneName>/scene.ts`
- `source/scripts/scenes/<SceneName>/objects/<ObjectName>.ts`
- `source/scripts/scenes/<SceneName>/behaviors/<ObjectName>.<BehaviorName>.ts`
- `source/scripts/global/objects/<ObjectName>.ts`
- `source/scripts/global/behaviors/<ObjectName>.<BehaviorName>.ts`

Notes:
- Paths are sanitized for filesystem safety.
- Missing extensions are normalized to `.ts`.
- Deleted scripts are also removed from disk and empty folders are cleaned up.

## 5) Metadata and Persistence

Script metadata is stored in project extension properties:
- Extension: `GDevelopEditor`
- Property: `typeScriptProjectScripts`

Each script keeps:
- `id`
- `name` (relative script path)
- `source`
- `transpiledCode`
- `includePosition` (`first` or `last`)
- Context fields (`contextKind`, `sceneName`, `objectName`, `behaviorName`)

At load time:
- Metadata is read first.
- Sources are hydrated from disk if files exist.
- If metadata is empty, scripts can be discovered from `source/scripts`.

## 6) Compilation and Runtime Export

At edit time:
- TypeScript source is transpiled in-editor.
- Diagnostics are shown per file and globally.

At export/preview:
- Generated runtime files include:
  - `project-ts-modules-runtime.js`
  - `project-ts-modules-definitions.js`
  - Optional bootstrap files for include order
  - `project-ts-modules-lifecycle.js`

Runtime module system features:
- Module source registry.
- Relative/absolute module resolution.
- External module injection.
- Runtime test registration utilities.
- Global bindings (`gdjs.ts`, `registerProjectBehavior`, `liveRepl`, `tsModules`).

## 7) Execution Model

Scripts are executed through lifecycle callbacks, not inline Event Sheet code.

Supported scopes:
- `project`
- `scene`
- `object`
- `behavior`

Lifecycle wiring is auto-installed and auto-unregistered (safe re-export/reload behavior).

## 8) Behavior Integration

TypeScript can register runtime behaviors with:
- `registerProjectBehavior('TypeScriptBehaviors::MyBehavior', MyBehaviorClass)`
- or `gdjs.ts.registerProjectBehavior(...)`

The editor scans script sources for those registrations and dynamically exposes these behavior types in the Behavior editor extension list.

## 9) Autocomplete, Diagnostics, and Auto-Fix

Autocomplete/type intelligence:
- Runtime declarations are loaded for JS/TS IntelliSense.
- Project-level type libs are injected for object and behavior names.

Diagnostics:
- Semantic/suggestion/syntax diagnostics are enabled for TS/JS defaults in Monaco.

Typo auto-fix:
- Enabled for Script editor usage.
- Uses diagnostics containing "Did you mean ...".
- Applies an edit only when identifier similarity is high (Levenshtein distance <= 2).
- Keeps undo boundaries via Monaco undo stop.

## 10) Old Event Inline Script Status

Old Event Sheet inline script event (`JsCode`) is disabled from normal authoring flow:
- Hidden from event insertion metadata.
- Removed from standard event rendering path.
- Inspector marks it as removed.
- Runtime generation for this event is disabled.

This prevents accidental use of the legacy path and keeps scripting in Script workspace.

## 11) Recommended Production Workflow

1. Keep Event Sheets for high-level orchestration.
2. Put reusable logic in TypeScript modules under `source/scripts`.
3. Use context scripts (scene/object/behavior) for lifecycle hooks.
4. Register project behaviors from script code when needed.
5. Use tests (`gdjs.ts.test`) for quick in-runtime checks.
6. Use include order intentionally (`first` for foundational modules).

## 12) Troubleshooting

### Script file not appearing
- Ensure project has a valid project file path.
- Ensure `source/scripts` is writable.

### Behavior type not listed
- Confirm behavior type prefix and registration call are present in source.
- Re-open behavior list or trigger script sync.

### Typo not auto-fixed
- Auto-fix only applies when TypeScript emits a "Did you mean" suggestion.
- Very different words are intentionally not auto-replaced.

### Compilation diagnostics remain
- Open diagnostics panel and navigate to each issue.
- Fix type/identifier/module path errors first.
