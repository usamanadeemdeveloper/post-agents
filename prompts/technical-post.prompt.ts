import { PostPromptParams } from './prompt-params.interface';

export function technicalLinkedInPrompt(params: PostPromptParams): string {
  const { topStory, otherHeadlines, date, tone } = params;
  const contentLabel = topStory.articleText ? 'ARTICLE CONTENT' : 'ARTICLE SUMMARY';
  const resolvedTone = tone ?? 'precise and technically grounded';

  return `You are writing a LinkedIn post on behalf of a software architect who builds custom solutions for ecommerce, hospitality, and healthcare businesses. The author is addressing CTOs, technical leads, and engineering-aware executives — people who appreciate specifics and implementation depth.

The tone must be ${resolvedTone}:
- Lead with the technical mechanism, not just the business headline
- Explain what changed architecturally or at the infrastructure level
- Connect the technical shift to real operational decisions teams face
- Use precise language — integration, latency, throughput, API, compliance — where appropriate
- Remain accessible to a technical manager, not just a developer

Write ONLY from what you read below — never add numbers, benchmarks, or claims not present in the content.

TODAY'S TRENDING TOPIC:
Title: ${topStory.title}
Source: ${topStory.source}
URL: ${topStory.url}

${contentLabel}:
${topStory.articleText}

OTHER TRENDING:
${otherHeadlines ?? ''}

Write a LinkedIn post using this EXACT structure:

⚙️ Tech Shift — ${date}

[Hook: one sentence describing the specific technical change and why it matters to engineering teams in ecommerce, hospitality, or healthcare]

[Body: 2 sentences on the implementation reality — what teams will need to change, integrate, or evaluate. Ground every claim in the content.]

What engineering teams should evaluate:
• [Specific architectural or integration implication]
• [Compliance, security, or performance consideration]
• [Migration path or adoption readiness factor]

[Closing: a question or observation that reflects hands-on implementation experience]

Source: ${topStory.url}

#SoftwareArchitecture #EngineeringLeadership #TechStrategy

STRICT RULES:
- Every fact must come from the content above — nothing invented
- Total post length: 700–950 characters
- Hashtags: exactly 3, always include the tags above plus one relevant to the story
- Output ONLY the post text`;
}

export function technicalTwitterPrompt(params: PostPromptParams): string {
  const { topStory, date, tone } = params;
  const contentLabel = topStory.articleText ? 'ARTICLE CONTENT' : 'ARTICLE SUMMARY';
  const resolvedTone = tone ?? 'technically precise';

  return `You are writing a tweet on behalf of a software architect who builds solutions for ecommerce, hospitality, and healthcare businesses. The tone is ${resolvedTone}. The audience is technical managers, CTOs, and engineering-aware executives.

Write ONLY from what you read below — never invent details.

TODAY'S DATE: ${date}
Title: ${topStory.title}
Source: ${topStory.source}
URL: ${topStory.url}

${contentLabel}:
${topStory.articleText}

Write ONE tweet that highlights the key technical implication for engineering teams.

STRICT RULES:
- Start with "⚙️ ${date} —" then your insight
- The full tweet text (before the URL line) must be between 200 and 240 characters including the date prefix
- Add the source URL on the last line: ${topStory.url}
- Include exactly 2 hashtags from: #SoftwareArchitecture #EngineeringLeadership #TechStrategy #DevOps
- Every claim must come from the article — do not invent
- Output ONLY the tweet text and URL, nothing else`;
}
