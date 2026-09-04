---
name: tdd
description: Discipline for applying test-driven development where it adds regression value — preflight the change, reuse usable project test infrastructure, then red-green-refactor. Use before implementing features or fixing bugs to decide whether TDD applies, when practicing TDD, introducing project-appropriate testing for current work, or reviewing whether work was actually test-driven.
metadata:
  author: edram
  version: 2026.08.07
---

A discipline an agent applies when adding or changing behavior. Start with a preflight: decide whether TDD adds regression value, then whether the project already has usable test infrastructure for that behavior. Only then enter RED → GREEN → REFACTOR. Synthesized from four public TDD skills (mattpocock, obra/superpowers, NousResearch/hermes-agent, affaan-m/ECC).

- **Preflight before RED** — decide whether the change warrants TDD and whether the affected behavior is testable with the project's existing setup.
- **Never introduce test infrastructure silently** — ask first; if declined, prioritize the current task with direct verification; if approved, present a project-specific engineering plan and wait for confirmation.
- **Write the test first**, watch it fail, write the minimum code to pass, refactor on green.
- **No production code without a failing test** — code written before its test gets deleted.
- **One behavior per cycle** — vertical tracer bullets, never all-tests-then-all-code.
- **Test observable behavior** through the public interface, not implementation details.
- **A test only counts** once you've watched it fail for the *right* reason.

> Pure markdown, language- and framework-agnostic — preflight selects the path; the cycle stays strict once TDD applies.

## Core

| Topic | Description | Reference |
|-------|-------------|-----------|
| Preflight | Decide TDD value, detect usable project test infrastructure, ask before introducing it | [core-preflight](references/core-preflight.md) |
| Cycle | RED → GREEN → REFACTOR mechanics, watch-it-fail mandate, per-cycle checklist | [core-cycle](references/core-cycle.md) |
| Discipline | The Iron Law, delete-and-restart, rationalization rebuttals, red flags | [core-discipline](references/core-discipline.md) |
| Tracer Bullets | Vertical slices vs horizontal slicing; planning what to test | [core-tracer-bullets](references/core-tracer-bullets.md) |

## Features

| Topic | Description | Reference |
|-------|-------------|-----------|
| Good Tests | Behavior over implementation, the brittle-test smell, anti-patterns, mocking | [features-good-tests](references/features-good-tests.md) |
| Coverage | Test types, edge/error coverage, the RED gate, evidence trail | [features-coverage](references/features-coverage.md) |

<!--
Source references:
- https://github.com/mattpocock/skills/blob/main/skills/engineering/tdd/SKILL.md
- https://github.com/obra/superpowers/blob/main/skills/test-driven-development/SKILL.md
- https://github.com/NousResearch/hermes-agent/blob/main/skills/software-development/test-driven-development/SKILL.md
- https://github.com/affaan-m/ECC/blob/main/skills/tdd-workflow/SKILL.md
-->
