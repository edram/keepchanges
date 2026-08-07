# keepchanges

基于 Conventional Commits 生成并维护 `CHANGELOG.md`。

灵感来自 [changelogithub](https://github.com/antfu-collective/changelogithub)。

[English](./README.md)

## 功能

- 根据最近的 Git tag 到 `HEAD` 之间的 Conventional Commits 生成变更记录
- 首次发布时读取完整 Git 历史
- 将新版本插入 `CHANGELOG.md` 的已有内容之前
- 为 npm 项目同步更新 `package.json` 中的 `version`
- 为提交、对比页面、作者和共同作者生成仓库平台信息
- 可选择自动提交、创建 tag、推送并发布 GitHub/Gitea Release
- 没有 GitHub/Gitea token 时提供手动发布链接

当前会收录 `feat`、`fix`、`perf`、带 `!` 的破坏性变更，以及包含
`BREAKING CHANGE` 或 `BREAKING-CHANGE` trailer 的提交。其他提交类型会被忽略。

## 快速开始

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

## 命令格式

```text
npx keepchanges <version> [options]
```

### 参数

| 参数 | 默认值 | 说明 |
| --- | --- | --- |
| `<version>` | 必填 | 要生成的版本号。可以传入 `1.1.0` 或 `v1.1.0`；生成的标题和 tag 统一使用 `v1.1.0`。包含 `-` 的版本会作为预发布版本，例如 `1.1.0-beta.1`。 |
| `--from <ref>` | 最近的 tag | 指定读取 commit 的起始 Git ref，并覆盖自动选择结果。 |
| `--to <ref>` | `HEAD` | 指定读取 commit 的结束 Git ref。不能与 `--release` 一起使用；与 `--commit` 一起使用时必须指向当前 `HEAD`。 |
| `--repository <source>` | 自动检测 | 指定 `owner/repo` 格式的 GitHub 仓库或 GitHub/Gitea 完整 URL。优先级高于 `package.json` 和 `origin`。 |
| `--output <path>` | `CHANGELOG.md` | 指定 changelog 文件路径。相对路径以当前工作目录为基准。 |
| `--dry` | `false` | 输出当前版本预览，不写入文件，也不执行 commit、tag、push 或发布 API。 |
| `--commit` | `false` | 写入文件后创建 Git commit。只提交 changelog 和检测到的版本文件，默认提交信息为 `chore(release): v<version>`。 |
| `--release` | `false` | 执行完整发布流程：写入文件、创建或复用 release commit、创建 annotated tag、推送 `HEAD` 和 tag，然后创建或更新仓库 Release。该参数隐含 `--commit`。 |
| `--author <author>` | release bot | 设置自动创建的 release commit 作者，格式必须为 `"Name <email>"`；需要与 `--commit` 或 `--release` 一起使用。 |
| `-t, --token <token>` | 环境变量 | 仓库访问令牌，用于解析作者及发布 Release。GitHub 优先级为 `--token`、`GITHUB_TOKEN`、`GH_TOKEN`；Gitea 使用 `GITEA_TOKEN`。 |
| `--name <name>` | 版本 tag | 设置远程 Release 名称；仅适用于 `--release`。 |
| `-d, --draft` | `false` | 创建 draft Release；仅适用于 `--release`。 |
| `--prerelease` | 根据版本推断 | 显式标记为 prerelease；默认根据版本是否包含 `-` 推断，仅适用于 `--release`。 |
| `--emoji` | `true` | 控制 section 标题 emoji。与 changelogithub 一样，可使用 CAC 的 `--no-emoji` 形式关闭。 |
| `--capitalize` | `true` | 控制 changelog 条目首字母大写；可使用 `--no-capitalize` 关闭。 |
| `--group` | `true` | 当 scope 重复时分组；可使用 `--no-group` 关闭。 |

## 常见用法

指定输出文件：

```bash
npx keepchanges 1.1.0 --output docs/CHANGELOG.md
```

预览当前版本，不修改文件：

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

## 生成和发布行为

仓库地址优先读取 `--repository`，其次读取 `package.json#repository`，最后读取 Git 的 `origin`。
GitHub 地址会被自动识别。自托管 Gitea 需要在 `package.json` 中显式声明：

```json
{
  "repository": {
    "type": "git",
    "provider": "gitea",
    "url": "https://gitea.example.com/edram/keepchanges.git"
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
5. 创建仓库 Release；GitHub/Gitea 没有 token 时输出手动发布链接。

`--release` 在 tag 已存在时不会移动 tag。它会根据前一个版本到现有 tag
重新生成 Release notes，并创建或更新 Release。只有远程存在 tag 时会先将它
拉取到本地；只有本地存在 tag 时会推送该 tag。本地与远程 tag 指向不同 commit
时会停止，不会强制覆盖。

稳定版本会与前一个稳定 tag 对比，预发布版本会与最近的前一个 tag 对比。与
`--release` 搭配的 `--dry` 优先级最高，不会执行任何写入或远程修改。手动链接
会为新 tag 打开创建 Release 页面，为已有 tag 打开编辑页面。

> [!NOTE]
> 没有 token 的普通 `--release` 仍会执行本地写入、commit、tag 和 push，
> 然后提供手动创建 Release 的链接。如需完全无副作用的预览，请使用
> `--release --dry`。

## 程序化 API

包根入口导出 `generateChangelog`、commit parser、默认配置及核心类型。
CLI 仅作为 `keepchanges` 二进制命令。程序化调用可以传入 changelog 样式覆盖：

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

## 开发

```bash
pnpm install
pnpm test
pnpm run typecheck
pnpm run build
```

## 许可证

MIT
