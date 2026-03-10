import { PostPromptParams } from './prompt-params.interface';

export function marketingLinkedInPrompt(params: PostPromptParams): string {
  const { topStory, otherHeadlines, date, tone, targetAudience } = params;
  const contentLabel = topStory.articleText ? 'ARTICLE CONTENT' : 'ARTICLE SUMMARY';
  const resolvedTone = tone ?? 'compelling and opportunity-focused';
  const audience = targetAudience ?? 'business owners, investors, and decision-makers in ecommerce, hospitality, and healthcare';

  return `You are writing a LinkedIn post on behalf of a software architect who builds custom solutions for ecommerce, hospitality, and healthcare businesses. The goal is to generate qualified leads and inspire action. The audience is ${audience}.

The tone must be ${resolvedTone}:
- Lead with the market opportunity, competitive edge, or urgent risk
- Frame the news as a reason why businesses need to act now
- Highlight the ROI angle: revenue growth, cost savings, or risk avoidance
- Use vivid, benefit-driven language that resonates with business owners
- End with a clear, low-friction call to action

Write ONLY from what you read below — never add figures, projections, or claims not present in the content.

TODAY'S TRENDING TOPIC:
Title: ${topStory.title}
Source: ${topStory.source}
URL: ${topStory.url}

${contentLabel}:
${topStory.articleText}

OTHER TRENDING:
${otherHeadlines ?? ''}

Write a LinkedIn post using this EXACT structure:

🚀 Market Opportunity — ${date}

[Hook: one high-energy sentence that frames this news as a competitive advantage or urgent risk for businesses in these industries]

[Body: 2 sentences on the business opportunity or threat. Use specific facts from the content. Focus on outcomes, not processes.]

Why your competitors are already moving:
• [Revenue or growth opportunity]
• [Cost reduction or efficiency gain]
• [Risk of falling behind — what laggards lose]

[Closing: a direct, friendly invitation to explore this opportunity — not a hard sell]

Source: ${topStory.url}

#BusinessGrowth #Ecommerce #DigitalTransformation

STRICT RULES:
- Every fact must come from the content above — nothing invented
- Total post length: 700–950 characters
- Hashtags: exactly 3, always include the tags above plus one relevant to the story
- Output ONLY the post text`;
}

export function marketingTwitterPrompt(params: PostPromptParams): string {
  const { topStory, date, tone, targetAudience } = params;
  const contentLabel = topStory.articleText ? 'ARTICLE CONTENT' : 'ARTICLE SUMMARY';
  const resolvedTone = tone ?? 'compelling and opportunity-focused';
  const audience = targetAudience ?? 'business owners and investors';

  return `You are writing a tweet on behalf of a software architect who builds solutions for ecommerce, hospitality, and healthcare businesses. The tone is ${resolvedTone}. The audience is ${audience}.

Write ONLY from what you read below — never invent details.

TODAY'S DATE: ${date}
Title: ${topStory.title}
Source: ${topStory.source}
URL: ${topStory.url}

${contentLabel}:
${topStory.articleText}

Write ONE tweet that frames a clear business opportunity or risk for decision-makers.

STRICT RULES:
- Start with "🚀 ${date} —" then your insight
- The full tweet text (before the URL line) must be between 200 and 240 characters including the date prefix
- Add the source URL on the last line: ${topStory.url}
- Include exactly 2 hashtags from: #BusinessGrowth #Ecommerce #DigitalTransformation #ROI
- Every claim must come from the article — do not invent
- Output ONLY the tweet text and URL, nothing else`;
}
