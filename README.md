# WeChat Claude Code / Codex Bridge

这是一次把现有 **WeChat -> Claude Code** 桥扩展为 **同一微信入口同时访问 Claude Code 与 Codex CLI** 的调研、实现和复盘记录。

最终交互方式：

```text
普通微信消息       -> Claude Code
/codex <你的问题> -> Codex CLI
```

当前状态：MVP 已跑通，可日常试用。

## 文档

- [Overview](docs/overview.md)：项目目标、参考来源、当前边界。
- [Implementation Notes](docs/implementation-notes.md)：Codex CLI contract、路由设计、代码实现、验证方式。
- [Troubleshooting](docs/troubleshooting.md)：实际遇到的问题和解决办法。
- [Roadmap](docs/roadmap.md)：后续可做的增强项。
- [Upstream Reference](references/upstream.md)：参考项目说明。

旧版完整复盘链接仍保留为迁移页：

- [2026-06-12 原始复盘入口](docs/wechat-codex-bridge-2026-06-12.md)

## 代码

- [脱敏关键代码文件](code/wechat-claude-code-codex-extension/README.md)

仓库只保留复盘和脱敏代码，不包含 bot token、二维码、session、日志、微信账号数据或本机私密文件。

## 参考项目

- [Wechat-ggGitHub/wechat-claude-code](https://github.com/Wechat-ggGitHub/wechat-claude-code)
