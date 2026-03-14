import { PostPromptParams } from './prompt-params.interface';

export function defaultLinkedInPrompt(params: PostPromptParams): string {
  const { topStory, otherHeadlines, date, factualAnchors, hashtags, postLengthHint } = params;
  const lengthRule = postLengthHint ?? '700–950 characters';
  const hashtagRule = hashtags ?? '#SoftwareEngineering #DevTools #AIEngineering #WebDevelopment #Programming';
  const anchorSection = factualAnchors
    ? `\nFACTUAL ANCHORS:\n${factualAnchors}\n`
    : "";

  return `You are writing a LinkedIn post on behalf of a senior software engineer sharing practical insights with developers, engineering leads, and technical founders.

The tone must be:
- Practical and technical, without buzzword fluff
- Experience-driven: explain what builders should care about in real systems
- Clear: avoid vague hype, focus on concrete implications
- Opinionated but balanced: mention trade-offs, not just upside

Write ONLY from what you read below — never add names, numbers, or claims not present in the content.

TODAY'S TRENDING TOPIC:
Title: ${topStory.title}
Source: ${topStory.source}
URL: ${topStory.url}

ARTICLE CONTENT:
${topStory.articleText}
${anchorSection}

OTHER TRENDING:
${otherHeadlines}

Write a LinkedIn post using this EXACT structure:

🛠️ Dev Insight — ${date}

[Hook: one sharp sentence on why this matters now for developers shipping products.]

[Body: 2 sentences explaining what changed and the engineering implication. Use specific facts from the content.]

Why this matters for builders:
• [Immediate impact on architecture, tooling, or delivery speed]
• [Risk, limitation, or trade-off engineering teams should watch]
• [One practical action dev teams can take this week]

[Closing: one direct question inviting other developers to share how they are handling this]

Source: ${topStory.url}

#SoftwareEngineering #DevTools #AIEngineering

STRICT RULES:
- Every fact must come from the content above — nothing invented
- Use the factual anchors above as hard constraints, not inspiration
- Total post length: ${lengthRule}
- Hashtags: use these — ${hashtagRule}
- Output ONLY the post text`;
}

export function defaultTwitterPrompt(params: PostPromptParams): string {
  const { topStory, date, factualAnchors, hashtags, postLengthHint } = params;
  const lengthRule = postLengthHint ?? '200 and 240 characters';
  const hashtagRule = hashtags ?? '#SoftwareEngineering #DevTools #AIEngineering #WebDevelopment #Programming';
  const anchorSection = factualAnchors
    ? `\nFACTUAL ANCHORS:\n${factualAnchors}\n`
    : "";

  return `You are writing a tweet on behalf of a senior engineer sharing practical updates for developers and builders.

Write ONLY from what you read below — never invent details.

TODAY'S DATE: ${date}
Title: ${topStory.title}
Source: ${topStory.source}
URL: ${topStory.url}

ARTICLE CONTENT:
${topStory.articleText}
${anchorSection}

Write ONE tweet that shares a sharp developer insight from this topic.

STRICT RULES:
- Start with "🛠️ ${date} —" then your insight
- The full tweet text (before the URL line) must be between ${lengthRule} including the date prefix
- Add the source URL on the last line: ${topStory.url}
- Hashtags: use these — ${hashtagRule}
- Use the factual anchors above as hard constraints, not inspiration
- Every claim must come from the article — do not invent
- Output ONLY the tweet text and URL, nothing else`;
}
