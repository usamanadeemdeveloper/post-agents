export interface ClaudeResearchPayload {
  prompt: string;
  maxTokens?: number;
}

export interface ClaudeResearchResponse {
  content: string;
  inputTokens: number;
  outputTokens: number;
}
