export interface NewsStory {
  title: string;
  url: string;
  source: string;
  articleText?: string;
  description?: string;
}

export type PostingStyle = 'default' | 'technical' | 'marketing' | 'casual' | 'business-architect';

export type Platform = 'linkedin' | 'twitter';

export interface PostPromptParams {
  topStory: NewsStory;
  otherHeadlines: string;
  date: string;
  tone?: string;
  userName?: string;
  targetAudience?: string;
  hashtags?: string;        // overrides the default hashtags in the prompt
  postLengthHint?: string;  // overrides the default length range e.g. "700–950 characters"
}
