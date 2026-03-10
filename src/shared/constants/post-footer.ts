export interface PostFooterOptions {
  agentName?: string;
  author?: string;
  platform?: string;
  timestamp?: string;
}

export const POST_FOOTER = "🤖 Auto-posted via PostAgent — built by Usama Nadeem";

export function buildPostFooter(_options?: PostFooterOptions): string {
  return POST_FOOTER;
}

export function appendPostFooter(content: string, options?: PostFooterOptions): string {
  return `${content}\n\n${buildPostFooter(options)}`;
}
