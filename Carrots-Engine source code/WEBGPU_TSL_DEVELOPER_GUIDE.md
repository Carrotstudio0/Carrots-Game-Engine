# WebGPU and TSL Developer Guide

Last updated: 2026-04-01
Branch: `render-update`

## Goal

This document explains the current rendering architecture after the WebGPU, Three.js, PixiJS, and TSL integration work.

It is meant for engine developers who need to:

- understand what is already supported,
- understand what still falls back to WebGL,
- add new WebGPU-safe rendering features,
- add or migrate shaders/material logic to TSL without breaking runtime compatibility.

## Current Architecture

The engine now supports two project-level rendering backends:

- `webgl`
- `webgpu`

The selection is stored on the project and exposed in the editor.

Important: selecting `webgpu` does **not** mean the full engine is already pure WebGPU.

Current behavior:

- Pure `2D` projects can use Pixi's WebGPU path.
- `2D + 2D lighting` can remain on the WebGPU path.
- Scenes built from pure `3D` layers, plus safe `2D` and `lighting` overlays, can now use the dedicated experimental `Three/WebGPU` runtime path with their own presentation canvas.
- Scenes that put visible `2D` content before visible `3D`, mix `2D+3D` inside a single layer, or rely on legacy 3D post-processing still require the legacy Three/WebGL composition path.
- `FSR1` still requires the legacy Three/WebGL composition path.
- When a project requests `webgpu` but a scene still needs legacy composition, the engine uses a hybrid strategy instead of dropping the entire project blindly.
- When a scene starts on the dedicated `Three/WebGPU` path but later enables a WebGL-only 3D feature such as legacy post-processing, the runtime can demote that scene back to the legacy path.

This is intentional. Stability comes first, while we progressively remove WebGL-only assumptions.

## What Has Been Added

### 1. Project-level backend selection

Added support for persisting a rendering backend in the project model:

- `Core/GDCore/Project/Project.h`
- `Core/GDCore/Project/Project.cpp`
- `GDevelop.js/Bindings/Bindings.idl`

Editor integration was added in:

- `newIDE/app/src/ProjectCreation/NewProjectSetupDialog.js`
- `newIDE/app/src/ProjectManager/ProjectPropertiesDialog.js`
- `newIDE/app/src/Utils/UseCreateProject.js`

Runtime typing was updated in:

- `GDJS/Runtime/types/project-data.d.ts`

### 2. Runtime backend normalization and hybrid routing

Backend normalization and requirement analysis now live in:

- `GDJS/Runtime/runtimegame.ts`
- `GDJS/Runtime/runtimescene.ts`

Important helpers:

- `gdjs.getLayerSharedWebGLRendererRequirementReason(layerData)`
- `gdjs.getProjectSharedWebGLRendererRequirementReason(projectData, upscalingMode)`
- `RuntimeScene.getLegacyCompositionRequirementReason()`

These helpers define whether a scene can stay on the native WebGPU path or must use legacy Three/WebGL composition.

### 3. Runtime renderer split and hybrid rendering behavior

Core renderer work is in:

- `GDJS/Runtime/pixi-renderers/runtimegame-pixi-renderer.ts`
- `GDJS/Runtime/pixi-renderers/runtimescene-pixi-renderer.ts`
- `GDJS/Runtime/pixi-renderers/layer-pixi-renderer.ts`

What changed:

- backend request and active backend are tracked separately,
- fallback reason is tracked explicitly,
- hybrid scene rendering is supported,
- a dedicated `Three/WebGPU` scene path now exists for scenes whose visible content can be composed as `3D` first and `2D/lighting` overlays afterward,
- shared Pixi/Three texture interop is gated instead of assumed,
- legacy `EffectComposer` creation is now blocked on dedicated WebGPU layers and can trigger an automatic fallback to the legacy WebGL path when a 3D post-processing pass is added,
- renderer compatibility decisions are centralized.

### 4. Debugger visibility for backend state

