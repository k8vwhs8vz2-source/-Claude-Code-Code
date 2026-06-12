# WeChat Claude Code / Codex Bridge Implementation Notes

Date: 2026-06-12

This document records the spike, design decisions, implementation changes, validation results, and remaining work for extending a working WeChat-to-Claude-Code bridge so it can also route selected messages to Codex CLI.

## Goal

The original setup already connected a mobile WeChat bot to Claude Code running on the computer. The new goal was to keep that Claude Code path usable while adding a Codex path.

The desired interaction model is:

```text
Normal WeChat message -> Claude Code
/codex <message>      -> Codex CLI
```

This avoids needing two separate WeChat bot entrances while still allowing both assistants to be reached from the same chat.

## Reference Project

The reference project is:

- https://github.com/Wechat-ggGitHub/wechat-claude-code

The important product behavior from that project is not merely that it forwards text. It keeps the WeChat experience clean:

- show a typing indicator while work is running
- stream or send useful progress only when appropriate
- avoid dumping tool calls, raw logs, or internal JSON into WeChat
- send final user-facing results and files back to WeChat

The Codex extension follows the same principle: WeChat should see progress, attention-worthy state, and final answers, not CLI internals.

## Local Environment Findings

The bridge installation was found under:

```text
C:\Users\s58fa\.claude\skills\wechat-claude-code
C:\Users\s58fa\.agents\skills\wechat-claude-code
```

Runtime data was found under:

```text
C:\Users\s58fa\.wechat-claude-code
```

The bound WeChat bot account was:

```text
903329b5a6c1@im.bot
```

The Claude working directory was recorded as:

```text
C:\Users\s58fa\Documents\ClaudeCode
```

A long-term Codex working directory was created as:

```text
C:\Users\s58fa\Documents\CodexWeChat
```

## Codex CLI Findings on Windows

Codex CLI was installed with the official Windows install script. The installed version observed locally was:

```text
Codex CLI 0.139.0
```

The reliable standalone binary path found locally was:

```text
C:\Users\s58fa\.codex\packages\standalone\releases\0.139.0-x86_64-pc-windows-msvc\bin\codex.exe
```

A WindowsApps `codex.exe` path existed, but it returned `Access is denied` in this environment. The bridge therefore should not rely on the WindowsApps package path.

The verified non-interactive command shape was:

```powershell
codex exec --json --skip-git-repo-check --cd C:\Users\s58fa\Documents\CodexWeChat "用中文回复：Codex CLI 测试成功"
```

The useful JSONL events were:

```text
thread.started      -> contains thread_id for resume
turn.started
item.completed      -> item.type == "agent_message" contains final assistant text
turn.completed      -> successful completion and usage data
turn.failed / error -> failure state
```

Codex JSONL is an event stream, not a Claude-style token stream. For WeChat, the safe contract is to send selected progress/attention messages plus the final `agent_message` text.

## Adapter Contract

The Codex provider should be treated as a separate provider, not as a drop-in replacement for Claude Code.

Input contract:

```ts
interface CodexQueryOptions {
  prompt: string;
  cwd: string;
  resume?: string;
  model?: string;
  abortController?: AbortController;
  onAttention?: (message: string) => Promise<void> | void;
}
```

Output contract:

```ts
interface CodexQueryResult {
  text: string;
  threadId?: string;
  error?: string;
}
```

Execution contract:

```text
New session:
  codex exec --json --skip-git-repo-check --cd <cwd> <prompt>

Resume session:
  codex exec --json --skip-git-repo-check --cd <cwd> resume <threadId> <prompt>
```

Parsing rules:

- save `thread.started.thread_id` as the Codex resume id
- collect final text from `item.completed` where `item.type == "agent_message"`
- treat `turn.completed` as successful completion
- treat `turn.failed` and `error` as failure signals
- keep stderr as diagnostics, not user-facing reply text

## Implemented Behavior

The bridge now supports:

```text
/codex <message>
```

Behavior:

```text
WeChat /codex message
-> immediate acknowledgement
-> Codex CLI non-interactive execution
-> optional attention notification if approval/permission/sandbox language appears
-> final cleaned Codex answer sent back to WeChat
```

Normal messages still route to Claude Code.

## Code Changes

The main local implementation changed these files under:

```text
C:\Users\s58fa\.claude\skills\wechat-claude-code
```

Key source changes:

