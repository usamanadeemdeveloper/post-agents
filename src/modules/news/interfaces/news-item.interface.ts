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
  description?: string;
  articleText?: string; // full article text — required before a story can be used
  devToId?: number;     // Dev.to article ID — used to fetch body_markdown via API
  sourceDomain?: string;
}
