export interface NewsStory {
  title: string;
  source: string;
  url: string;
  articleText?: string;
}

export interface BasePromptParams {
  userName?: string;
  tone?: string;
  targetAudience?: string;
  platform?: string;
}

export interface PostPromptParams extends BasePromptParams {
  topStory: NewsStory;
  otherHeadlines?: string;
  date: string;
}

export type PostingStyle = 'default' | 'technical' | 'marketing' | 'casual';

export type Platform = 'linkedin' | 'twitter';