The runtime debugger now exposes backend and TSL support state in:

- `GDJS/Runtime/debugger-client/abstract-debugger-client.ts`

Current debug fields include:

- requested backend,
- active backend,
- backend fallback issue,
- hybrid rendering issue,
- Three WebGPU bundle availability,
- TSL bundle availability,
- whether node materials are currently enabled.

### 5. Three.js WebGPU and TSL vendor bundles

New vendor entry points were added:

- `GDJS/scripts/vendor/three-webgpu.entry.js`
- `GDJS/scripts/vendor/three-tsl.entry.js`

New runtime bundles are generated into:

- `GDJS/Runtime/pixi-renderers/three.webgpu.js`
- `GDJS/Runtime/pixi-renderers/three.tsl.js`

Bundle generation is wired through:

- `GDJS/scripts/build-vendor-libs.js`
- `GDJS/scripts/lib/runtime-files-list.js`
- `GDJS/tests/karma.conf.js`
- `GDJS/GDJS/IDE/ExporterHelper.cpp`

Useful commands:

- `npm run build-vendor-libs`
- `npm run check-vendor-libs`

from the `GDJS` folder.

### 6. Global typings for WebGPU and TSL

Added global declarations:

- `GDJS/Runtime/types/global-three-webgpu.d.ts`
- `GDJS/Runtime/types/global-three-tsl.d.ts`

These allow runtime code to access:

- `THREE_WEBGPU`
- `THREE_TSL`

without unsafe ad hoc globals scattered around the codebase.

### 7. Central TSL support helpers

Added:

- `GDJS/Runtime/pixi-renderers/three-tsl-tools.ts`
- `GDJS/Runtime/pixi-renderers/three-tsl-scene-materials.ts`

These files provide the current TSL integration surface.

Key helpers:

- `gdjs.hasThreeWebGpuBundleSupport()`
- `gdjs.hasThreeTslBundleSupport()`
- `gdjs.canUseThreeTslNodeMaterials(renderer)`
- `gdjs.getThreeShadingSupportState(renderer)`
- `gdjs.supportsThreeTslSceneEffects(renderer)`
- `gdjs.getPreferredThreeShadowMapType(renderer, lightKind)`
- `gdjs.createThreeTslRimLightMaterial(renderer, sourceMaterial, params)`
- `gdjs.updateThreeTslRimLightMaterial(material, params)`
- `gdjs.createThreeTslSkyMaterial()`
- `gdjs.updateThreeTslSkyMaterial(material, params)`

### 8. TSL-backed scene effects added so far

The first TSL scene effects are now wired with safe fallbacks:

- `Extensions/3D/RimLight.ts`
- `Extensions/3D/Sky.ts`
- `Extensions/3D/DirectionalLight.ts`
- `Extensions/3D/PointLight.ts`
- `Extensions/3D/SpotLight.ts`

Current behavior:

- `RimLight` tries a TSL/node-material patch first when a node-capable renderer is active.
- `Sky` tries a TSL procedural sky material first when a node-capable renderer is active.
- directional and spot sun-like shadow paths can prefer `VSMShadowMap` when TSL/node-material support is active.
- safe fallback remains in place for the existing WebGL renderer path.

### 9. Rendering quality improvements outside the runtime

Editor and preview quality helpers were centralized in:

- `newIDE/app/src/Utils/ThreeRenderingQuality.js`

This file contains reusable helpers for:

- renderer color space and tone mapping,
- shadow defaults,
- studio lighting rigs,
- generated PMREM-based environment targets.

These helpers are used by editor/preview paths so quality tuning is no longer duplicated.

### 10. Three.js / PixiJS compatibility work

Additional compatibility updates were made across the engine:

- tone mapping modernization,
- color space handling,
- WebGL interop guards,
- safer layer composition behavior,
- editor preview rendering quality upgrades,
- fixes to old type/runtime drift in 3D and Physics3D behavior paths.

Representative files:

