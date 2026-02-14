import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

export interface McpSession {
  server: McpServer;
  transport: any;
  lastSeenAt: number;
}

export class OpenAPIMcpSessionStore {
  private readonly sessions = new Map<string, McpSession>();
  private cleanupInterval?: NodeJS.Timeout;

  get(sessionId: string): McpSession | undefined {
    return this.sessions.get(sessionId);
  }

  set(sessionId: string, session: McpSession): void {
    this.sessions.set(sessionId, session);
  }

  delete(sessionId: string): void {
    this.sessions.delete(sessionId);
  }

  startCleanup(ttlMs: number): void {
    if (this.cleanupInterval) return;
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      for (const [id, session] of this.sessions.entries()) {
        if (now - session.lastSeenAt > ttlMs) {
          this.sessions.delete(id);
          session.transport?.close?.();
          session.server?.close?.();
        }
      }
    }, 60_000); // Check every minute
    this.cleanupInterval.unref?.();
  }

  stopCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = undefined;
    }
  }
}
