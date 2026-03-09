export interface RedditPost {
  title: string;
  url: string;
  selftext?: string; // full text for self/text posts — no scraping needed
  score: number;
  num_comments: number;
  created_utc: number;
  domain: string;
  is_self: boolean; // true = text post (selftext available), false = link post
  permalink: string;
  subreddit: string;
}

export interface RealNewsItem {
  title: string;
  url: string;
  source: string;
  subreddit: string;
  score: number;
  commentCount: number;
  publishedAt: string;
  description?: string; // snippet from RSS/NewsAPI — used as fallback if full article can't be scraped
  articleText?: string; // full article text when successfully scraped
}
