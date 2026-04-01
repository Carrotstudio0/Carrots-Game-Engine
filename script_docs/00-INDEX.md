# Script Docs Package

This folder contains the complete TypeScript scripting documentation for the Script workflow, including the new Script <-> Events bridge APIs.

## Documents

1. `00-INDEX.md`
   - Main navigation for this package.

2. `01-TypeScript-Scripting-System-Guide.md`
   - Full architecture and workflow guide.

3. `02-TypeScript-Scripting-API-Reference.md`
   - Full API reference for lifecycle hooks, bridge APIs, shared state, event bus, runtime capabilities, and event integration.

4. `03-TypeScript-Scripting-Examples.md`
   - Practical examples for scene/object/behavior scripts, script-event bridge usage, input/runtime control, and module interop.

5. `04-Game-Development-TypeScript-Syntax-and-Patterns.md`
   - A production-focused TypeScript syntax handbook for game developers.

6. `05-Game-Systems-You-Can-Build-With-Script.md`
   - A complete catalog of systems that can be built with Script workflow.

7. `06-Script-vs-Events-Freedom-Limits-and-Production-Decision.md`
   - Strategic comparison for hybrid production decisions.

## Recommended Reading Order

1. System Guide
2. API Reference
3. Examples
4. Syntax and Patterns
5. Systems Catalog
6. Script vs Events Decision Guide

## Notes

- Script files are physically stored under `source/scripts` in project folders.
- JavaScript code inside Events is available and can directly call TypeScript script exports.
- `tsModules` + `gdjs.ts.bridge` provide a direct bridge between Scripts and Events.
- Runtime wiring is lifecycle-driven and auto-connected at export/preview.
