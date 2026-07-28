---
name: features-good-tests
description: Test observable behavior through the public interface, recognize the brittle-test smell, avoid testing anti-patterns, and mock sparingly
---

## Usage

Test observable behavior through the **public interface** — the *what*, not the *how*.

A good test reads like a specification: `user can check out with a valid cart` names a capability and survives any refactor of the internals. A test coupled to implementation — asserting on private methods, internal call order, or querying the database directly instead of going through the API — breaks when you rename or restructure, even though behavior is unchanged.

**The brittle-test smell:** you refactor, behavior is identical, and a test goes red. That test was pinned to *structure*, not behavior. Raise its altitude to assert on the outcome; don't just patch it to match the new internals.

Anti-patterns:

- **Testing the mock, not the code** — asserting a stub was called instead of asserting the real result.
- **Testing implementation details** — internal helpers, call counts, field layout. Assert on outcomes a caller can observe.
- **Happy-path only** — cover edges, errors, and boundaries, not just the golden case.
- **Brittle tests** — verify behavior, not structure; a refactor that preserves behavior must not break them.

**Mocking:** prefer real code. Mock only what you genuinely can't run in a test — the network, the clock, a paid third-party API. Every mock is a guess about a collaborator, and that guess drifts from reality over time.

## Key Points

- "Hard to test" is a *design* signal, not a testing problem: code that's hard to test is usually hard to use. Listen to it and fix the interface.
- Verify through the same door a real caller uses — reaching around the interface (DB rows, private state) tests the wrong thing.
- If renaming an internal function turns a test red, that test was measuring implementation, not behavior.

<!--
Source references:
- https://github.com/mattpocock/skills/blob/main/skills/engineering/tdd/SKILL.md
- https://github.com/NousResearch/hermes-agent/blob/main/skills/software-development/test-driven-development/SKILL.md
-->
