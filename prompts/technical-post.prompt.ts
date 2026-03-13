import { PostPromptParams } from './prompt-params.interface';

export function technicalLinkedInPrompt(params: PostPromptParams): string {
  const { topStory, otherHeadlines, date, hashtags, postLengthHint } = params;
  const lengthRule = postLengthHint ?? '700–950 characters';
  const hashtagRule = hashtags ?? '#SoftwareArchitecture #EngineeringLeadership #TechStrategy #SystemDesign #PlatformEngineering';
  const contentLabel = topStory.articleText ? 'ARTICLE CONTENT' : 'ARTICLE SUMMARY';

  return `You are writing a LinkedIn post on behalf of a software architect sharing technical analysis for senior developers, staff engineers, and engineering leaders.

The tone must be:
- Technically precise but free of unnecessary jargon
- Architecture-aware: explain the system or design implications, not just the headline
- Credible: the author is someone who has built these systems and knows the trade-offs
- Forward-looking: what does this mean for systems being designed or scaled today

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

⚙️ Architecture Insight — ${date}

[Hook: one sentence on the architectural implication for modern engineering teams]

[Body: 2 sentences explaining the technical reality — what this changes in how systems are built, scaled, or secured. Ground every claim in the content above.]

Engineering implications:
• [System design or infrastructure impact]
• [Security, reliability, or scalability consideration]
• [What engineering teams should evaluate or change]

[Closing: a question or observation from the perspective of someone who architects these systems professionally]

Source: ${topStory.url}

#SoftwareArchitecture #EngineeringLeadership #TechStrategy

STRICT RULES:
- Every fact must come from the content above — nothing invented
- Total post length: ${lengthRule}
- Hashtags: use these — ${hashtagRule}
- Output ONLY the post text`;
}

export function technicalTwitterPrompt(params: PostPromptParams): string {
  const { topStory, date, hashtags, postLengthHint } = params;
  const lengthRule = postLengthHint ?? '200 and 240 characters';
  const hashtagRule = hashtags ?? '#SoftwareArchitecture #EngineeringLeadership #TechStrategy #SystemDesign';
  const contentLabel = topStory.articleText ? 'ARTICLE CONTENT' : 'ARTICLE SUMMARY';

  return `You are writing a tweet on behalf of a software architect sharing technical insights with engineers and CTOs.

Write ONLY from what you read below — never invent details.

TODAY'S DATE: ${date}
Title: ${topStory.title}
Source: ${topStory.source}
URL: ${topStory.url}

${contentLabel}:
${topStory.articleText}

Write ONE tweet that delivers a sharp architectural or engineering insight from this topic.

STRICT RULES:
- Start with "⚙️ ${date} —" then your insight
- The full tweet text (before the URL line) must be between ${lengthRule} including the date prefix
- Add the source URL on the last line: ${topStory.url}
- Hashtags: use these — ${hashtagRule}
- Every claim must come from the article — do not invent
- Output ONLY the tweet text and URL, nothing else`;
}
