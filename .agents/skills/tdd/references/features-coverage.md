---
name: features-coverage
description: Choose the right test type, cover edges and errors, enforce the RED gate, and leave a verifiable evidence trail
---

## Usage

Match the test type to what you're verifying:

| Type | Verifies | Examples |
|------|----------|----------|
| Unit | one unit in isolation | pure logic, helpers, edge cases |
| Integration | units working together across a boundary | API endpoints, DB access, service calls |
| E2E | a full flow through the running system | critical journeys like login, checkout |

Spend effort where the risk is — critical paths and complex logic — not chasing a number on trivial code. Cover edges, errors, and boundaries, not just the happy path. A coverage target (say 80%) is a floor that *surfaces* untested code, not a goal that *proves* correctness.

**The RED gate** — a test only counts as RED once it has **compiled, executed, and failed for the intended reason**:

- *Runtime RED*: the test runs and the assertion fails because the behavior is missing.
- *Compile-time RED*: the test references code that doesn't exist yet, so it won't compile — that compile failure is the intended signal.
- A test that was written but never run is **not** RED. "I wrote the test" ≠ "I watched it fail".

**Evidence trail** (optional, for a verifiable history) — commit at each checkpoint and keep the sequence intact:

```
test: add failing test for <behavior>      # RED, committed
feat: implement <behavior>                 # GREEN
refactor: <cleanup>                        # still green
```

Preserve the failing-then-passing order in history (don't squash it away) when the proof matters — most of all for a bug-fix reproducer, where the failing test *is* the bug report.

## Key Points

- Coverage counts lines executed, not behaviors verified — 100% coverage with weak assertions still proves little.
- The RED gate is what separates TDD from "tests exist after the fact": the failure you observed is the evidence the test works.
- Pick the lowest test level that can actually catch the bug — a unit test is faster and more precise than an E2E test for the same logic.

<!--
Source references:
- https://github.com/affaan-m/ECC/blob/main/skills/tdd-workflow/SKILL.md
- https://github.com/obra/superpowers/blob/main/skills/test-driven-development/SKILL.md
-->
