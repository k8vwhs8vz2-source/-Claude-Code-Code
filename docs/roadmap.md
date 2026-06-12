# Roadmap

## Current status

MVP 已完成：

```text
普通消息 -> Claude Code
/codex ... -> Codex CLI
Codex 结果 -> 微信
Codex 轻量进度反馈 -> 微信
桥内审批/权限疑似等待提醒 -> 微信
```

## Next steps

### 1. Windows status / stop 命令

目标：避免重复桥进程。

建议能力：

- 查看当前桥进程。
- 区分桥进程和 Codex Desktop Node runtime。
- 停止旧桥进程。
- 防止同一账号被多个桥进程同时轮询。

### 2. Codex doctor 检查

目标：桥启动时提前发现 Codex CLI 不可用。

建议检查：

```powershell
codex exec --help
codex exec --json --skip-git-repo-check --cd <cwd> "ping"
```

### 3. Codex binary 配置化

目标：不要依赖固定版本路径。

优先级：

```text
CODEX_BIN
自动查找 <USER_HOME>\.codex\packages\standalone\releases
PATH 中的 codex
```

### 4. 桌面端全局审批 watcher

当前审批提醒只覆盖“通过微信桥启动的 Codex 任务”。

未来 watcher 可以：

```text
监听 Codex / Claude 的日志、进程输出或状态文件
识别 waiting-for-approval
调用现有 WeChat sendmessage
只提醒用户回电脑确认，不自动批准
```

### 5. Codex JSONL 状态翻译

可以继续把 Codex JSONL 中的 todo / command / file-change 状态翻译成短消息。

原则：

```text
只推送对手机用户有决策价值的信息。
不推送原始 JSON、内部推理、工具参数、命令噪声。
```
