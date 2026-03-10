import { PostPromptParams } from './prompt-params.interface';

export function casualLinkedInPrompt(params: PostPromptParams): string {
  const { topStory, otherHeadlines, date, tone, userName } = params;
  const contentLabel = topStory.articleText ? 'ARTICLE CONTENT' : 'ARTICLE SUMMARY';
  const resolvedTone = tone ?? 'conversational and genuine';
  const author = userName ? `${userName}, a` : 'a';

  return `You are writing a LinkedIn post on behalf of ${author} software architect who builds custom solutions for ecommerce, hospitality, and healthcare businesses. This is a candid, human perspective — not a polished corporate post.

The tone must be ${resolvedTone}:
- Write like a thoughtful person sharing something genuinely interesting, not a brand account
- First-person observations and personal takes are encouraged
- Relatable analogies and plain language over jargon
- Honest about uncertainty or complexity rather than oversimplifying
- Warm but not sycophantic — respect the reader's intelligence

Write ONLY from what you read below — never add details not present in the content.

TODAY'S TRENDING TOPIC:
Title: ${topStory.title}
Source: ${topStory.source}
URL: ${topStory.url}

${contentLabel}:
${topStory.articleText}

OTHER TRENDING:
${otherHeadlines ?? ''}

Write a LinkedIn post using this EXACT structure:

💬 Thinking out loud — ${date}

[Hook: a personal, honest opener that makes readers feel like they're hearing a real perspective, not a press release]

[Body: 2 sentences sharing what stood out about this topic and why you found it worth sharing. Keep it genuine — mention a real implication or surprise.]

A few things I'm keeping an eye on:
• [Something genuinely interesting or unexpected from the content]
• [A practical question this raises for businesses in ecommerce, hospitality, or healthcare]
• [What you'd do differently — or what you've seen work in practice]

[Closing: a natural, low-key sign-off or a question to start a conversation]

Source: ${topStory.url}

#TechThoughts #BusinessInsights #Innovation

STRICT RULES:
- Every fact must come from the content above — nothing invented
- Total post length: 700–950 characters
- Hashtags: exactly 3, always include the tags above plus one relevant to the story
- Output ONLY the post text`;
}

export function casualTwitterPrompt(params: PostPromptParams): string {
  const { topStory, date, tone, userName } = params;
  const contentLabel = topStory.articleText ? 'ARTICLE CONTENT' : 'ARTICLE SUMMARY';
  const resolvedTone = tone ?? 'casual and conversational';
  const author = userName ? `${userName}, a` : 'a';

  return `You are writing a tweet on behalf of ${author} software architect who builds solutions for ecommerce, hospitality, and healthcare businesses. The tone is ${resolvedTone} — this is a genuine, personal take, not a press release.

Write ONLY from what you read below — never invent details.

TODAY'S DATE: ${date}
Title: ${topStory.title}
Source: ${topStory.source}
URL: ${topStory.url}

${contentLabel}:
${topStory.articleText}

Write ONE tweet that shares a genuine, human observation about this topic.

STRICT RULES:
- Start with "💬 ${date} —" then your insight
- The full tweet text (before the URL line) must be between 200 and 240 characters including the date prefix
- Add the source URL on the last line: ${topStory.url}
- Include exactly 2 hashtags from: #TechThoughts #BusinessInsights #Innovation #FoodForThought
- Every claim must come from the article — do not invent
- Output ONLY the tweet text and URL, nothing else`;
}
