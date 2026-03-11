import { PostPromptParams } from './prompt-params.interface';

export function marketingLinkedInPrompt(params: PostPromptParams): string {
  const { topStory, otherHeadlines, date } = params;
  const contentLabel = topStory.articleText ? 'ARTICLE CONTENT' : 'ARTICLE SUMMARY';

  return `You are writing a LinkedIn post on behalf of an engineering consultancy sharing market-facing tech insights with founders, product leaders, and developers.

The tone must be:
- Opportunity-focused: frame technology shifts as strategic opportunities
- Outcome-oriented: show impact on product velocity, reliability, or differentiation
- Compelling: make the reader feel urgency to adapt
- Clear and direct: avoid jargon-heavy phrasing

Write ONLY from what you read below — never add facts not present in the content.

TODAY'S TRENDING TOPIC:
Title: ${topStory.title}
Source: ${topStory.source}
URL: ${topStory.url}

${contentLabel}:
${topStory.articleText}

OTHER TRENDING:
${otherHeadlines}

Write a LinkedIn post using this EXACT structure:

📈 Tech Opportunity — ${date}

[Hook: one sentence framing this as a product or engineering opportunity/risk]

[Body: 2 sentences explaining what is happening and the direct product/engineering impact. Ground every claim in the content above.]

The opportunity for teams shipping software:
• [Product or developer experience advantage created by this shift]
• [Competitive risk if teams don't adapt]
• [A practical first-mover move teams can make now]

[Closing: a call to reflection — asking the reader if their business is positioned to capture this opportunity]

Source: ${topStory.url}

#TechStrategy #ProductEngineering #BuildInPublic

STRICT RULES:
- Every fact must come from the content above — nothing invented
- Total post length: 700–950 characters
- Hashtags: exactly 3 total, choose from #TechStrategy #ProductEngineering #BuildInPublic #SoftwareEngineering #AIEngineering
- Output ONLY the post text`;
}

export function marketingTwitterPrompt(params: PostPromptParams): string {
  const { topStory, date } = params;
  const contentLabel = topStory.articleText ? 'ARTICLE CONTENT' : 'ARTICLE SUMMARY';

  return `You are writing a tweet on behalf of an engineering consultancy. The audience is founders, product leaders, and developers focused on building winning products.

Write ONLY from what you read below — never invent details.

TODAY'S DATE: ${date}
Title: ${topStory.title}
Source: ${topStory.source}
URL: ${topStory.url}

${contentLabel}:
${topStory.articleText}

Write ONE tweet that highlights the product or engineering opportunity/risk from this topic.

STRICT RULES:
- Start with "📈 ${date} —" then your insight
- The full tweet text (before the URL line) must be between 200 and 240 characters including the date prefix
- Add the source URL on the last line: ${topStory.url}
- Include exactly 2 hashtags from: #TechStrategy #ProductEngineering #BuildInPublic #SoftwareEngineering #AIEngineering
- Every claim must come from the article — do not invent
- Output ONLY the tweet text and URL, nothing else`;
}
