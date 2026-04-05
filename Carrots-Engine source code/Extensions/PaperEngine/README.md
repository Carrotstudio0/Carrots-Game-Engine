# PaperEngine (Native 2.5D)

`PaperEngine` is a native extension for hybrid 2D+3D gameplay.

## What is native here
- `PaperSprite3DObject` is a real runtime object implemented in TypeScript:
  - file: `PaperSprite3DRuntimeObject.ts`
  - registered as: `PaperEngine::PaperSprite3DObject`
- `PaperFPSController` is a real runtime behavior implemented in TypeScript:
  - file: `PaperFPSControllerRuntimeBehavior.ts`
  - registered as: `PaperEngine::PaperFPSController`
- Editor declaration is done in `JsExtension.js` (graphical properties + actions/conditions/expressions).

## Graphical workflow (easy mode)
1. Add `Paper Sprite 3D` object from the object picker.
2. Configure maps in object properties:
   - `Albedo map`
   - `Normal map`
   - `ORM map`
   - `Emissive map`
3. Add `Paper FPS Controller` behavior to the player object.
4. Call `Setup dungeon FPS preset` once at scene start.

## TypeScript coding workflow
- Runtime behavior capability methods are registered for `PaperEngine::PaperFPSController`.
- This allows code-side integration via runtime capabilities (not only events).
- Available methods include:
  - `setupDungeonFPSPreset`
  - `setEnabled`
  - `isEnabled`
  - `isGrounded`
  - `isSprinting`
  - `getCurrentForwardSpeed`
  - `getCurrentSidewaysSpeed`
  - `getLookYaw`
  - `getLookPitch`

