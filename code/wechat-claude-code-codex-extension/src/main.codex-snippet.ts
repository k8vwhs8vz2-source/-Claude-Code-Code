// Snippet for src/main.ts
// Wire /codex routed prompts into Codex CLI and send clean WeChat progress.

import { join } from 'node:path';
import { homedir } from 'node:os';
import { codexQuery } from './codex/provider.js';

// In command handling, after routeCommand(ctx):
//
// if (result.handled && result.codexPrompt) {
//   await sendToCodex(
//     result.codexPrompt, fromUserId, contextToken,
//     account, session, sessionStore, sender, config, activeControllers,
//   );
//   return;
// }

async function sendToCodex(
  userText: string,
  fromUserId: string,
  contextToken: string,
  account: { accountId: string },
  session: any,
  sessionStore: any,
  sender: { sendText: (toUserId: string, contextToken: string, text: string) => Promise<void>; startTyping: (toUserId: string, contextToken: string) => () => void },
  config: Record<string, unknown>,
  activeControllers: Map<string, AbortController>,
): Promise<void> {
  session.state = 'processing';
  sessionStore.save(account.accountId, session);

  const abortController = new AbortController();
  activeControllers.set(account.accountId, abortController);

  sessionStore.addChatMessage(session, 'user', userText, 'codex');
  const stopTyping = sender.startTyping(fromUserId, contextToken);

  let progressTimer: ReturnType<typeof setInterval> | undefined;
  let lastProgressSentAt = Date.now();
  let attentionSent = false;

  async function sendProgress(text: string): Promise<void> {
    await sender.sendText(fromUserId, contextToken, text);
    lastProgressSentAt = Date.now();
  }

  async function sendAttention(text: string): Promise<void> {
    if (attentionSent) return;
    attentionSent = true;
    await sendProgress(text);
  }

  try {
    await sendProgress('Codex 收到，正在处理。');

    progressTimer = setInterval(() => {
      if (Date.now() - lastProgressSentAt > 90_000) {
        sender.sendText(fromUserId, contextToken, 'Codex 还在处理，这次可能需要久一点。')
          .then(() => { lastProgressSentAt = Date.now(); })
          .catch(() => {});
      }
    }, 5_000);

    const codexWorkingDir = process.env.CODEX_WECHAT_CWD
      || join(homedir(), 'Documents', 'CodexWeChat');

    const result = await codexQuery({
      prompt: userText,
      cwd: codexWorkingDir,
      resume: session.codexThreadId,
      model: undefined,
      abortController,
      onAttention: (message) => sendAttention(message),
    });

    clearInterval(progressTimer);
    progressTimer = undefined;

    if (result.threadId) {
      session.codexThreadId = result.threadId;
    }

    if (result.text) {
      sessionStore.addChatMessage(session, 'assistant', result.text, 'codex');
      for (const chunk of splitMessage(result.text)) {
        await sender.sendText(fromUserId, contextToken, chunk);
      }
    } else if (result.error) {
      await sender.sendText(fromUserId, contextToken, `Codex 处理请求时出错：${result.error}`);
    } else {
      await sender.sendText(fromUserId, contextToken, 'Codex 无返回内容');
    }

    session.state = 'idle';
    sessionStore.save(account.accountId, session);
  } catch (err) {
    const isAbort = err instanceof Error && (err.name === 'AbortError' || err.message.includes('abort'));
    if (!isAbort) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      await sender.sendText(fromUserId, contextToken, `Codex 处理消息时出错：${errorMsg}`);
    }
    session.state = 'idle';
    sessionStore.save(account.accountId, session);
  } finally {
    clearInterval(progressTimer);
    stopTyping();
    if (activeControllers.get(account.accountId) === abortController) {
      activeControllers.delete(account.accountId);
    }
  }
}

// Reuse the original bridge's splitMessage implementation.
declare function splitMessage(text: string): string[];
