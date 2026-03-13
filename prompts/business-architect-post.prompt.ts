import { PostPromptParams } from './prompt-params.interface';

export function businessArchitectLinkedInPrompt(params: PostPromptParams): string {
  const { topStory, otherHeadlines, date, hashtags, postLengthHint } = params;
  const lengthRule = postLengthHint ?? '750–1000 characters';
  const hashtagRule = hashtags ?? '#Ecommerce #HealthTech #HospitalityTech #DigitalTransformation #SoftwareDevelopment';
  const contentLabel = topStory.articleText ? 'ARTICLE CONTENT' : 'ARTICLE SUMMARY';

  return `You are writing a LinkedIn post on behalf of a senior software architect who specialises in building custom software for ecommerce, healthcare, and hospitality businesses.

The author's goal is to be seen as a trusted, experienced technology partner by business owners, founders, and investors — not to impress other developers. The audience is: ecommerce founders, healthcare executives, hospitality operators, and investors who evaluate technology as a business capability.

The tone must be:
- Authoritative but accessible: the author understands both technology and business
- Outcome-focused: always connect technology to a business result (revenue, efficiency, patient outcomes, guest experience)
- Credible: demonstrate deep domain knowledge in ecommerce, healthcare, or hospitality
- Client-facing: the author is positioning themselves as someone you'd hire or partner with

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

💡 Industry Insight — ${date}

[Hook: one sharp sentence on what this means for businesses in ecommerce, healthcare, or hospitality — frame it as a business challenge or opportunity, not a tech problem]

[Body: 2 sentences explaining what is changing and the direct business impact. Speak to operators and decision-makers, not engineers. Ground every claim in the content above.]

What this means for your business:
• [Operational or revenue impact for companies in these verticals]
• [Risk of falling behind or cost of inaction]
• [What businesses that act on this now will gain]

[Closing: a genuine question inviting business owners or decision-makers to reflect on how ready their operations are — position yourself as someone who solves this]

Source: ${topStory.url}

#Ecommerce #HealthTech #HospitalityTech

STRICT RULES:
- Every fact must come from the content above — nothing invented
- Total post length: ${lengthRule}
- Hashtags: use these — ${hashtagRule}
- Output ONLY the post text`;
}

export function businessArchitectTwitterPrompt(params: PostPromptParams): string {
  const { topStory, date, hashtags, postLengthHint } = params;
  const lengthRule = postLengthHint ?? '200 and 240 characters';
  const hashtagRule = hashtags ?? '#Ecommerce #HealthTech #HospitalityTech #DigitalTransformation #RetailTech';
  const contentLabel = topStory.articleText ? 'ARTICLE CONTENT' : 'ARTICLE SUMMARY';

  return `You are writing a tweet on behalf of a software architect who builds custom software for ecommerce, healthcare, and hospitality businesses. The audience is founders, operators, and investors in those industries — not developers.

Write ONLY from what you read below — never invent details.

TODAY'S DATE: ${date}
Title: ${topStory.title}
Source: ${topStory.source}
URL: ${topStory.url}

${contentLabel}:
${topStory.articleText}

Write ONE tweet that delivers a sharp business insight from this topic — connecting the technology trend to a real outcome for businesses in ecommerce, healthcare, or hospitality.

STRICT RULES:
- Start with "💡 ${date} —" then your insight
- The full tweet text (before the URL line) must be between ${lengthRule} including the date prefix
- Add the source URL on the last line: ${topStory.url}
- Hashtags: use these — ${hashtagRule}
- Every claim must come from the article — do not invent
- Output ONLY the tweet text and URL, nothing else`;
}
