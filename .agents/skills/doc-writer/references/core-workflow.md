---
name: core-workflow
description: Evidence-first workflow for drafting and revising project-facing prose
---

## Usage

### Draft

1. **Inspect evidence.** Read only the repository sources relevant to the artifact: manifests,
   public interfaces, tests, existing docs, templates, and recent history.
2. **Set the contract.** Record the artifact, reader, outcome, assumed knowledge, language,
   canonical terms, and scope.
3. **Outline reader questions.** Order content by what the reader must know or do.
4. **Draft the shortest complete path.** Put prerequisites before actions and the recommended
   path before alternatives.
5. **Route depth.** Link advanced, operational, and contributor material where it would
   interrupt the primary path.
6. **Verify.** Check commands, paths, names, links, compatibility, claims, and stated results.
7. **Cold-read.** Review without relying on conversation context or author knowledge.

### Revise

Preserve facts, links, and intentional conventions. Make the narrowest changes that fix the
reader's problem:

- Move misplaced content before rewriting it.
- Merge passages only when they serve the same reader and purpose.
- Split a section when its audience, task, or detail level changes.
- Keep unrelated wording stable.

During the cold read, check that prerequisites precede actions, the recommended path is clear,
claims are supported, examples match their stated results, and no ambiguity, contradiction,
repetition, or required action is hidden.

For a review-only request, report findings by section and reader impact without rewriting.

## Key Points

- Repository evidence outranks a generic template; document current interfaces, not plans.
- Never claim a command, link, or test was checked unless it was actually checked.
- Writing or review does not authorize unrelated product changes.

<!--
Source references:
- https://github.com/getsentry/skills/blob/main/skills/doc-coauthoring/SKILL.md
-->
