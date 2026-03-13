export interface PostFooterOptions {
  agentName?: string;
  author?: string;
  platform?: string;
  timestamp?: string;
}

export function buildPostFooter(options?: PostFooterOptions): string {
  const agent = options?.agentName || "PostAgent";
  const suffix = options?.platform ? ` [${options.platform}]` : "";
  const ts = options?.timestamp ? ` · ${options.timestamp}` : "";
  const attribution = options?.author ? ` — built by ${options.author}` : "";
  return `🤖 Auto-posted via ${agent}${suffix}${attribution}${ts}`;
}

export function appendPostFooter(content: string, options?: PostFooterOptions): string {
  return `${content}\n\n${buildPostFooter(options)}`;
}
