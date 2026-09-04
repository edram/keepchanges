---
name: core-preflight
description: Decide whether TDD adds value, detect usable project test infrastructure, and ask before introducing it
---

## Usage

Run this preflight before writing a failing test or changing production code.

### 1. Decide whether TDD is warranted

Classify by regression value, not by file type or ritual. TDD is warranted when the task adds or changes observable behavior or reproduces a bug, and a test can catch a plausible implementation failure through a public interface.

Ask:

- What behavior should the test specify?
- What realistic implementation error would make it fail?
- Would it remain useful as a regression test after this change?

If the only signal is that a requested literal, metadata field, configuration value, or file content has not yet been edited, TDD adds no independent confidence. Prioritize the current task and use the cheapest relevant verification; do not manufacture RED with a command that merely checks the old value.

### 2. Detect usable test infrastructure

If TDD is warranted, inspect the project before choosing a framework or writing a test:

- project instructions and development documentation,
- manifests, dependencies, lock files, and test scripts,
- runner configuration, test directories, naming patterns, and nearby tests,
- build tooling and CI workflows relevant to the affected subsystem,
- the standard test command and current baseline, when it can be checked safely.

The project has usable test infrastructure when its existing runner can exercise the affected behavior without adding dependencies, configuration, environment support, or a new harness. Tests elsewhere in the repository do not prove the affected subsystem is covered; conversely, no nearby test does not prove a centralized harness is absent.

Reuse a usable setup and follow its conventions. If the relevant baseline cannot run or its failures cannot be separated from the new RED, surface that condition before proceeding instead of repairing or replacing infrastructure silently.

### 3. Ask before introducing infrastructure

When no usable setup exists, stop before changing production code, dependencies, configuration, lock files, or CI. Ask whether the user wants to:

- introduce project-appropriate test infrastructure, or
- continue the current task without TDD.

If the user declines, prioritize the current requirement, apply targeted direct verification, and report that TDD was not used.

If the user approves, inspect the actual project and present one decision-complete engineering plan—do not offer a generic framework menu. The plan must cover:

- the detected stack, constraints, and evidence behind the recommendation,
- one compatible test framework and why it fits the project,
- dependencies, lock-file impact, configuration, layout, naming, and standard commands,
- a minimal harness proof using real project code,
- the first genuine RED test for the current requirement and its expected failure,
- integration with existing build and CI only where the project already uses them,
- exact verification steps, affected files, risks, and rollout order.

Wait for approval of that plan. Once approved, land the infrastructure, prove the harness works, then continue the current requirement with RED → GREEN → REFACTOR.

## Key Points

- Existing tests are not enough; the setup must be usable for the affected behavior.
- No test setup is not a blocker when the user declines it—finish the current task with appropriate verification.
- An explicit user request or project rule can require TDD, but never invent a meaningless test; surface the conflict if no regression-worthy behavior exists.
- A failing command that only proves an edit is pending is not RED.

<!--
Source references:
- https://github.com/mattpocock/skills/blob/main/skills/engineering/tdd/SKILL.md
- https://github.com/obra/superpowers/blob/main/skills/test-driven-development/SKILL.md
- https://github.com/NousResearch/hermes-agent/blob/main/skills/software-development/test-driven-development/SKILL.md
-->