- `Extensions/3D/ToneMappingEffect.ts`
- `Extensions/3D/LightingPipeline.ts`
- `Extensions/3D/PBRMaterialBehavior.ts`
- `Extensions/Physics3DBehavior/Physics3DRuntimeBehavior.ts`
- `newIDE/app/src/InstancesEditor/index.js`
- `newIDE/app/src/ObjectEditor/Editors/Model3DAnimationEditor.js`
- `newIDE/app/src/ResourcesList/ResourcePreview/Resource3DPreview.worker.js`

## What Is Not Fully Added Yet

This section is important. Do not assume the engine is already fully native WebGPU.

### Still not fully native WebGPU

- Scenes that require visible `2D` background layers below `3D` still depend on the legacy composition path.
- Mixed `2D+3D` rendering inside a single layer still depends on the legacy composition path.
- `FSR1` still requires the legacy path.
- Legacy 3D post-processing still depends on the legacy composition path.
- The old `ShaderMaterial` / `onBeforeCompile` stack still exists in multiple places.

### TSL activation is conditional

TSL effects do **not** run just because the bundles exist.

TSL scene effects currently require:

- `THREE_WEBGPU` bundle present,
- `THREE_TSL` bundle present,
- a renderer that actually exposes node-material support,
- `renderer.isWebGPURenderer === true`.

If those conditions are not met, the engine must fall back cleanly.

### Not all shaders are ported

The engine still contains several WebGL-only shader and post-processing paths, especially in:

- layer composition shaders,
- FSR shaders,
- post-processing stack effects,
- some custom 3D effects that still depend on `ShaderMaterial`.

## Current Practical Support Matrix

### Stable or intentionally supported now

- project setting for `webgl` or `webgpu`
- Pixi WebGPU selection for compatible projects
- hybrid fallback routing
- dedicated `Three/WebGPU` runtime path for `3D-only` scenes
- runtime/backend diagnostics
- TSL utility layer
- first TSL-backed scene effects for sky and rim-light logic
- shadow quality preference hooks for sun-like lights

### Partially supported

- WebGPU projects with scenes that still need legacy composition
- editor/previews using updated Three quality defaults
- PBR/lighting modernization groundwork

### Not complete yet

- native WebGPU `3D` renderer path replacing legacy shared WebGL composition
- native WebGPU post-processing stack
- full TSL migration of all engine shaders and custom materials
- WebGPU-native replacement for all `ShaderMaterial` paths

## Rules for Developers Adding New WebGPU Features

### Rule 1: Do not add new hard WebGL-only rendering logic without a fallback story

If a new effect uses:

- `ShaderMaterial`
- `RawShaderMaterial`
- `onBeforeCompile`
- direct internal WebGL texture access

then it must either:

- stay explicitly legacy-only and document why,
- or provide a WebGPU/TSL-compatible branch.

### Rule 2: Prefer centralized capability checks

Use the helpers in:

- `GDJS/Runtime/pixi-renderers/three-tsl-tools.ts`
- `GDJS/Runtime/pixi-renderers/three-tsl-scene-materials.ts`

Do not duplicate bundle checks or renderer capability checks in random effect files.

### Rule 3: Prefer TSL for scene materials, not for every rendering problem

Use TSL when you are changing:

- material shading,
- procedural sky/atmosphere,
- scene material lighting response,
- node-based surface effects.

Do **not** assume TSL is the right answer for:

- Pixi filters,
- pure Pixi render graph work,
- engine-level 2D render passes,
- all post-processing immediately.

Pixi-side rendering still needs Pixi/WebGPU or Pixi/WebGL APIs where appropriate.

### Rule 4: Keep graceful fallback behavior

When adding a new TSL-backed feature:

1. detect capability,
2. create the TSL path,
3. keep the legacy path working,
4. make switching explicit and reversible,
5. never break the current stable renderer just because WebGPU is requested.

### Rule 5: Keep hybrid scenes debuggable

