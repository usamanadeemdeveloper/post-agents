export const POST_FOOTER = "🤖 Auto-posted via PostAgent — built by Usama Nadeem";

export interface PostFooterOptions {
  agentName?: string;
  author?: string;
  platform?: string;
  timestamp?: string;
}

export function buildPostFooter(options?: PostFooterOptions): string {
  if (!options) return POST_FOOTER;
  const agent = options.agentName ?? "PostAgent";
  const author = options.author ?? "Usama Nadeem";
  const suffix = options.platform ? ` [${options.platform}]` : "";
  const ts = options.timestamp ? ` · ${options.timestamp}` : "";
  return `🤖 Auto-posted via ${agent}${suffix} — built by ${author}${ts}`;
}

export function appendPostFooter(content: string, options?: PostFooterOptions): string {
  return `${content}\n\n${buildPostFooter(options)}`;
}
