# keepchanges

Generate and maintain `CHANGELOG.md` from Conventional Commits.

Inspired by [changelogithub](https://github.com/antfu-collective/changelogithub).

[简体中文](./README.zh-CN.md)

## Features

- Generates release notes from Conventional Commits between the latest Git tag and `HEAD`
- Reads the complete Git history for a first release
- Inserts a new release before existing content in `CHANGELOG.md`
- Updates `package.json#version` for npm projects
- Adds repository commit links, comparison links, authors, and co-authors
- Can commit, tag, push, and publish a GitHub or Gitea Release
- Provides a manual release URL when no GitHub/Gitea token is available

The current release includes `feat`, `fix`, `perf`, breaking changes marked with `!`,
and commits with a `BREAKING CHANGE` or `BREAKING-CHANGE` trailer. Other commit
types are ignored.

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

By default, the command writes `CHANGELOG.md`. For an npm package, it also
updates `package.json#version` to `1.1.0`, but it does not create a Git commit.

## Command

```text
npx keepchanges <version> [options]
```

### Arguments and options

| Argument or option | Default | Description |
| --- | --- | --- |
| `<version>` | Required | Version to generate. Accepts `1.1.0` or `v1.1.0`; headings and tags use `v1.1.0`. A version containing `-`, such as `1.1.0-beta.1`, is treated as a prerelease. |
| `--from <ref>` | Latest tag | Overrides the starting Git ref used to read commits. |
| `--to <ref>` | `HEAD` | Sets the ending Git ref. It cannot be combined with `--release`, and must resolve to the current `HEAD` when used with `--commit`. |
| `--repository <source>` | Auto-detected | Sets a GitHub `owner/repo` slug or a complete GitHub/Gitea URL. It takes precedence over `package.json` and `origin`. |
| `--output <path>` | `CHANGELOG.md` | Sets the changelog file path. Relative paths are resolved from the current working directory. |
| `--dry` | `false` | Prints the current release preview without writing files or performing commit, tag, push, or release API mutations. |
| `--commit` | `false` | Creates a Git commit after writing. It commits only the changelog and detected version file, using `chore(release): v<version>` by default. |
| `--release` | `false` | Runs the complete release flow: writes files, creates or reuses a release commit, creates an annotated tag, pushes `HEAD` and the tag, then creates or updates the repository Release. This implies `--commit`. |
| `--author <author>` | Release bot | Sets the generated release commit author in `"Name <email>"` format; requires `--commit` or `--release`. |
| `-t, --token <token>` | Environment | Resolves authors and publishes Releases. GitHub precedence is `--token`, `GITHUB_TOKEN`, then `GH_TOKEN`; Gitea uses `GITEA_TOKEN`. |
| `--name <name>` | Version tag | Sets the remote Release name; only valid with `--release`. |
| `-d, --draft` | `false` | Creates a draft Release; only valid with `--release`. |
| `--prerelease` | Inferred | Explicitly marks a prerelease. By default it is inferred from `-` in the version; only valid with `--release`. |
| `--emoji` | `true` | Controls section title emojis. As with changelogithub, CAC's `--no-emoji` form disables them. |
| `--capitalize` | `true` | Controls entry capitalization; `--no-capitalize` disables it. |
| `--group` | `true` | Groups repeated scopes; `--no-group` disables it. |

## Examples

Write to a different file:

```bash
npx keepchanges 1.1.0 --output docs/CHANGELOG.md
```

Preview the current release without changing files:

```bash
npx keepchanges 1.1.0 --dry
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

Create a GitHub Release:

```bash
GITHUB_TOKEN=github_pat_xxx npx keepchanges 1.1.0 --release
```

Preview a Release without writing, committing, tagging, pushing, or calling the
release API:

```bash
npx keepchanges 1.1.0 --release --dry
```

## Generation and release behavior

The repository is read from `--repository`, then `package.json#repository`, and
finally the Git `origin`. GitHub URLs are detected automatically. A self-hosted Gitea repository
must be declared explicitly in `package.json`:

```json
{
  "repository": {
    "type": "git",
    "provider": "gitea",
    "url": "https://gitea.example.com/edram/keepchanges.git"
  }
}
```

When a repository is detected, entries include commit and pull request links,
and the release ends with a version comparison link. GitHub and Gitea both
support author resolution and Release publishing. Gitea uses `GITEA_TOKEN` to
resolve primary commit authors and publish Releases.

Entries use Git author names by default and include `Co-Authored-By`
participants. Bot accounts are omitted. With the corresponding provider token,
the CLI attempts to resolve email addresses to usernames.

`--commit` commits only the changelog and detected version file. Other staged
and unstaged changes remain untouched.

When the tag does not exist, `--release`:

1. Writes the changelog and updates the version file.
2. Creates or reuses a release commit.
3. Creates an annotated tag.
4. Pushes `HEAD` and the tag to `origin`.
5. Creates a repository Release, or prints a manual URL without a GitHub/Gitea token.

When the tag already exists, `--release` never moves it. It regenerates Release
notes from the previous version to the existing tag and creates or updates the
Release. A remote-only tag is fetched, while a local-only tag is pushed. The
command stops without force-updating when local and remote tags point to
different commits.

Stable releases compare with the previous stable tag. Prereleases compare with
the nearest previous tag. With `--release`, `--dry` takes precedence and
prevents all file writes and remote mutations.

> [!NOTE]
> A regular `--release` without a token still writes files, commits, tags, and
> pushes before providing the manual Release URL. Use `--release --dry`
> for a completely non-mutating preview.

## Programmatic API

The package root exports `generateChangelog`, the commit parser, default config,
and core types. The CLI is only available as the `keepchanges` binary, while
programmatic callers can provide changelog style overrides:

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
