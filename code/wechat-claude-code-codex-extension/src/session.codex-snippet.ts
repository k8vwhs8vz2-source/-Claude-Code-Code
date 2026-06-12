// Snippet for src/session.ts
// Keep Claude Code session ids and Codex thread ids separate.

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  provider?: 'claude' | 'codex';
}

export interface Session {
  sdkSessionId?: string;
  previousSdkSessionId?: string;
  codexThreadId?: string;
  workingDirectory: string;
  model?: string;
  state: 'idle' | 'processing';
  chatHistory: ChatMessage[];
  maxHistoryLength?: number;
}

function addChatMessage(
  session: Session,
  role: 'user' | 'assistant',
  content: string,
  provider: 'claude' | 'codex' = 'claude',
): void {
  if (!session.chatHistory) {
    session.chatHistory = [];
  }

  session.chatHistory.push({
    role,
    content,
    timestamp: Date.now(),
    provider,
  });

  const maxLen = session.maxHistoryLength || 100;
  if (session.chatHistory.length > maxLen) {
    session.chatHistory = session.chatHistory.slice(-maxLen);
  }
}

function getChatHistoryText(session: Session, limit?: number): string {
  const history = session.chatHistory || [];
  const messages = limit ? history.slice(-limit) : history;

  if (messages.length === 0) {
    return '暂无对话记录';
  }

  const lines: string[] = [];
  for (const msg of messages) {
    const time = new Date(msg.timestamp).toLocaleString('zh-CN');
    const provider = msg.provider === 'codex' ? 'Codex' : 'Claude';
    const role = msg.role === 'user' ? `用户/${provider}` : provider;
    lines.push(`[${time}] ${role}:`);
    lines.push(msg.content);
    lines.push('');
  }

  return lines.join('\n');
}
