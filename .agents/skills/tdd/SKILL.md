---
name: tdd
description: Discipline for writing code test-first — red-green-refactor, watch the test fail, no production code without a failing test. Use when implementing a feature or fixing a bug test-first, practicing TDD, writing a failing test before the code, or reviewing whether work was actually test-driven.
metadata:
  author: edram
  version: 2026.06.25
---

A discipline an agent applies when adding or changing behavior: write a failing test first, watch it fail, then write the minimum code to pass. Synthesized from four public TDD skills (mattpocock, obra/superpowers, NousResearch/hermes-agent, affaan-m/ECC). The point is to counter the usual AI failure mode — writing code first and tests later (or never) — by making test-first non-negotiable and tying every line of production code to a test you *watched* fail.

- **Write the test first**, watch it fail, write the minimum code to pass, refactor on green.
- **No production code without a failing test** — code written before its test gets deleted.
- **One behavior per cycle** — vertical tracer bullets, never all-tests-then-all-code.
- **Test observable behavior** through the public interface, not implementation details.
- **A test only counts** once you've watched it fail for the *right* reason.

> Pure markdown, language- and framework-agnostic — the cycle is identical in any test runner.

## Core

| Topic | Description | Reference |
|-------|-------------|-----------|
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
