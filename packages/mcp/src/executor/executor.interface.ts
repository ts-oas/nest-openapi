import type { McpToolDefinition } from "../types";

export interface McpExecutor {
  execute(
    tool: McpToolDefinition,
    args: any,
    ctx: { forwardHeaders: Record<string, string> },
  ): Promise<{ ok: boolean; status: number; statusText: string; text: string; json?: any; headers: Record<string, string> }>;
}
