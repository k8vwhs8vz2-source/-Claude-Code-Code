# Implementation Notes

本文说明微信到 Codex CLI 路径的技术实现。

## Codex CLI 兼容性结论

Codex 不能直接按 Claude Code 的 `--output-format stream-json` 协议替换。Codex 自动化入口应使用：

```powershell
codex exec --json --skip-git-repo-check --cd <cwd> <prompt>
```

Codex JSONL 更像状态事件流，不是 Claude 的逐 token 文本流。

核心事件：

```text
thread.started      -> 获取 thread_id
turn.started        -> 一轮开始
item.completed      -> 完成某个 item，agent_message 里有最终文本
turn.completed      -> 一轮成功结束，可含 usage
turn.failed / error -> 失败状态
```

## Adapter contract

```ts
interface CodexQueryOptions {
  prompt: string;
  cwd: string;
  resume?: string;
  model?: string;
  abortController?: AbortController;
  onAttention?: (message: string) => Promise<void> | void;
}

interface CodexQueryResult {
  text: string;
  threadId?: string;
  error?: string;
}
```

解析规则：

- 保存 `thread.started.thread_id`。
- 拼接 completed `agent_message` 的 `item.text`。
- `turn.completed` 表示完成。
- `turn.failed` / `error` 转成桥接层错误。
- stderr 只当诊断信息，不拼进用户回复。

## 路由设计

```text
/codex <内容>  -> Codex CLI
/claude <内容> -> Claude Code
普通文字       -> Claude Code
```

## 微信端反馈逻辑

Codex CLI 当前不适合假装逐字流式，所以采用轻量反馈：

```text
收到 /codex
-> 立即发：Codex 收到，正在处理。
-> startTyping
-> 运行 codex exec --json
-> 90 秒无最终结果时发：Codex 还在处理，这次可能需要久一点。
-> 如检测到权限/审批/沙箱等待，发：Codex 可能正在等待你在电脑端确认，请回电脑查看。
-> 最终发干净的 agent_message
```

## 关键代码

脱敏后的关键文件：

- [Codex provider](../code/wechat-claude-code-codex-extension/src/codex/provider.ts)
- [main integration snippet](../code/wechat-claude-code-codex-extension/src/main.codex-snippet.ts)
- [router snippet](../code/wechat-claude-code-codex-extension/src/commands/router.codex-snippet.ts)
- [session snippet](../code/wechat-claude-code-codex-extension/src/session.codex-snippet.ts)

## 验证

```powershell
npm.cmd run build
npm.cmd test
```

测试覆盖：

```text
needsUserAttention detects approval and permission waits
needsUserAttention ignores ordinary progress text
cleanCodexText removes internal skill chatter
cleanCodexText preserves normal user-facing text
/codex routes the rest of the message to Codex
/codex without a prompt returns usage text
```
