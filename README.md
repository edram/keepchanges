# keepchanges

A release CLI for Conventional Commits. Generate and maintain a changelog, optionally bump
the project version, create a release commit and Git tag, publish a GitHub or Gitea Release,
and upload GitHub Release assets.

Inspired by [changelogithub](https://github.com/antfu-collective/changelogithub).

[简体中文](./README.zh-CN.md)

## Features

- Generates release notes from Conventional Commits between Git tags
- Inserts new releases into an existing `CHANGELOG.md` and updates `package.json#version`
  for npm projects
- Disables version bumps and changelog writes independently with `--no-bump` and
  `--no-changelog`
- Creates release commits and annotated tags, then pushes them to the remote repository
- Supports building artifacts from a fixed release commit before publishing
- Creates or updates GitHub and Gitea Releases
- Uploads files, directories, or glob matches as GitHub Release assets
- Adds repository links for commits, pull requests, comparisons, authors, and co-authors

The current release includes `feat`, `fix`, `perf`, breaking changes marked with `!`,
and commits with a `BREAKING CHANGE` or `BREAKING-CHANGE` trailer. Other commit types
are ignored.

## Quick start

Node.js 20.19.0 or later is required.

Run the CLI at the root of a Git repository and provide the version to release:

```bash
npx keepchanges 1.1.0
```

The version may also include a leading `v`:

```bash
npx keepchanges v1.1.0
```

By default, the command writes `CHANGELOG.md`. For an npm package, it also updates
`package.json#version` to `1.1.0`, but it does not create a Git commit.

## Release workflows

Combine the release stages to match how your project manages versions and builds artifacts:

| Workflow | Bump version | Write changelog | Build timing | Release sequence |
| --- | --- | --- | --- | --- |
| Full version release | Yes | Yes | After creating the release commit | `--tag`, build, then `--release --asset` |
| Externally managed version | No | Yes | Before release | Build, then `--release --no-bump --asset` |
| Artifacts only | No | No | Before release | Build, then `--release --no-bump --no-changelog --asset` |

### Full version release

Let keepchanges update the version and changelog, then create the release commit and tag.
Build from that exact commit before publishing the same tag and uploading its artifacts:

```bash
npx keepchanges 1.1.0 --tag
pnpm build
GITHUB_TOKEN=github_pat_xxx npx keepchanges 1.1.0 --release --asset dist
```

The second command reuses the existing tag. It does not move the tag or commit the artifacts.

### Changelog without a version bump

If another tool or workflow manages the project version, build first, then let keepchanges
write the changelog, create the commit and tag, and publish the assets:

```bash
pnpm build
GITHUB_TOKEN=github_pat_xxx npx keepchanges 1.1.0 --release \
  --no-bump \
  --asset dist
```

### Artifacts only

If the release needs neither a version update nor a changelog write, build first, then create
the tag and Release from the current `HEAD`:

```bash
pnpm build
GITHUB_TOKEN=github_pat_xxx npx keepchanges 1.1.0 --release \
  --no-bump \
  --no-changelog \
  --asset dist
```

## GitHub Release assets

`--asset` accepts a file, directory, or glob. Directories are traversed recursively, and the
option is repeatable, so one release can include multiple folders or match sets:

```bash
GITHUB_TOKEN=github_pat_xxx npx keepchanges 1.1.0 --release \
  --asset 'packages/*/dist' \
  --asset artifacts \
  --asset checksums.txt
```

Quote globs so keepchanges, rather than the shell, expands them consistently. Before publishing,
keepchanges verifies that every path exists, every glob matches at least one file, and all final
file names are unique. Updating an existing Release replaces assets with the same name.

Asset uploads currently support GitHub only and require a GitHub token. Token precedence is
`--token`, `GITHUB_TOKEN`, then `GH_TOKEN`. Without `--asset`, a regular `--release` can run
without a token: it commits, tags, and pushes before printing a manual Release URL.

## Common tasks

Write to a different changelog file:

```bash
npx keepchanges 1.1.0 --output docs/CHANGELOG.md
```

Preview without changing files or the remote repository:

```bash
npx keepchanges 1.1.0 --dry
npx keepchanges 1.1.0 --release --dry
```

Write the changelog, update the version, and create a commit:

```bash
npx keepchanges 1.1.0 --commit
```

Set the release commit author:

```bash
npx keepchanges 1.1.0 --commit \
  --author "Release Author <release@example.com>"
```

Create a GitHub Release without assets:

```bash
GITHUB_TOKEN=github_pat_xxx npx keepchanges 1.1.0 --release
```

Use version tags without a prefix or with a package-specific prefix:

```bash
npx keepchanges 1.1.0 --no-tag-prefix
npx keepchanges 1.1.0 --tag-prefix 'package@'
```

Regenerate a historical release:

```bash
npx keepchanges 1.0.0 --to 1.0.0 --dry
```

## Command reference

```text
npx keepchanges <version> [options]
```

| Argument or option | Default | Description |
| --- | --- | --- |
| `<version>` | Required | Version to generate, such as `1.1.0`, `v1.1.0`, or `1.1.0-beta.1`. |
| `--from <ref>` | Inferred from target | Sets the exclusive starting Git ref used to read commits. |
| `--to <ref>` | `HEAD` | Sets the ending Git ref. Cannot be combined with `--tag` or `--release`. |
| `--repository <source>` | Auto-detected | Sets a GitHub `owner/repo` slug or complete GitHub/Gitea URL. |
| `--output <path>` | `CHANGELOG.md` | Sets the changelog file path. |
| `--dry` | `false` | Prints a preview without writing files or performing commit, tag, push, or release API mutations. |
| `--commit` | `false` | Creates a Git commit after writing. |
| `--tag` | `false` | Writes, commits, creates an annotated tag, and pushes without creating a repository Release. |
| `--release` | `false` | Commits, tags, pushes, and creates or updates a repository Release; implies `--commit`. |
| `--asset <path>` | None | Uploads GitHub Release assets from files, directories, or globs. Repeatable; requires `--release` and a GitHub token. |
| `--bump` / `--no-bump` | `true` | Controls whether the detected project version file is updated. |
| `--changelog` / `--no-changelog` | `true` | Controls whether the changelog is written. Release notes are generated either way. |
| `--author <author>` | Release bot | Sets the release commit author in `"Name <email>"` format. |
| `-t, --token <token>` | Environment | Sets the repository access token used to resolve authors and publish Releases. |
| `--tag-prefix <prefix>` | `v` | Sets the prefix used to find and create version tags. |
| `--no-tag-prefix` | `false` | Finds and creates version tags without a prefix. |
| `--name <name>` | Version tag | Sets the remote Release name; only valid with `--release`. |
| `-d, --draft` | `false` | Creates a draft Release; only valid with `--release`. |
| `--prerelease` | Inferred | Marks a prerelease; only valid with `--release`. |
| `--emoji` / `--no-emoji` | `true` | Controls section title emojis. |
| `--capitalize` / `--no-capitalize` | `true` | Controls changelog entry capitalization. |
| `--group` / `--no-group` | `true` | Controls grouping for repeated scopes. |

## Behavior

### Changelog and repository metadata

Without `--from`, keepchanges finds the nearest earlier version tag that matches the configured
tag prefix. If no earlier tag exists, it reads from the first reachable commit. Stable releases
compare with the previous stable tag; prereleases compare with the nearest previous tag.

The repository is resolved from `--repository`, then `package.json#repository`, and finally the
Git `origin`. When a repository is available, entries include commit and pull request links, and
the release ends with a version comparison link. Entries use Git author names and include
`Co-Authored-By` participants. With a provider token, keepchanges attempts to resolve email
addresses to usernames. Bot accounts are omitted.

A self-hosted Gitea repository must be declared explicitly in `package.json`:

```json
{
  "repository": {
    "type": "git",
    "provider": "gitea",
    "url": "https://gitea.example.com/edram/keepchanges.git"
  }
}
```

GitHub and Gitea both support author resolution and Release publishing. Gitea uses
`GITEA_TOKEN`, but does not currently support asset uploads.

### Tags and history ranges

Version tags use the `v` prefix by default. The configured prefix applies to tag creation and
lookup, version-shaped `--from` and `--to` values, comparison links, and Release names. Branch
names, commit hashes, `HEAD`, and other non-version refs remain unchanged. Tag sequences with
different prefixes are independent.

When `--to` is provided without `--from`, keepchanges finds the previous matching tag relative
to that target instead of the current `HEAD`. With `--commit`, `--to` must resolve to the current
`HEAD`.

### Commit and release safety

`--commit` commits only the changelog and detected version file. Other staged and unstaged
changes remain untouched.

`--release` reuses an existing tag, regenerates its Release notes, and creates or updates the
Release. A remote-only tag is fetched, while a local-only tag is pushed. If local and remote
tags point to different commits, the command stops without force-updating or moving the tag.

`--dry` takes precedence over other options and prevents all file writes and remote mutations.
Without `--asset` and a provider token, `--release` still writes locally, commits, tags, and
pushes before printing a URL for manually creating or editing the Release.

## Programmatic API

The package root exports `generateChangelog`, the commit parser, default config, and core types.
The CLI is available only as the `keepchanges` binary. Programmatic callers can override the
changelog style:

```ts
import { generateChangelog } from 'keepchanges'

const result = generateChangelog(
  { version: '1.1.0', commits },
  {
    emoji: false,
    messages: { noSignificantChanges: 'Nothing noteworthy' },
  },
)
```

## Development

```bash
pnpm install
pnpm test
pnpm run typecheck
pnpm run build
```

## License

MIT
