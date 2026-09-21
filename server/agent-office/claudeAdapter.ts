import type { AgentAdapter, AgentRunInput, AgentEvent, UsageSnapshot, AgentHealth, AgentCapabilities } from './adapterFramework.js';

export interface ClaudeAdapterConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
  timeoutMs?: number;
}

const DEFAULT_MODEL = 'claude-3-5-sonnet-20241022';
const DEFAULT_TIMEOUT = 60000;

export function createClaudeAdapter(config: ClaudeAdapterConfig): AgentAdapter {
  const baseUrl = config.baseUrl.replace(/\/+$/, '');
  const model = config.model || DEFAULT_MODEL;
  const timeoutMs = config.timeoutMs || DEFAULT_TIMEOUT;

  function authorizationHeader(): string {
    return `Bearer ${config.apiKey}`;
  }

  return {
    id: 'claude',
    async healthCheck(): Promise<AgentHealth> {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 5000);
        const response = await fetch(`${baseUrl}/v1/models`, { headers: { Authorization: authorizationHeader() }, signal: controller.signal });
        clearTimeout(timer);
        if (response.ok) {
          return { status: 'healthy', capabilities: { streaming: true, resume: false, tools: ['read', 'write', 'bash', 'web_search'], max_context_tokens: 200000 } };
        }
        if (response.status === 401) return { status: 'unavailable', details: 'Invalid API key' };
        return { status: 'degraded', details: `HTTP ${response.status}` };
      } catch (error) {
        return { status: 'unavailable', details: error instanceof Error ? error.message : 'Health check failed' };
      }
    },
    getCapabilities(): AgentCapabilities {
      return { streaming: true, resume: false, tools: ['read', 'write', 'bash', 'web_search'], max_context_tokens: 200000 };
    },
    async getUsage(): Promise<UsageSnapshot | null> {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 5000);
        const response = await fetch(`${baseUrl}/v1/usage`, { headers: { Authorization: authorizationHeader() }, signal: controller.signal });
        clearTimeout(timer);
        if (!response.ok) return null;
        const data = await response.json() as Record<string, unknown>;
        return { source: 'provider', raw: data };
      } catch {
        return null;
      }
    },
    async *startRun({ taskId, contextPack, projectRoot, metadata }: AgentRunInput): AsyncIterable<AgentEvent> {
      yield { type: 'delta', timestamp: new Date().toISOString(), payload: { text: `[Claude] Starting task ${taskId}` } };
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        const response = await fetch(`${baseUrl}/v1/messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: authorizationHeader(), 'anthropic-version': '2023-06-01' },
          body: JSON.stringify({
            model,
            max_tokens: 8192,
            stream: true,
            system: 'You are a helpful AI agent working in a local-first orchestrator. Respond with structured output when possible.',
            messages: [{ role: 'user', content: contextPack }],
          }),
          signal: controller.signal,
        });
        clearTimeout(timer);
        if (!response.ok || !response.body) {
          const errorText = await response.text().catch(() => '');
          yield { type: 'error', timestamp: new Date().toISOString(), payload: { message: `Claude API error ${response.status}: ${errorText}` } };
          return;
        }
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';
          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const data = line.slice(6).trim();
            if (data === '[DONE]') continue;
            try {
              const parsed = JSON.parse(data);
              if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
                yield { type: 'delta', timestamp: new Date().toISOString(), payload: { text: parsed.delta.text } };
              }
            } catch {
              // ignore parse errors on partial chunks
            }
          }
        }
        yield { type: 'complete', timestamp: new Date().toISOString(), payload: { success: true, model } };
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          yield { type: 'cancelled', timestamp: new Date().toISOString(), payload: { reason: 'timeout' } };
        } else {
          yield { type: 'error', timestamp: new Date().toISOString(), payload: { message: error instanceof Error ? error.message : 'Unknown error' } };
        }
      }
    },
    async cancel(runId: string): Promise<void> {
      // HTTP-based adapter: no server-side cancel; client aborts the request in startRun
    },
  };
}