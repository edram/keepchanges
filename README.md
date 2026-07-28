# keepchanges

Generate and maintain `CHANGELOG.md` from Conventional Commits.

[中文](#中文) · [English](#english)

## 中文

### 功能

- 根据最近的 Git tag 到 `HEAD` 之间的 Conventional Commits 生成变更记录
- 首次发布时读取完整 Git 历史
- 将新版本插入 `CHANGELOG.md` 的已有内容之前
- 为 npm 项目同步更新 `package.json` 中的 `version`
- 为提交、对比页面、作者和共同作者生成 GitHub 信息
- 可选择自动提交、创建 tag、推送并发布 GitHub Release
- 没有 GitHub token 时提供预填内容的手动发布链接

当前会收录 `feat`、`fix`、带 `!` 的破坏性变更，以及包含
`BREAKING CHANGE` 或 `BREAKING-CHANGE` trailer 的提交。其他提交类型会被忽略。

### 快速开始

需要 Node.js 20.19.0 或更高版本。

在 Git 仓库根目录运行，并传入要发布的版本号：

```bash
npx keepchanges 1.1.0
```

也可以使用带 `v` 前缀的版本号：

```bash
npx keepchanges v1.1.0
```

默认行为会写入 `CHANGELOG.md`。如果当前项目是 npm 包，还会将
`package.json#version` 更新为 `1.1.0`，但不会自动创建 Git commit。

### 命令格式

```text
npx keepchanges <version> [options]
```

#### 参数

| 参数 | 默认值 | 说明 |
| --- | --- | --- |
| `<version>` | 必填 | 要生成的版本号。可以传入 `1.1.0` 或 `v1.1.0`；生成的标题和 tag 统一使用 `v1.1.0`。包含 `-` 的版本会作为预发布版本，例如 `1.1.0-beta.1`。 |
| `--output <path>` | `CHANGELOG.md` | 指定 changelog 文件路径。相对路径以当前工作目录为基准。 |
| `--dry` | `false` | 只预览，不写入 changelog 或版本文件。单独使用时输出完整 changelog；与 `--release` 一起使用时输出 Release notes 和手动发布链接。 |
| `--commit` | `false` | 写入文件后创建 Git commit。只提交 changelog 和检测到的版本文件，默认提交信息为 `chore(release): v<version>`。 |
| `--release` | `false` | 执行完整发布流程：写入文件、创建或复用 release commit、创建 annotated tag、推送 `HEAD` 和 tag，然后创建或更新仓库 Release。该参数隐含 `--commit`。 |
| `--author <author>` | Git 默认作者 | 设置自动创建的 release commit 作者，格式必须为 `"Name <email>"`。只影响作者，不改变仓库配置的 committer；需要与 `--commit` 或 `--release` 一起使用。 |
| `--token <token>` | 环境变量 | 仓库访问令牌，用于解析 GitHub 用户名以及创建或更新 GitHub Release。优先级为 `--token`、`GITHUB_TOKEN`、`GH_TOKEN`。 |

### 常见用法

指定输出文件：

```bash
npx keepchanges 1.1.0 --output docs/CHANGELOG.md
```

预览完整 changelog，不修改文件：

```bash
npx keepchanges 1.1.0 --dry
```

写入 changelog、更新版本并创建 commit：

```bash
npx keepchanges 1.1.0 --commit
```

指定 release commit 的作者：

```bash
npx keepchanges 1.1.0 --commit \
  --author "Release Author <release@example.com>"
```

创建 GitHub Release：

```bash
GITHUB_TOKEN=github_pat_xxx npx keepchanges 1.1.0 --release
```

预览 Release，不写文件、不提交、不创建 tag、不推送且不调用发布 API：

```bash
npx keepchanges 1.1.0 --release --dry
```

### 生成和发布行为

仓库地址优先读取 `package.json#repository`，不存在时读取 Git 的 `origin`。
GitHub 地址会被自动识别。自托管 Gitea 需要在 `package.json` 中显式声明：

```json
{
  "repository": {
    "type": "git",
    "provider": "gitea",
    "url": "http://10.102.248.21/edram/keepchanges.git"
  }
}
```

识别到仓库后，每条记录会包含 commit 和 PR 链接，末尾会包含版本对比链接。
GitHub 和 Gitea 均支持作者解析和 Release 发布；Gitea 使用 `GITEA_TOKEN`
解析 commit 主作者并发布 Release。

默认使用 Git 提交中的作者名，并将 `Co-Authored-By` 参与者一起写入记录，bot
账号会被忽略。提供对应平台的 token 后，会尝试将邮箱解析为用户名。

`--commit` 只提交 changelog 和检测到的版本文件。其他已暂存或未暂存的改动会
保持原状。

`--release` 在 tag 不存在时：

1. 写入 changelog 并更新版本文件。
2. 创建或复用 release commit。
3. 创建 annotated tag。
4. 将 `HEAD` 和 tag 推送到 `origin`。
5. 创建 GitHub Release；没有 token 时输出手动发布链接。

`--release` 在 tag 已存在时不会移动 tag。它会根据前一个版本到现有 tag
重新生成 Release notes，并创建或更新 Release。只有远程存在 tag 时会先将它
拉取到本地；只有本地存在 tag 时会推送该 tag。本地与远程 tag 指向不同 commit
时会停止，不会强制覆盖。

稳定版本会与前一个稳定 tag 对比，预发布版本会与最近的前一个 tag 对比。与
`--release` 搭配的 `--dry` 优先级最高，不会执行任何写入或远程修改。

> [!NOTE]
> 没有 token 的普通 `--release` 仍会执行本地写入、commit、tag 和 push，
> 然后提供手动创建 GitHub Release 的链接。如需完全无副作用的预览，请使用
> `--release --dry`。

## English

### Features

- Generates release notes from Conventional Commits between the latest Git tag and `HEAD`
- Reads the complete Git history for a first release
- Inserts a new release before existing content in `CHANGELOG.md`
- Updates `package.json#version` for npm projects
- Adds GitHub commit links, comparison links, authors, and co-authors
- Can commit, tag, push, and publish a GitHub Release
- Provides a prefilled manual release URL when no GitHub token is available

The current release includes `feat`, `fix`, breaking changes marked with `!`,
and commits with a `BREAKING CHANGE` or `BREAKING-CHANGE` trailer. Other commit
types are ignored.

### Quick start

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

### Command

```text
npx keepchanges <version> [options]
```

#### Arguments and options

| Argument or option | Default | Description |
| --- | --- | --- |
| `<version>` | Required | Version to generate. Accepts `1.1.0` or `v1.1.0`; headings and tags use `v1.1.0`. A version containing `-`, such as `1.1.0-beta.1`, is treated as a prerelease. |
| `--output <path>` | `CHANGELOG.md` | Sets the changelog file path. Relative paths are resolved from the current working directory. |
| `--dry` | `false` | Previews without writing the changelog or version file. By itself it prints the complete changelog; with `--release` it prints the Release notes and manual release URL. |
| `--commit` | `false` | Creates a Git commit after writing. It commits only the changelog and detected version file, using `chore(release): v<version>` by default. |
| `--release` | `false` | Runs the complete release flow: writes files, creates or reuses a release commit, creates an annotated tag, pushes `HEAD` and the tag, then creates or updates the repository Release. This implies `--commit`. |
| `--author <author>` | Git default | Sets the author of the generated release commit in `"Name <email>"` format. It does not change the configured committer and only applies with `--commit` or `--release`. |
| `--token <token>` | Environment | Repository token used to resolve GitHub usernames and create or update a GitHub Release. Precedence is `--token`, `GITHUB_TOKEN`, then `GH_TOKEN`. |

### Examples

Write to a different file:

```bash
npx keepchanges 1.1.0 --output docs/CHANGELOG.md
```

Preview the complete changelog without changing files:

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

### Generation and release behavior

The repository URL is read from `package.json#repository`, then from the Git
`origin`. GitHub URLs are detected automatically. A self-hosted Gitea repository
must be declared explicitly in `package.json`:

```json
{
  "repository": {
    "type": "git",
    "provider": "gitea",
    "url": "http://10.102.248.21/edram/keepchanges.git"
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
5. Creates a GitHub Release, or prints a manual release URL without a token.

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
> pushes before providing the manual GitHub Release URL. Use `--release --dry`
> for a completely non-mutating preview.

## Development

```bash
pnpm install
pnpm test
pnpm run typecheck
pnpm run build
```

## License

MIT
