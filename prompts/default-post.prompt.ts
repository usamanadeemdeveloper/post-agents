import { PostPromptParams } from './prompt-params.interface';

export function defaultLinkedInPrompt(params: PostPromptParams): string {
  const { topStory, otherHeadlines, date } = params;
  const contentLabel = topStory.articleText ? 'ARTICLE CONTENT' : 'ARTICLE SUMMARY';

  return `You are writing a LinkedIn post on behalf of an experienced software architect who specialises in building custom software for ecommerce, hospitality, and healthcare businesses. Their goal is to build authority and attract investors and clients — not to talk to other developers.

The tone must be:
- Confident and professional, like a senior consultant speaking to a business audience
- Insight-driven: connect the news to real business impact in ecommerce, hospitality, or healthcare
- Subtle service authority: position them as someone who solves these problems for clients, without being salesy
- Accessible: investors and non-technical clients must understand every word

Write ONLY from what you read below — never add names, numbers, or claims not present in the content.

TODAY'S TRENDING TOPIC:
Title: ${topStory.title}
Source: ${topStory.source}
URL: ${topStory.url}

${contentLabel}:
${topStory.articleText}

OTHER TRENDING:
${otherHeadlines}

Write a LinkedIn post using this EXACT structure:

🔍 Industry Insight — ${date}

[Hook: one sharp sentence connecting this topic to a real pain point in ecommerce, hospitality, or healthcare. Must make a business decision-maker stop scrolling.]

[Body: 2 sentences explaining what is happening and why it matters to businesses in these industries. Use specific facts from the content. Zero jargon.]

What this means for your business:
• [Practical impact on ecommerce, hospitality, or healthcare operations]
• [Risk or opportunity business owners should act on]
• [How smart companies are already responding]

[Closing: one question or observation that positions the author as someone who navigates this for clients daily]

Source: ${topStory.url}

#Ecommerce #HealthcareTech #HospitalityTech

STRICT RULES:
- Every fact must come from the content above — nothing invented
- Total post length: 700–950 characters
- Hashtags: exactly 3, always include the niche tags above plus one relevant to the story
- Output ONLY the post text`;
}

export function defaultTwitterPrompt(params: PostPromptParams): string {
  const { topStory, date } = params;
  const contentLabel = topStory.articleText ? 'ARTICLE CONTENT' : 'ARTICLE SUMMARY';

  return `You are writing a tweet on behalf of a software architect who builds solutions for ecommerce, hospitality, and healthcare businesses. The audience is business owners, investors, and decision-makers — not developers.

Write ONLY from what you read below — never invent details.

TODAY'S DATE: ${date}
Title: ${topStory.title}
Source: ${topStory.source}
URL: ${topStory.url}

${contentLabel}:
${topStory.articleText}

Write ONE tweet that shares a sharp business insight from this topic.

STRICT RULES:
- Start with "📅 ${date} —" then your insight
- The full tweet text (before the URL line) must be between 200 and 240 characters including the date prefix
- Add the source URL on the last line: ${topStory.url}
- Include exactly 2 hashtags from: #Ecommerce #HealthcareTech #HospitalityTech #SoftwareArchitecture
- Every claim must come from the article — do not invent
- Output ONLY the tweet text and URL, nothing else`;
}
