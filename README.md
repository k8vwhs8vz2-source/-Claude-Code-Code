# WeChat Claude Code / Codex Bridge

这是一次把现有 **WeChat -> Claude Code** 桥扩展为 **同一微信入口同时访问 Claude Code 与 Codex CLI** 的调研、实现和复盘记录。

最终交互方式：

```text
普通微信消息       -> Claude Code
/codex <你的问题> -> Codex CLI
```

当前状态：MVP 已跑通，可日常试用。

已完成：

- 复用原 `wechat-claude-code` 的微信协议层。
- 新增 `/codex` 路由，不破坏默认 Claude Code 入口。
- 在 Windows 上验证 Codex CLI 的非交互 JSONL 输出格式。
- 新增 Codex provider，解析 `codex exec --json` 输出。
- 保存 Codex `thread_id`，用于后续会话恢复。
- 为 Codex 微信路径加入轻量反馈：收到、处理中、疑似等待电脑端确认。
- 记录重复回复问题的根因和解决方式。

主要文档：

- [完整实施与复盘记录](docs/wechat-codex-bridge-2026-06-12.md)

参考项目：

- [Wechat-ggGitHub/wechat-claude-code](https://github.com/Wechat-ggGitHub/wechat-claude-code)
