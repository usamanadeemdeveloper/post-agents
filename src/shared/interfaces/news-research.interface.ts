export interface TrendingTopic {
  title: string;
  summary: string;
  why_it_matters: string;
  tags: string[];
}

export interface NewsResearchResult {
  date: string;
  topics: TrendingTopic[];
  raw_insight: string;
}
