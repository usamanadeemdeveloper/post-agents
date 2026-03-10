export interface NewsStory {
  title: string;
  url: string;
  source: string;
  articleText?: string;
  description?: string;
}

export type PostingStyle = 'default' | 'technical' | 'marketing' | 'casual';

export type Platform = 'linkedin' | 'twitter';

export interface PostPromptParams {
  topStory: NewsStory;
  otherHeadlines: string;
  date: string;
  tone?: string;
  userName?: string;
  targetAudience?: string;
}
