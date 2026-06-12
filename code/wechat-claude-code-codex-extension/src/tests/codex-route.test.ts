import test from 'node:test';
import assert from 'node:assert/strict';
import { routeCommand, type CommandContext } from '../commands/router.js';
import type { Session } from '../session.js';

function ctx(text: string): CommandContext {
  const session: Session = {
    workingDirectory: 'C:\\Users\\example\\Documents\\ClaudeCode',
    state: 'idle',
    chatHistory: [],
  };

  return {
    accountId: 'test-account',
    session,
    updateSession: (partial) => Object.assign(session, partial),
    clearSession: () => session,
    getChatHistoryText: () => '暂无对话记录',
    text,
  };
}

test('/codex routes the rest of the message to Codex', () => {
  const result = routeCommand(ctx('/codex 用中文回答 ping'));

  assert.equal(result.handled, true);
  assert.equal(result.codexPrompt, '用中文回答 ping');
  assert.equal(result.claudePrompt, undefined);
  assert.equal(result.reply, undefined);
});

test('/codex without a prompt returns usage text', () => {
  const result = routeCommand(ctx('/codex'));

  assert.equal(result.handled, true);
  assert.match(result.reply ?? '', /用法: \/codex/);
  assert.equal(result.codexPrompt, undefined);
});
