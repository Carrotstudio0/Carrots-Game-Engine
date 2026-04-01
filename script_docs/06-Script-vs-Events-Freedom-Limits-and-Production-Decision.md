# Script vs Events: Importance, Freedom, and Limits

## 1) Executive Summary

Script workflow is more powerful and more flexible than event-only logic for medium/large codebases.
Event Sheets are still excellent for visual orchestration and designer-facing logic.
The best production model is usually hybrid.

## 2) What Makes Script Important

Script adds:
- Strong typing and compile-time feedback.
- Reusable modules across scenes and systems.
- Better architecture for large teams.
- Safer refactor paths.
- Professional tooling (autocomplete, diagnostics, auto-fix support).

Without this, large projects often hit maintenance walls.

## 3) Comparison Matrix

## 3.1 Development speed (prototype)
- Events: faster at the very beginning.
- Script: slightly slower at first, faster later as complexity grows.

## 3.2 Scaling to large systems
- Events: gets crowded and hard to refactor.
- Script: much better modular scaling.

## 3.3 Readability for non-programmers
- Events: better.
- Script: requires coding skill.

## 3.4 Reuse across project
- Events: limited and often duplicated.
- Script: excellent via modules/imports.

## 3.5 Debugging and contracts
- Events: visual debugging is good, but contracts are weaker.
- Script: type contracts and explicit APIs are stronger.

## 3.6 Team collaboration
- Events: good for design-heavy teams.
- Script: better for engineering-heavy collaboration and code review.

## 4) Is Script More Free or More Limited?

Short answer:
- It is **more free** architecturally.
- It is **constrained** by engine runtime API boundaries and lifecycle hook model.

Meaning:
- You can design almost any programming architecture.
- But code still runs within engine lifecycle and available runtime objects/APIs.

So it is not "unlimited", but it is much less restrictive than event-inline scripting.

## 5) Real Limits You Should Know

1. Runtime API boundary:
Only APIs exposed to runtime can be used.

2. Lifecycle-driven execution:
Your code should integrate through scene/object/behavior hooks.

3. Performance responsibility:
Script gives freedom, but bad loops/allocations can still hurt frame time.

4. Team skill dependency:
Requires coding standards, review process, and architecture discipline.

## 6) Where Events Are Still Better

Use Events when:
- Designers need fast visual edits.
- Logic is simple and local.
- You want immediate readability for non-programmers.

## 7) Where Script Is Clearly Better

Use Script when:
- You build reusable systems (combat, inventory, AI, save pipelines).
- You need clean APIs and long-term maintainability.
- You want code-level testing and stronger contracts.

## 8) Recommended Hybrid Strategy

1. Keep Event Sheets for level-specific orchestration.
2. Move reusable logic into TypeScript modules.
3. Use scene/object/behavior hooks for clean integration.
4. Keep data-driven config and formulas in code modules.
5. Document module contracts in API docs.

## 9) Migration Strategy from Event-Centric Projects

1. Start with one system (for example cooldowns).
2. Extract repeated event logic into a script module.
3. Keep event calls as orchestration wrappers.
4. Repeat per system (AI, inventory, damage, save).
5. Track wins: fewer duplicates, easier fixes, faster refactors.

## 10) Final Decision Rule

If the game is tiny and short-lived, Events can be enough.
If the game will grow, Script is the safer long-term foundation.
For most serious projects, hybrid is the most productive and least risky route.
