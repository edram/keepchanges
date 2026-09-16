# keepchanges

面向 Conventional Commits 的发布 CLI：生成并维护 changelog，并按需更新项目版本、
创建 release commit 和 Git tag、发布 GitHub/Gitea Release，以及上传 GitHub Release 附件。

灵感来自 [changelogithub](https://github.com/antfu-collective/changelogithub)。

[English](./README.md)

## 功能

- 根据 Git tag 之间的 Conventional Commits 生成 Release notes
- 将新版本插入现有 `CHANGELOG.md`，并为 npm 项目更新 `package.json#version`
- 可分别通过 `--no-bump` 和 `--no-changelog` 关闭版本更新与 changelog 写入
- 可自动创建 release commit、annotated tag 并推送到远程仓库
- 支持先固定 release commit，再基于该 commit 构建产物
- 可创建或更新 GitHub/Gitea Release
- 可将文件、目录或 glob 匹配结果上传为 GitHub Release 附件
- 为 commit、PR、版本对比、作者和共同作者生成仓库平台信息

当前会收录 `feat`、`fix`、`perf`、带 `!` 的破坏性变更，以及包含
`BREAKING CHANGE` 或 `BREAKING-CHANGE` trailer 的提交。其他提交类型会被忽略。

## 快速开始

需要 Node.js 20.19.0 或更高版本。

在 Git 仓库根目录运行，并传入要发布的版本号：

```bash
npx keepchanges 1.1.0
```

版本号也可以包含 `v` 前缀：

```bash
npx keepchanges v1.1.0
```

默认会写入 `CHANGELOG.md`。如果当前项目是 npm 包，还会将
`package.json#version` 更新为 `1.1.0`，但不会创建 Git commit。

## 发布工作流

keepchanges 可以根据项目的版本管理和构建方式组合发布阶段：

| 场景 | 更新版本 | 写入 changelog | 构建时机 | 发布方式 |
| --- | --- | --- | --- | --- |
| 完整版本发布 | 是 | 是 | 创建 release commit 后 | `--tag`，构建，再 `--release --asset` |
| 外部管理版本 | 否 | 是 | 发布前 | 构建，再 `--release --no-bump --asset` |
| 仅发布构建产物 | 否 | 否 | 发布前 | 构建，再 `--release --no-bump --no-changelog --asset` |

### 完整版本发布

先由 keepchanges 更新版本和 changelog、创建 commit 和 tag，再基于该 commit
构建产物。随后发布同一个 tag，并上传构建产物：

```bash
npx keepchanges 1.1.0 --tag
pnpm build
GITHUB_TOKEN=github_pat_xxx npx keepchanges 1.1.0 --release --asset dist
```

第二次执行会复用已有 tag，不会移动 tag 或重新提交构建产物。

### 保留 changelog，跳过版本更新

如果版本由其他工具或流程管理，可以先构建，再让 keepchanges 写入 changelog、
创建 commit 和 tag，并发布附件：

```bash
pnpm build
GITHUB_TOKEN=github_pat_xxx npx keepchanges 1.1.0 --release \
  --no-bump \
  --asset dist
```

### 只发布构建产物

如果不需要版本更新和 changelog，可以先构建，再从当前 `HEAD` 创建 tag 和 Release：

```bash
pnpm build
GITHUB_TOKEN=github_pat_xxx npx keepchanges 1.1.0 --release \
  --no-bump \
  --no-changelog \
  --asset dist
```

## GitHub Release 附件

`--asset` 支持单个文件、目录和 glob。目录会递归展开；该参数可以重复使用，
因此可以同时上传多个文件夹或匹配结果：

```bash
GITHUB_TOKEN=github_pat_xxx npx keepchanges 1.1.0 --release \
  --asset 'packages/*/dist' \
  --asset artifacts \
  --asset checksums.txt
```

建议始终给 glob 加引号，确保由 keepchanges 而不是 shell 展开。发布前会验证所有
附件：路径必须存在、glob 必须至少匹配一个文件，并且最终文件名必须唯一。
更新已有 Release 时，同名附件会被替换。

附件上传目前只支持 GitHub，并且必须提供 GitHub token。token 的读取顺序为
`--token`、`GITHUB_TOKEN`、`GH_TOKEN`。如果没有指定 `--asset`，则普通
`--release` 可以在没有 token 时完成 commit、tag 和 push，随后输出手动发布链接。

## 常见任务

指定 changelog 文件：

```bash
npx keepchanges 1.1.0 --output docs/CHANGELOG.md
```

预览结果，不修改文件或远程仓库：

```bash
npx keepchanges 1.1.0 --dry
npx keepchanges 1.1.0 --release --dry
```

写入 changelog、更新版本并创建 commit：

```bash
npx keepchanges 1.1.0 --commit
```

指定 release commit 作者：

```bash
npx keepchanges 1.1.0 --commit \
  --author "Release Author <release@example.com>"
```

创建不带附件的 GitHub Release：

```bash
GITHUB_TOKEN=github_pat_xxx npx keepchanges 1.1.0 --release
```

使用无前缀或 package 专属版本 tag：

```bash
npx keepchanges 1.1.0 --no-tag-prefix
npx keepchanges 1.1.0 --tag-prefix 'package@'
```

重新生成历史版本：

```bash
npx keepchanges 1.0.0 --to 1.0.0 --dry
```

## 命令参考

```text
npx keepchanges <version> [options]
```

| 参数 | 默认值 | 说明 |
| --- | --- | --- |
| `<version>` | 必填 | 要生成的版本号，例如 `1.1.0`、`v1.1.0` 或 `1.1.0-beta.1`。 |
| `--from <ref>` | 根据目标推断 | 指定读取 commit 时不包含在结果中的起始 Git ref。 |
| `--to <ref>` | `HEAD` | 指定结束 Git ref。不能与 `--tag` 或 `--release` 一起使用。 |
| `--repository <source>` | 自动检测 | 指定 GitHub `owner/repo` 或 GitHub/Gitea 完整 URL。 |
| `--output <path>` | `CHANGELOG.md` | 指定 changelog 文件路径。 |
| `--dry` | `false` | 输出预览，不执行文件写入、commit、tag、push 或发布 API。 |
| `--commit` | `false` | 写入后创建 Git commit。 |
| `--tag` | `false` | 写入、commit、创建 annotated tag 并 push，但不创建仓库 Release。 |
| `--release` | `false` | 完成 commit、tag、push，并创建或更新仓库 Release；隐含 `--commit`。 |
| `--asset <path>` | 无 | 上传 GitHub Release 附件；支持文件、目录、glob 和重复传参。需要 `--release` 和 GitHub token。 |
| `--bump` / `--no-bump` | `true` | 控制是否更新检测到的项目版本文件。 |
| `--changelog` / `--no-changelog` | `true` | 控制是否写入 changelog；关闭后仍会生成 Release notes。 |
| `--author <author>` | release bot | 指定 release commit 作者，格式为 `"Name <email>"`。 |
| `-t, --token <token>` | 环境变量 | 指定仓库访问令牌，用于解析作者和发布 Release。 |
| `--tag-prefix <prefix>` | `v` | 指定查找和创建版本 tag 时使用的前缀。 |
| `--no-tag-prefix` | `false` | 查找和创建不带前缀的版本 tag。 |
| `--name <name>` | 版本 tag | 指定远程 Release 名称；仅适用于 `--release`。 |
| `-d, --draft` | `false` | 创建 draft Release；仅适用于 `--release`。 |
| `--prerelease` | 根据版本推断 | 标记 prerelease；仅适用于 `--release`。 |
| `--emoji` / `--no-emoji` | `true` | 控制 section 标题 emoji。 |
| `--capitalize` / `--no-capitalize` | `true` | 控制 changelog 条目首字母大写。 |
| `--group` / `--no-group` | `true` | 控制重复 scope 分组。 |

## 行为说明

### Changelog 和仓库信息

省略 `--from` 时，keepchanges 会查找目标之前匹配 tag 前缀的最近版本 tag。
如果不存在前一个 tag，则从首个可达 commit 开始读取。稳定版本与前一个稳定 tag
对比，预发布版本与最近的前一个 tag 对比。

仓库地址依次读取 `--repository`、`package.json#repository` 和 Git `origin`。
识别仓库后，记录会包含 commit 和 PR 链接，末尾会包含版本对比链接。默认使用
Git 作者名并包含 `Co-Authored-By` 参与者；提供平台 token 后，会尝试将邮箱解析为
用户名。bot 账号会被忽略。

自托管 Gitea 仓库需要在 `package.json` 中显式声明：

```json
{
  "repository": {
    "type": "git",
    "provider": "gitea",
    "url": "https://gitea.example.com/edram/keepchanges.git"
  }
}
```

GitHub 和 Gitea 均支持作者解析与 Release 发布。Gitea 使用 `GITEA_TOKEN`，
但目前不支持附件上传。

### Tag 和历史范围

版本 tag 默认使用 `v` 前缀。配置的前缀会应用于 tag 创建和查找、版本形式的
`--from` 和 `--to`、比较链接及 Release 名称。分支名、commit hash 和 `HEAD`
等非版本 ref 保持不变。不同前缀的 tag 序列彼此独立。

显式传入 `--to` 而不传 `--from` 时，会相对于该目标查找前一个匹配的 tag，
而不是使用当前 `HEAD` 的最近 tag。与 `--commit` 一起使用时，`--to` 必须指向
当前 `HEAD`。

### Commit 和发布安全

`--commit` 只提交 changelog 和检测到的版本文件，其他已暂存或未暂存的改动会
保持原状。

`--release` 会复用已有 tag，重新生成该版本的 Release notes，并创建或更新
Release。远程独有的 tag 会被拉取，本地独有的 tag 会被推送；本地和远程 tag
指向不同 commit 时会停止，不会强制覆盖或移动 tag。

`--dry` 优先于其他选项，不会执行任何文件写入或远程修改。未指定 `--asset` 且
没有平台 token 时，`--release` 仍会执行本地写入、commit、tag 和 push，随后
提供手动创建或编辑 Release 的链接。

## 程序化 API

包根入口导出 `generateChangelog`、commit parser、默认配置及核心类型。
CLI 仅作为 `keepchanges` 二进制命令。程序化调用可以覆盖 changelog 样式：

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
