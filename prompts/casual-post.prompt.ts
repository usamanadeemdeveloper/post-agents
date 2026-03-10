import { PostPromptParams } from './prompt-params.interface';

export function casualLinkedInPrompt(params: PostPromptParams): string {
  const { topStory, otherHeadlines, date } = params;
  const contentLabel = topStory.articleText ? 'ARTICLE CONTENT' : 'ARTICLE SUMMARY';

  return `You are writing a LinkedIn post on behalf of a software architect sharing a personal take on industry news. The audience is a mix of peers, business owners, and followers who enjoy authentic, conversational content. The author builds systems for ecommerce, hospitality, and healthcare businesses.

The tone must be:
- Warm and conversational, like sharing an observation with a professional friend
- Personal and genuine: the author has a point of view, not just facts
- Relatable: use plain language, light humour where appropriate
- Still insightful: behind the casual tone is real expertise

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

💬 Quick Take — ${date}

[Hook: one casual, conversational sentence reacting to this topic — like something you'd say to a colleague over coffee]

[Body: 2 sentences sharing your personal perspective on why this matters for ecommerce, hospitality, or healthcare. Ground every claim in the content above. Keep it light but credible.]

What I'm thinking about:
• [One real-world implication you've seen with clients or in projects]
• [One thing business owners often overlook about this]
• [One thing you'd do differently based on this]

[Closing: an open question inviting others to share their take — keep it genuine and conversational]

Source: ${topStory.url}

#Ecommerce #HealthcareTech #HospitalityTech

STRICT RULES:
- Every fact must come from the content above — nothing invented
- Total post length: 700–950 characters
- Hashtags: exactly 3, always include the niche tags above plus one relevant to the story
- Output ONLY the post text`;
}

export function casualTwitterPrompt(params: PostPromptParams): string {
  const { topStory, date } = params;
  const contentLabel = topStory.articleText ? 'ARTICLE CONTENT' : 'ARTICLE SUMMARY';

  return `You are writing a tweet on behalf of a software architect sharing a casual personal take on industry news. The audience follows them for genuine insights on ecommerce, hospitality, and healthcare tech.

Write ONLY from what you read below — never invent details.

TODAY'S DATE: ${date}
Title: ${topStory.title}
Source: ${topStory.source}
URL: ${topStory.url}

${contentLabel}:
${topStory.articleText}

Write ONE tweet with a casual, genuine personal reaction or observation from this topic.

STRICT RULES:
- Start with "💬 ${date} —" then your take
- The full tweet text (before the URL line) must be between 200 and 240 characters including the date prefix
- Add the source URL on the last line: ${topStory.url}
- Include exactly 2 hashtags from: #Ecommerce #HealthcareTech #HospitalityTech #BuildingInPublic
- Every claim must come from the article — do not invent
- Output ONLY the tweet text and URL, nothing else`;
}
