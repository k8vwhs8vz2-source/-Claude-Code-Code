# 2026-06-12 WeChat Codex Bridge Notes

这份原始长文档已经拆分成更容易维护的结构。保留本文件是为了避免旧链接失效。

请从下面几个文件继续阅读：

- [Overview](overview.md)：项目目标、参考来源、当前边界。
- [Implementation Notes](implementation-notes.md)：Codex CLI contract、路由设计、代码实现、验证方式。
- [Troubleshooting](troubleshooting.md)：实际遇到的问题和解决办法。
- [Roadmap](roadmap.md)：后续可做的增强项。
- [Upstream Reference](../references/upstream.md)：参考项目说明。
- [Sanitized Code Snapshot](../code/wechat-claude-code-codex-extension/README.md)：脱敏关键代码文件。

当前结论：

```text
普通微信消息       -> Claude Code
/codex <你的问题> -> Codex CLI
```

MVP 已跑通，可日常试用。本文档仓库不包含 bot token、二维码、session、日志、微信账号数据或本机私密文件。
