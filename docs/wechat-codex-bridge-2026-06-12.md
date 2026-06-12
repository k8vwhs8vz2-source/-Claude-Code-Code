# WeChat Claude Code / Codex Bridge：调研、实现与问题复盘

日期：2026-06-12

本文记录一次本地桥接改造：在已经可用的 **微信 -> Claude Code** 桥基础上，增加 **微信 -> Codex CLI** 的访问能力，并尽量保持微信端体验像原项目一样干净、简洁、可理解。

最终目标不是替换 Claude Code，而是在同一个微信入口中同时保留两个能力：

```text
普通微信消息       -> Claude Code
/codex <你的问题> -> Codex CLI
```

当前状态：**MVP 已完成，可日常试用。**

本文和仓库中的代码均已脱敏：不包含 bot token、二维码、session、日志、微信账号数据或本机私密文件。

---

## 1. 参考项目

本次工作的主要参考项目是：

- [Wechat-ggGitHub/wechat-claude-code](https://github.com/Wechat-ggGitHub/wechat-claude-code)

这个项目已经证明：可以通过 OpenClaw / ClawBot 体系，把个人微信里的一个 Bot 会话桥接到电脑端的 Claude Code。

从原项目中借鉴的核心不是“简单转发消息”，而是它的产品逻辑：

- 微信端显示 typing 状态，让用户知道电脑端正在处理。
- Claude Code 的输出可以实时或分段推回微信。
- 只把适合手机阅读的内容发到微信。
- 尽量过滤工具调用、内部日志、原始 JSON、命令噪声。
- 支持文件和图片等微信能力。
- 保留本地 Claude Code 的工作目录、会话和工具能力。

这次 Codex 扩展遵循同一个原则：

> 微信端应该看到“已收到、正在处理、需要你注意、最终结果”，而不是看到底层 CLI 的原始事件流。

---

## 2. 已有条件与脱敏路径

用户原先已经完成微信到 Claude Code 的桥接，手机端主要做过扫码绑定，没有手工创建复杂的微信入口。

本机安装副本位置在文档中统一写成占位符：

```text
<USER_HOME>\.claude\skills\wechat-claude-code
<USER_HOME>\.agents\skills\wechat-claude-code
```

桥接运行数据目录：

```text
<USER_HOME>\.wechat-claude-code
```

WeChat bot 账号、token、session 均不进入仓库。

Claude Code 工作目录示例：

```text
<USER_HOME>\Documents\ClaudeCode
```

为 Codex 额外创建的长期工作目录示例：

```text
<USER_HOME>\Documents\CodexWeChat
```

---

## 3. 一开始要判断的问题

### 3.1 是否做两个微信入口？

早期设想是：

```text
微信 bot A -> Claude Code
微信 bot B -> Codex CLI
```

短期没有采用这个方案。

原因：

- 用户实际只通过一个 ClawBot / OpenClaw 插件扫码绑定。
- 当前桥已经稳定服务一个微信会话。
- 两个入口涉及微信侧是否允许多个 bot、OpenClaw 配置、账号绑定、推送上下文等不确定因素。
- 可行性验证阶段更应该减少微信侧变量。

因此短期方案改为：

```text
同一个微信入口
普通消息默认发给 Claude Code
/codex 前缀消息发给 Codex CLI
```

这样既能保留 Claude Code，又能访问 Codex。

### 3.2 Codex CLI 会不会和 Codex 桌面端冲突？

实际验证结果：Codex CLI 和 Codex 桌面端可以并行。CLI 作为命令行工具安装在用户目录下，桌面端是另一个应用表面。

本机验证到的 CLI 版本：

```text
Codex CLI 0.139.0
```

可靠可执行文件路径用脱敏形式表示：

```text
<USER_HOME>\.codex\packages\standalone\releases\<version>-x86_64-pc-windows-msvc\bin\codex.exe
```

重要问题：WindowsApps 里的 `codex.exe` 在本机环境中会返回 `Access is denied`，因此桥接层不能依赖 WindowsApps 路径。

---

## 4. Codex CLI 兼容性 Spike

为了让微信桥能可靠调用 Codex，先验证 Codex CLI 的非交互行为。

验证命令形态：

```powershell
codex exec --json --skip-git-repo-check --cd <USER_HOME>\Documents\CodexWeChat "用中文回复：Codex CLI 测试成功"
```

关键结论：

- Codex 不能直接按 Claude Code 的 `--output-format stream-json` 协议替换。
- Codex 的自动化入口是 `codex exec`。
- 加 `--json` 后，stdout 输出 JSONL，一行一个事件。
- Codex 的 JSONL 更像“状态事件流”，不是 Claude 的逐 token 文本流。
- 最终用户可见文本应从 `item.completed` 且 `item.type == "agent_message"` 中提取。
- `thread.started.thread_id` 可以作为后续 resume 的会话 ID。

观察到的核心事件：

```text
thread.started      -> 获取 thread_id
turn.started        -> 一轮开始
item.completed      -> 完成某个 item，agent_message 里有最终文本
turn.completed      -> 一轮成功结束，可含 usage
turn.failed / error -> 失败状态
```

桥接层应采用的安全 contract：

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

执行规则：

```text
新会话:
  codex exec --json --skip-git-repo-check --cd <cwd> <prompt>

续会话:
  codex exec --json --skip-git-repo-check --cd <cwd> resume <threadId> <prompt>
```

解析规则：

- 保存 `thread.started.thread_id`。
- 拼接 completed `agent_message` 的 `item.text`。
- `turn.completed` 表示完成。
- `turn.failed` / `error` 转成桥接层错误。
- stderr 只当诊断信息，不拼进用户回复。

---

## 5. 实现方案

### 5.1 路由设计

在命令路由中新增 `/codex`：

```text
/codex <内容>  -> Codex CLI
/claude <内容> -> Claude Code
普通文字       -> Claude Code
```

这样用户原来的 Claude Code 使用方式不受影响。

### 5.2 Provider 分离

没有把 Codex 塞进 Claude provider，而是新增独立的 Codex provider。

原因：

- 两者 CLI 参数不同。
- 两者输出协议不同。
- 两者会话恢复机制不同。
- 后续可以分别优化 Claude 流式和 Codex 事件翻译。

### 5.3 微信端反馈逻辑

Codex CLI 当前不适合假装逐字流式，所以中期方案是轻量反馈：

```text
收到 /codex
-> 立即发：Codex 收到，正在处理。
-> startTyping
-> 运行 codex exec --json
-> 90 秒无最终结果时发：Codex 还在处理，这次可能需要久一点。
-> 如检测到权限/审批/沙箱等待，发：Codex 可能正在等待你在电脑端确认，请回电脑查看。
-> 最终发干净的 agent_message
```

这保持了原项目“只推送关键状态”的思想。

---

## 6. 代码文件

脱敏后的关键代码文件已经放在：

- [code/wechat-claude-code-codex-extension](../code/wechat-claude-code-codex-extension/README.md)

这些文件不是完整 skill 备份，而是可复用的关键改造文件和片段。

包含：

```text
code/wechat-claude-code-codex-extension/src/codex/provider.ts
code/wechat-claude-code-codex-extension/src/main.codex-snippet.ts
code/wechat-claude-code-codex-extension/src/commands/router.codex-snippet.ts
code/wechat-claude-code-codex-extension/src/session.codex-snippet.ts
code/wechat-claude-code-codex-extension/src/tests/codex-attention.test.ts
code/wechat-claude-code-codex-extension/src/tests/codex-route.test.ts
```

刻意不上传：

```text
node_modules/
dist/
accounts/
sessions/
logs/
qrcode.png
bot token
context_token
微信用户 ID
本机绝对用户名路径
```

---

## 7. 实际代码改动说明

### 7.1 `src/codex/provider.ts`

新增 Codex provider，负责：

- 定位 Codex CLI 可执行文件。
- Windows 上优先查找官方 standalone release，或使用 `CODEX_BIN` 环境变量。
- 调用 `codex exec --json --skip-git-repo-check`。
- 解析 JSONL。
- 保存 `thread_id`。
- 提取最终 `agent_message`。
- 清理不适合发到微信的内部提示。
- 检测 approval / permission / sandbox / confirm 等需要用户注意的状态。

注意力检测关键词包括：

```text
approval
approve
permission
confirm
confirmation
sandbox
requires action
waiting for
需要/等待 + 批准/确认/授权/权限
```

触发后只提醒，不批准：

```text
Codex 可能正在等待你在电脑端确认，请回电脑查看。
```

### 7.2 `src/commands/router.ts`

新增 `/codex` 命令解析。

空命令会返回用法提示；带内容则把剩余文本交给 Codex provider。

### 7.3 `src/session.ts`

新增 Codex 会话字段和 provider-aware 历史记录。

核心字段：

```text
codexThreadId
provider label for chat messages
```

这样 Claude 的 `sdkSessionId` 和 Codex 的 `thread_id` 不会混在一起。

### 7.4 `src/main.ts`

新增 `sendToCodex()` 并接入主消息处理流程。

它负责：

- 设置会话为 processing。
- 保存用户消息到 Codex 历史。
- 开启 typing。
- 发送即时 ACK。
- 启动 90 秒静默提醒 timer。
- 调用 `codexQuery()`。
- 保存返回的 `threadId`。
- 发送最终结果。
- 处理错误和 abort。
- 清理 timer / typing / active controller。

---

## 8. 实际遇到的问题与解决

### 问题一：本机一开始没有 Codex CLI

解决：通过官方 Windows install script 安装 Codex CLI，并确认 `codex exec --json` 可运行。

### 问题二：WindowsApps 里的 `codex.exe` 不可用

现象：某些 PATH / WindowsApps 路径返回：

```text
Access is denied
```

解决：桥接层不要依赖 WindowsApps 路径。优先使用 `CODEX_BIN` 或用户目录下的 standalone release。

### 问题三：Codex 输出一开始有内部流程噪声

现象：第一次 Codex 输出里出现类似 skill / superpowers 的内部说明，不适合发到微信。

解决：

- 在 prompt 中明确要求只输出最终给用户看的内容。
- 在 `cleanCodexText()` 中过滤已观察到的内部 chatter。

### 问题四：`/codex` 一开始被 Claude 的 skill 系统当成未知 skill

现象：微信里输入 `/codex ...` 时，旧桥返回：

```text
未找到 skill: codex 输入 /skills 查看可用列表
```

原因：桥还没有重启，或旧进程仍在跑，旧版本并不知道 `/codex`。

解决：

- 编译新版本。
- 重启桥。
- 清理旧桥进程。

### 问题五：同一条消息先报错再成功

现象：微信里出现一条错误回复，然后又出现一条正常回复。

排查发现：有两个 `node.exe` 桥进程同时轮询同一个微信账号。

结果：同一条微信消息被两个桥处理。一个失败，一个成功。

解决：只停止旧桥进程，不杀 Codex Desktop 的 Node runtime，也不杀新桥。

不要执行：

```powershell
Stop-Process -Name node
```

因为 Codex Desktop 也使用 Node。

应只停确认过的旧桥 PID。

### 问题六：PowerShell `npm start` 被执行策略拦截

现象：

```text
npm.ps1 cannot be loaded because running scripts is disabled on this system
```

解决：使用：

```powershell
npm.cmd start
```

---

## 9. 验证结果

编译：

```powershell
npm.cmd run build
```

测试：

```powershell
npm.cmd test
```

结果：

```text
6 tests passed
0 failed
```

覆盖内容：

```text
needsUserAttention detects approval and permission waits
needsUserAttention ignores ordinary progress text
cleanCodexText removes internal skill chatter
cleanCodexText preserves normal user-facing text
/codex routes the rest of the message to Codex
/codex without a prompt returns usage text
```

微信手动验证：

```text
普通消息 -> Claude Code 正常回复
/codex 你在使用什么模型 -> Codex 收到，正在处理。 -> Codex 最终回复
```

---

## 10. 当前使用方式

启动桥：

```powershell
cd <USER_HOME>\.claude\skills\wechat-claude-code
npm.cmd start
```

微信里直接发普通消息：

```text
你好
```

默认走 Claude Code。

微信里发：

```text
/codex 你在使用什么模型
```

走 Codex CLI。

---

## 11. 当前边界

### 已完成

```text
普通消息 -> Claude Code
/codex ... -> Codex CLI
Codex 最终回复 -> 微信
Codex 即时反馈 -> 微信
Codex 长时间无结果提醒 -> 微信
桥内疑似审批/权限等待提醒 -> 微信
```

### 未完成

```text
Codex 桌面端单独任务的全局审批提醒
Claude Code 桌面端单独任务的全局审批提醒
Windows 后台守护/开机自启/防重复进程
Codex 更细粒度 JSONL 状态翻译
```

当前审批提醒只覆盖“通过微信桥启动的 Codex 任务”。如果用户在 Codex Desktop 里单独开任务，桥目前看不到桌面端 UI 的等待状态。

要做全局审批提醒，需要额外 watcher：

```text
watcher
-> 监听 Codex / Claude 的日志、进程输出或状态文件
-> 识别 waiting-for-approval
-> 调用现有 WeChat sendmessage
-> 只提醒用户回电脑确认，不自动批准
```

---

## 12. 设计原则总结

1. 不破坏原 Claude Code 路径。
2. 不强行做第二个微信入口，先用 `/codex` 在同一入口分流。
3. 不把 Codex 当成 Claude 的输出协议。
4. 微信端只发适合手机看的信息。
5. 审批只提醒，不代替用户批准。
6. Windows 上要小心进程和 PATH。

---

## 13. 后续建议

优先级从高到低：

1. 增加 Windows status / stop 命令，避免重复桥进程。
2. 启动时做 Codex doctor 检查，提前发现 CLI 不可用。
3. 把 Codex binary 路径做成配置项或环境变量。
4. 做桌面端全局审批 watcher。
5. 进一步翻译 Codex JSONL 中的 todo / command / file-change 状态，但保持微信端克制。

---

## 14. 一句话结论

这次工作已经把原本单一的微信到 Claude Code 桥，扩展成了同一微信入口下的双 provider 桥：Claude Code 负责默认对话，Codex CLI 通过 `/codex` 触发；并且 Codex 路径已有基本的手机端进度反馈和审批提醒雏形。
