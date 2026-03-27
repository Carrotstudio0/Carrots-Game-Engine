# Script Docs Package

This folder contains the complete TypeScript scripting documentation for the new Script workflow.

## Documents

1. `00-INDEX.md`
   - Main navigation for this package.

2. `01-TypeScript-Scripting-System-Guide.md`
   - Full architecture and workflow guide.

3. `02-TypeScript-Scripting-API-Reference.md`
   - Full API reference for script lifecycle hooks, globals, and runtime helpers.

4. `03-TypeScript-Scripting-Examples.md`
   - Practical examples for scene/object/behavior scripts, behavior registration, imports, tests, and autofix notes.

5. `04-Game-Development-TypeScript-Syntax-and-Patterns.md`
   - A production-focused TypeScript syntax handbook for game developers.

6. `05-Game-Systems-You-Can-Build-With-Script.md`
   - A complete catalog of systems that can be built with Script workflow.

7. `06-Script-vs-Events-Freedom-Limits-and-Production-Decision.md`
   - Strategic comparison: why Script matters, where it wins, where Events still help.

## Recommended Reading Order

1. System Guide
2. API Reference
3. Syntax and Patterns
4. Systems Catalog
5. Script vs Events Decision Guide
6. Examples

## Notes

- Script files are physically stored under `source/scripts` in project folders.
- Old inline `JsCode` event workflow is deprecated/disabled in favor of Script workspace.
- Runtime wiring is lifecycle-driven and auto-connected at export/preview.
