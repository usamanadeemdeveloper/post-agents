import { PostPromptParams } from './prompt-params.interface';

export function businessArchitectLinkedInPrompt(params: PostPromptParams): string {
  const { topStory, otherHeadlines, date, postLengthHint } = params;
  const lengthRule = postLengthHint ?? '750–1000 characters';
  const contentLabel = topStory.articleText ? 'ARTICLE CONTENT' : 'ARTICLE SUMMARY';

  return `You are writing a LinkedIn post on behalf of a senior software architect who BUILDS custom software systems for ecommerce, healthcare, and hospitality businesses. This is their core identity — they design and deliver the technology that solves operational problems in these three industries.

CRITICAL — every post must reflect this identity:
- The author is not a commentator or analyst — they are a builder and technology partner
- Frame every insight from the perspective of: "this is why businesses in [ecommerce/healthcare/hospitality] need better software — and this is what I build to solve it"
- The closing must always position the author as someone who solves this problem through software, not just someone observing it

The audience is: ecommerce founders, healthcare executives, hospitality operators, and investors evaluating technology capabilities.

The tone must be:
- Authoritative: the author has built these systems and knows the trade-offs
- Outcome-focused: connect every technology point to a business result
- Client-facing: the reader should think "this person understands my industry and could build this for us"

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

[Hook: one sharp sentence naming the specific operational problem this creates for ecommerce, healthcare, or hospitality businesses — make it concrete, not generic]

[Body: 2 sentences explaining what is happening and what it means for operations or software in these verticals. Every claim must come from the content above.]

What this means for your business:
• [Specific operational or software integration impact for companies in these verticals]
• [Risk or cost of inaction — what breaks or falls behind without the right systems]
• [What the author builds or architects to solve exactly this problem]

[Closing: a direct question that positions the author as someone who solves this — e.g. "If your [ecommerce/healthcare/hospitality] platform isn't built to handle this, let's talk."]

Source: ${topStory.url}

STRICT RULES:
- Every fact must come from the content above — nothing invented
- Total post length: ${lengthRule}
- The post MUST be clearly about software/technology in ecommerce, healthcare, or hospitality — if the article is only tangentially related, anchor it back to one of these three industries explicitly
- Hashtags: generate 6–10 hashtags that are highly relevant to the actual article topic, the specific industry mentioned, and the software/technology angle. Mix broad reach tags (#SoftwareDevelopment #DigitalTransformation) with specific topic tags (#Ecommercetech #HealthcareIT #HospitalityTech #AIIntegration etc). Place them at the end of the post.
- Output ONLY the post text`;
}

export function businessArchitectTwitterPrompt(params: PostPromptParams): string {
  const { topStory, date, postLengthHint } = params;
  const lengthRule = postLengthHint ?? '200 and 240 characters';
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
- Hashtags: generate 3–5 hashtags relevant to the actual article topic and industry — place them at the end
- Every claim must come from the article — do not invent
- Output ONLY the tweet text and URL, nothing else`;
}
