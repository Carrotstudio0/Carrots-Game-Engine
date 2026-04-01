# Game Systems You Can Build with the Script Workflow

## 1) Scope

This document lists the major game systems that can be implemented with the TypeScript Script workflow.
These are practical production systems, not toy examples.

## 2) Core Gameplay Systems

## 2.1 Player controller
What it includes:
- Movement, jump, dash, crouch, climb.
- Input buffering and coyote time.

Why Script is strong:
- Fine control over timing and state transitions.
- Clean, testable movement math.

## 2.2 Combat system
What it includes:
- Melee/ranged attacks.
- Damage pipelines (crit, armor, resist).
- Hit stop, stun windows, invulnerability frames.

Why Script is strong:
- Centralized combat formulas.
- Reusable damage and status modules.

## 2.3 Ability and cooldown system
What it includes:
- Skills with charges, cooldown, and costs.
- Combo and cancel windows.

Why Script is strong:
- Easy abstraction and extension.
- Better for balancing iterations.

## 2.4 Weapon system
What it includes:
- Weapon stats, spread, recoil, reload logic.
- Upgrade hooks.

Why Script is strong:
- Data-driven setup is much easier in code.

## 3) AI and NPC Systems

## 3.1 Finite state machine AI
Examples:
- Idle, patrol, chase, attack, retreat.

## 3.2 Utility AI / score-based decisions
Examples:
- Select best action using weighted scores.

## 3.3 Boss phase logic
Examples:
- Multi-phase pattern transitions with health thresholds.

Why Script is strong:
- Complex branching and reusable behavior trees are easier in typed code.

## 4) Progression and Economy Systems

## 4.1 Inventory system
- Stack rules, equipment slots, item modifiers.

## 4.2 Quest system
- Quest graph, conditions, branching outcomes.

## 4.3 XP/leveling system
- Growth curves, unlock tables, passive bonuses.

## 4.4 Shops and currencies
- Multi-currency economy, discounts, dynamic pricing.

## 5) World and Content Systems

## 5.1 Spawn manager
- Wave spawning, zones, weighted random pools.

## 5.2 Save/load state system
- Slot-based saves, migration versioning.

## 5.3 Dialogue and narrative logic
- Conditional nodes, localization keys, branching flags.

## 5.4 Cutscene sequencing
- Timeline triggers, camera actions, scripted events.

## 6) Meta and Platform Systems

## 6.1 Achievement and challenge tracking
- Event counters, completion conditions.

## 6.2 Analytics/instrumentation hooks
- Session metrics, funnel steps.

## 6.3 Live configuration and balancing
- Load remote values and tune without hard rebuild loops.

## 6.4 Developer tooling
- Runtime test registration (`gdjs.ts.test`).
- Script diagnostics and typo auto-fix loops.

## 7) Technical Systems

## 7.1 Event bus / message routing
- Decouple systems (combat, UI, quest, audio).

## 7.2 Command pattern for undo/redo gameplay actions
- Useful in builders/sandbox games.

## 7.3 Deterministic simulation helpers
- For replays or lockstep style logic constraints.

## 7.4 Object pooling
- Reduced allocations and smoother runtime behavior.

## 8) System Map by Project Size

Small project:
- Player controller
- Enemy AI (FSM)
- Basic save/load
- Simple inventory

Mid project:
- Combat pipeline
- Ability/cooldown framework
- Quest/dialogue framework
- Spawn manager

Large project:
- Data-driven economy
- Advanced AI utilities
- Profiling + telemetry
- Scripted tooling and testing layers

## 9) Why This Matters

The Script workflow enables architectural systems that become painful in large pure-visual setups:
- Shared modules and contracts.
- Scalable abstractions.
- Safer refactors.
- Better testability.

This is the biggest reason the system is important for long-term production.
