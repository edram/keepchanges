# gitchangelog

Generate and maintain `CHANGELOG.md` from Conventional Commits.

## Usage

Run the CLI in a Git repository:

```bash
pnpm dlx gitchangelog 1.1.0
```

This reads commits between the latest tag and `HEAD`, or the complete history
for a first release, then writes the new release before existing release
history in `CHANGELOG.md`. For npm packages, it also updates
`package.json#version`.

Repository links are inferred from `package.json#repository`, then from the
Git `origin`. When a GitHub repository is found, each entry links to its commit
and the release includes a comparison link to the requested version tag.

Commit authors and `Co-Authored-By` participants are included in each entry,
with bot accounts omitted. Authors use their Git names by default. Provide
`--token <token>`, `GITHUB_TOKEN`, or `GH_TOKEN` to resolve GitHub usernames.

Use a different output file:

```bash
pnpm dlx gitchangelog 1.1.0 --output docs/CHANGELOG.md
```

Preview without writing:

```bash
pnpm dlx gitchangelog 1.1.0 --dry
```

Write and commit the changelog:

```bash
pnpm dlx gitchangelog 1.1.0 --commit
```

The commit includes the changelog and any detected version file. Projects
without a supported version file commit only the changelog. The commit message
defaults to `chore(release): v1.1.0`.

Set its Git author without changing the committer configured for the repository:

```bash
pnpm dlx gitchangelog 1.1.0 --commit \
  --author "Release Author <release@example.com>"
```

Only the changelog and detected version file are committed. Other staged
changes remain staged.

Publish a repository release:

```bash
GITHUB_TOKEN=github_pat_xxx pnpm dlx gitchangelog 1.1.0 --release
```

The token is optional. Before publishing, the command prints the compared refs,
commit count, and complete release notes. Without a token, it prints a GitHub
URL with the title, notes, tag, and prerelease fields filled in for manual
publishing. Interactive terminals highlight refs and release statuses with
color.

When `v1.1.0` does not exist, the command updates the release files, creates or
reuses a release commit, creates an annotated tag, pushes `HEAD` and the tag to
`origin`, then creates the provider release. Unrelated working tree and staged
changes remain uncommitted.

When the tag already exists locally or on `origin`, it remains immutable. The
command generates notes from the previous release tag to `v1.1.0`, pushes a
missing remote tag when necessary, then creates or updates the existing
provider release. A local and remote tag with different targets causes the
release to stop without force-pushing.

Stable releases compare with the previous stable tag, while prereleases compare
with the nearest previous tag. Use `--release --dry` without a token to print
the release preview and prefilled manual URL without writing files, resolving
remote authors, committing, tagging, pushing, or calling the provider API.
Plain `--dry` continues to preview the complete changelog file.

The current release recognizes `feat` and `fix` commits, optional scopes,
breaking-change exclamation marks, and `BREAKING CHANGE` or
`BREAKING-CHANGE` trailers. Other commit types are ignored.

## Development

```bash
pnpm install
pnpm test
pnpm run typecheck
pnpm run build
```

## License

MIT
