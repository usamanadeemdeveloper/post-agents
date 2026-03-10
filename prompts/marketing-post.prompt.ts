import { PostPromptParams } from './prompt-params.interface';

export function marketingLinkedInPrompt(params: PostPromptParams): string {
  const { topStory, otherHeadlines, date } = params;
  const contentLabel = topStory.articleText ? 'ARTICLE CONTENT' : 'ARTICLE SUMMARY';

  return `You are writing a LinkedIn post on behalf of a software consultancy that helps ecommerce, hospitality, and healthcare businesses grow through technology. The audience is business owners, investors, and decision-makers who care about ROI, competitive advantage, and growth opportunities.

The tone must be:
- Opportunity-focused: frame technology shifts as business opportunities first
- Results-oriented: what revenue, cost savings, or competitive edge does this unlock
- Compelling: make the reader feel they need to act or risk being left behind
- Clear and direct: no tech speak, pure business value language

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

📈 Business Opportunity — ${date}

[Hook: one sentence framing this as a business opportunity or competitive risk for ecommerce, hospitality, or healthcare]

[Body: 2 sentences explaining what is happening and the direct business impact — revenue, cost, or competitive position. Ground every claim in the content above.]

The opportunity for your business:
• [Revenue or growth opportunity created by this shift]
• [Competitive risk if businesses don't move]
• [First-mover advantage available right now]

[Closing: a call to reflection — asking the reader if their business is positioned to capture this opportunity]

Source: ${topStory.url}

#BusinessGrowth #Ecommerce #HealthcareTech

STRICT RULES:
- Every fact must come from the content above — nothing invented
- Total post length: 700–950 characters
- Hashtags: exactly 3, always include the niche tags above plus one relevant to the story
- Output ONLY the post text`;
}

export function marketingTwitterPrompt(params: PostPromptParams): string {
  const { topStory, date } = params;
  const contentLabel = topStory.articleText ? 'ARTICLE CONTENT' : 'ARTICLE SUMMARY';

  return `You are writing a tweet on behalf of a software consultancy serving ecommerce, hospitality, and healthcare businesses. The audience is business owners and investors focused on growth and ROI.

Write ONLY from what you read below — never invent details.

TODAY'S DATE: ${date}
Title: ${topStory.title}
Source: ${topStory.source}
URL: ${topStory.url}

${contentLabel}:
${topStory.articleText}

Write ONE tweet that highlights the business opportunity or competitive risk from this topic.

STRICT RULES:
- Start with "📈 ${date} —" then your insight
- The full tweet text (before the URL line) must be between 200 and 240 characters including the date prefix
- Add the source URL on the last line: ${topStory.url}
- Include exactly 2 hashtags from: #BusinessGrowth #Ecommerce #HealthcareTech #HospitalityTech
- Every claim must come from the article — do not invent
- Output ONLY the tweet text and URL, nothing else`;
}