If a feature requires legacy composition, add or reuse a clear reason string.

Developers should be able to answer:

- Why did this scene fall back?
- Is the fallback project-wide or scene-specific?
- Is the issue due to 3D, mixed composition, or a WebGL-only effect?

## Rules for Developers Adding TSL Materials

### Recommended pattern

1. Add capability gating through `gdjs.supportsThreeTslSceneEffects(renderer)`.
2. Create a node-material version through the node library or a `NodeMaterial`.
3. Store runtime-updatable uniform handles in `material.userData`.
4. Add an explicit update helper that refreshes TSL uniforms every frame or when parameters change.
5. Keep the old path until the native WebGPU 3D path is production-ready.

### Existing examples

- `Extensions/3D/RimLight.ts`
- `Extensions/3D/Sky.ts`

### TSL design advice

- Keep parameters explicit and serializable.
- Use helper functions for clamping and conversions.
- Store per-material TSL state in a dedicated `userData` key.
- Avoid spreading TSL graph construction logic across many unrelated files.

## Rules for Developers Adding New Shaders

Ask first: what kind of shader is this?

### A. Scene material or surface shading

Preferred approach:

- TSL/node-material path first,
- legacy fallback second.

Examples:

- rim light,
- sun/sky shading,
- material lighting accents,
- procedural surface shading.

### B. Full-screen or post-processing shader

Current guidance:

- keep existing path working,
- isolate WebGL-only logic,
- do not pretend it is already native WebGPU unless it truly is,
- design toward a future render-graph or WebGPU-compatible pipeline.

Examples:

- FSR1,
- SSR,
- bloom stack,
- SSAO stack.

### C. Pixi-side effect or layer composition shader

Current guidance:

- use Pixi APIs and renderer-specific abstractions,
- avoid new direct dependency on private WebGL handles unless absolutely necessary,
- if interop is required, gate it and expose a clear disable reason.

## Rules for Tools, Editor, and Preview Code

Use the shared quality helpers in:

- `newIDE/app/src/Utils/ThreeRenderingQuality.js`

This should be the first place to update if you need:

- a better tone mapping default,
- better environment lighting,
- stronger preview shadows,
- consistent preview quality across editor panels.

Do not duplicate ad hoc preview lighting rigs in multiple editor files when one shared helper can serve them.

## Verification Workflow

Recommended checks for rendering changes:

### Runtime and typing

From `GDJS`:

- `npm run check-types`
- `npm run build-vendor-libs`
- `npm run check-vendor-libs`

### Editor/web build

From `newIDE/app`:

- `npm run build`

### Important note on latest verification status

As of 2026-04-01:

- `GDJS npm run check-types` passes.
- a full `newIDE/app` rebuild was started, a real editor lint issue in `InstancesEditor/InstancesRenderer/LayerRenderer.js` was fixed, and the last rebuild attempt was interrupted before final completion.

Treat the editor build as needing one fresh rerun after the interrupted session.

## Recommended Next Technical Milestones

1. Move more scene material effects from `onBeforeCompile` or `ShaderMaterial` to TSL where it is clearly a material problem.
2. Separate WebGPU-native 3D rendering from the old shared WebGL composition path.
3. Rework post-processing so it is no longer tightly coupled to legacy WebGL-only assumptions.
4. Continue replacing implicit interop assumptions with explicit capability gates and debug reasons.

## Short Summary

The engine now has:

- a real project-level WebGPU/WebGL selection,
- hybrid backend routing,
- WebGPU and TSL vendor bundles,
- TSL capability helpers,
- first TSL-backed scene effects,
- upgraded lighting and rendering quality infrastructure,
- clearer boundaries between what is already WebGPU-ready and what is still legacy.

The engine does **not** yet have:

- a fully native WebGPU 3D runtime path,
- a full TSL migration for all engine shaders,
- a full native WebGPU post-processing stack.

That is the correct current status. It is a strong foundation, not the end state.