```text
src/codex/provider.ts
src/commands/router.ts
src/commands/handlers.ts
src/session.ts
src/main.ts
src/tests/codex-route.test.ts
src/tests/codex-provider.test.ts
src/tests/codex-attention.test.ts
```

### `src/codex/provider.ts`

Added a Codex provider that:

- resolves the official standalone Codex CLI binary on Windows
- runs `codex exec --json --skip-git-repo-check`
- supports session resume through `thread_id`
- parses JSONL events
- extracts final user-facing text from completed `agent_message` events
- filters internal skill chatter from final output
- detects attention-worthy approval/permission/sandbox signals

Attention detection currently checks patterns such as:

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

When detected, it triggers:

```text
Codex 可能正在等待你在电脑端确认，请回电脑查看。
```

### `src/commands/router.ts`

Added `/codex` command routing.

```text
/codex <content> -> Codex provider
/claude <content> -> Claude Code provider
normal text -> Claude Code provider
```

### `src/commands/handlers.ts`

Updated help text to document `/codex`.

### `src/session.ts`

Added provider-aware history and Codex thread state:

```text
codexThreadId
chat message provider labels
```

This keeps Codex resume state separate from Claude Code's session id.

### `src/main.ts`

Added `sendToCodex()` and connected it to the router.

The Codex path now sends lightweight feedback:

```text
Codex 收到，正在处理。
```

If no progress or final result appears for 90 seconds:

```text
Codex 还在处理，这次可能需要久一点。
```

If an approval/permission/sandbox signal is detected:

```text
Codex 可能正在等待你在电脑端确认，请回电脑查看。
```

The final answer remains clean and is still split with the existing WeChat message splitter.

## Validation

Build and tests were run in the bridge directory.

Commands:

```powershell
npm.cmd run build
npm.cmd test
```

Result:

```text
6 tests passed
0 failed
```

Covered tests:

```text
needsUserAttention detects approval and permission waits
needsUserAttention ignores ordinary progress text
cleanCodexText removes internal skill chatter
cleanCodexText preserves normal user-facing text
/codex routes the rest of the message to Codex
/codex without a prompt returns usage text
```

Manual WeChat validation:

- normal WeChat messages route to Claude Code
- `/codex ...` routes to Codex CLI
- Codex replies return to WeChat
- immediate Codex acknowledgement appears before the final answer

A duplicate-reply issue was also diagnosed and fixed operationally. The cause was two bridge daemon processes polling the same WeChat account at the same time. Stopping the older Node process pair fixed the duplicated error + success replies.

## Current Status

MVP status: usable.

Working behavior:

```text
Normal message -> Claude Code
/codex ...     -> Codex CLI
Codex result   -> WeChat
Codex progress -> WeChat lightweight acknowledgement and timeout reminder
```

## Remaining Work

### 1. Desktop global approval watcher

The current approval reminder only covers Codex tasks launched through the WeChat bridge.

It does not yet cover tasks started directly in:

- Codex Desktop
- Claude Code Desktop / terminal sessions outside this bridge

To support that, a separate watcher is needed:

```text
watcher
-> observe Codex/Claude logs, process output, or state files
-> detect waiting-for-approval state
-> call the existing WeChat sendmessage path
-> notify the phone without approving automatically
```

This should be implemented only after verifying where each desktop surface records approval-wait state.

### 2. More granular Codex event translation

Codex JSONL may expose useful non-text events such as todo updates, command starts, or file changes. These should be translated conservatively.

Recommended rule:

```text
Send only progress that helps the mobile user decide whether attention is needed.
Do not send raw JSONL, internal reasoning, tool arguments, or noisy command output.
```

### 3. Process supervision on Windows

The original bridge has daemon scripts for macOS/Linux, but Windows needs a safer start/stop/status story.

Recommended future work:

- add a Windows-friendly status command
- detect duplicate bridge daemons
- prevent two processes from polling the same WeChat account
- optionally add a simple PowerShell launcher

## Operational Notes

To start the current bridge manually on Windows:

```powershell
cd C:\Users\s58fa\.claude\skills\wechat-claude-code
npm.cmd start
```

If PowerShell blocks `npm`, use:

```powershell
npm.cmd start
```

rather than plain `npm start`.

If duplicated replies occur again, check for duplicate `node.exe` processes. Do not kill every Node process because Codex Desktop also uses Node. Stop only the stale bridge process pair.
