import { Injectable } from "@nestjs/common";
import { HttpService } from "@nestjs/axios";
import { ConfigService } from "@nestjs/config";
import { firstValueFrom } from "rxjs";
import { AppLoggerService } from "../../core/logger/logger.service";
import { RedditPost, RealNewsItem } from "./interfaces/news-item.interface";

// ─── Reddit ───────────────────────────────────────────────────────────────────
const REDDIT_BASE = "https://www.reddit.com";
const TARGET_SUBREDDITS = [
  "ecommerce",
  "shopify",
  "AmazonSeller",
  "healthIT",
  "digitalhealth",
  "hospitality",
  "hotel",
  "softwarearchitecture",
  "entrepreneur",
  "startups",
];

// ─── Google News RSS ──────────────────────────────────────────────────────────
const GOOGLE_NEWS_BASE = "https://news.google.com/rss/search";
const GOOGLE_NEWS_QUERIES = [
  "ecommerce software technology retail",
  "healthcare technology software digital health",
  "hospitality technology hotel software",
];

// ─── NewsAPI ──────────────────────────────────────────────────────────────────
const NEWSAPI_BASE = "https://newsapi.org/v2/everything";
const NEWSAPI_QUERIES = [
  "ecommerce software OR retail technology",
  "healthcare technology OR health IT software",
  "hospitality technology OR hotel software",
];

// ─── Niche relevance scoring ──────────────────────────────────────────────────
const NICHE_KEYWORDS = [
  // Ecommerce
  "ecommerce",
  "e-commerce",
  "retail",
  "shopify",
  "amazon",
  "marketplace",
  "checkout",
  "payment",
  "cart",
  "online store",
  "online shopping",
  "merchant",
  // Healthcare
  "healthcare",
  "health tech",
  "hospital",
  "patient",
  "medical",
  "ehr",
  "telemedicine",
  "pharma",
  "clinical",
  "digital health",
  "health it",
  // Hospitality
  "hospitality",
  "hotel",
  "restaurant",
  "booking",
  "reservation",
  "travel tech",
  "property management",
  "pms",
  "guest experience",
  // Software / business (general)
  "software",
  "platform",
  "automation",
  "saas",
  "digital transformation",
  "technology",
  "ai",
  "integration",
  "efficiency",
];

@Injectable()
export class NewsService {
  private readonly newsApiKey: string;

  constructor(
    private readonly http: HttpService,
    private readonly config: ConfigService,
    private readonly logger: AppLoggerService,
  ) {
    this.logger.setContext(NewsService.name);
    this.newsApiKey = this.config.get<string>("app.newsapi.apiKey") ?? "";
  }

  async fetchTopTechStories(count = 5): Promise<RealNewsItem[]> {
    this.logger.log(
      "Fetching from Reddit, Google News, and NewsAPI in parallel...",
    );

    // Fetch from all sources simultaneously
    const [redditItems, googleItems, newsApiItems] = await Promise.all([
      this.fetchFromReddit(),
      this.fetchFromGoogleNews(),
      this.fetchFromNewsApi(),
    ]);

    this.logger.log(
      `Raw items — Reddit: ${redditItems.length} | Google News: ${googleItems.length} | NewsAPI: ${newsApiItems.length}`,
    );

    // Merge, deduplicate by URL, score for niche relevance, sort
    const seen = new Set<string>();
    const merged = [...redditItems, ...googleItems, ...newsApiItems]
      .filter((item) => {
        if (!item.url || seen.has(item.url)) return false;
        seen.add(item.url);
        return true;
      })
      .map((item) => ({
        ...item,
        _relevance: this.relevanceScore(item.title),
      }))
      .filter((item) => item._relevance > 0) // must match at least one niche keyword
      .sort((a, b) => b._relevance - a._relevance || b.score - a.score)
      .slice(0, count * 4); // top candidates before article fetch

    if (merged.length === 0) {
      throw new Error("No niche-relevant stories found across all sources");
    }

    this.logger.log(
      `${merged.length} relevant candidates after scoring. Fetching full content...`,
    );

    // Fetch full article content — only keep stories we can fully read
    const withContent: RealNewsItem[] = [];

    for (const item of merged) {
      if (withContent.length >= count) break;

      const articleText = await this.fetchFullArticleText(item.url);

      if (!articleText) {
        this.logger.warn(
          `Skipping "${item.title}" — could not fetch full content`,
        );
        continue;
      }

      this.logger.log(`✓ "${item.title}" [${item.source}]`);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { _relevance, ...rest } = item as RealNewsItem & {
        _relevance: number;
      };
      withContent.push({ ...rest, articleText });
    }

    if (withContent.length === 0) {
      throw new Error("Could not fetch full article content for any story");
    }

    this.logger.log(
      `${withContent.length} stories ready with full content. Top: "${withContent[0].title}"`,
    );

    return withContent;
  }

  // ─── Reddit ─────────────────────────────────────────────────────────────────

  private async fetchFromReddit(): Promise<RealNewsItem[]> {
    const results = await Promise.all(
      TARGET_SUBREDDITS.map((sub) => this.fetchSubredditPosts(sub)),
    );

    return results.flat().map((post) => ({
      title: post.title,
      url: post.is_self ? `${REDDIT_BASE}${post.permalink}` : post.url,
      source: `r/${post.subreddit}`,
      subreddit: post.subreddit,
      score: post.score,
      commentCount: post.num_comments,
      publishedAt: new Date(post.created_utc * 1000).toISOString(),
      // For self posts, selftext is already the full content — attach directly
      articleText:
        post.is_self &&
        post.selftext &&
        post.selftext.length >= 100 &&
        post.selftext !== "[removed]" &&
        post.selftext !== "[deleted]"
          ? post.selftext
          : undefined,
    }));
  }

  private async fetchSubredditPosts(subreddit: string): Promise<RedditPost[]> {
    try {
      const { data } = await firstValueFrom(
        this.http.get<{ data: { children: { data: RedditPost }[] } }>(
          `${REDDIT_BASE}/r/${subreddit}/hot.json?limit=10`,
          {
            headers: {
              "User-Agent": "post-agents-bot/1.0 (automated LinkedIn posting)",
            },
            timeout: 8000,
          },
        ),
      );
      return data.data.children.map((c) => ({ ...c.data, subreddit }));
    } catch {
      this.logger.warn(`r/${subreddit} unavailable — skipping`);
      return [];
    }
  }

  // ─── Google News RSS ─────────────────────────────────────────────────────────

  private async fetchFromGoogleNews(): Promise<RealNewsItem[]> {
    const results = await Promise.all(
      GOOGLE_NEWS_QUERIES.map((q) => this.fetchGoogleNewsQuery(q)),
    );
    return results.flat();
  }

  private async fetchGoogleNewsQuery(query: string): Promise<RealNewsItem[]> {
    try {
      const url = `${GOOGLE_NEWS_BASE}?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`;
      const { data } = await firstValueFrom(
        this.http.get<string>(url, {
          timeout: 8000,
          responseType: "text",
          headers: { "User-Agent": "post-agents-bot/1.0" },
        }),
      );

      return this.parseRssFeed(data, "Google News");
    } catch {
      this.logger.warn(`Google News query "${query}" failed — skipping`);
      return [];
    }
  }

  private parseRssFeed(xml: string, sourceName: string): RealNewsItem[] {
    const items = xml.match(/<item>([\s\S]*?)<\/item>/g) ?? [];

    return items
      .map((item) => {
        const title = this.extractXmlValue(item, "title");
        const link = this.extractXmlValue(item, "link");
        const pubDate = this.extractXmlValue(item, "pubDate");

        if (!title || !link) return null;

        return {
          title,
          url: link,
          source: sourceName,
          subreddit: "",
          score: 0,
          commentCount: 0,
          publishedAt: pubDate
            ? new Date(pubDate).toISOString()
            : new Date().toISOString(),
        } as RealNewsItem;
      })
      .filter((item): item is RealNewsItem => item !== null);
  }

  private extractXmlValue(xml: string, tag: string): string {
    const cdataMatch = xml.match(
      new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]></${tag}>`),
    );
    if (cdataMatch) return cdataMatch[1].trim();
    const plainMatch = xml.match(
      new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`),
    );
    return plainMatch ? plainMatch[1].trim() : "";
  }

  // ─── NewsAPI ─────────────────────────────────────────────────────────────────

  private async fetchFromNewsApi(): Promise<RealNewsItem[]> {
    if (!this.newsApiKey) {
      this.logger.warn("NEWSAPI_KEY not set — skipping NewsAPI source");
      return [];
    }

    const results = await Promise.all(
      NEWSAPI_QUERIES.map((q) => this.fetchNewsApiQuery(q)),
    );

    return results.flat();
  }

  private async fetchNewsApiQuery(query: string): Promise<RealNewsItem[]> {
    try {
      const { data } = await firstValueFrom(
        this.http.get<{
          articles: {
            title: string;
            url: string;
            source: { name: string };
            publishedAt: string;
          }[];
        }>(NEWSAPI_BASE, {
          params: {
            q: query,
            language: "en",
            sortBy: "popularity",
            pageSize: 10,
            apiKey: this.newsApiKey,
          },
          timeout: 8000,
        }),
      );

      return data.articles
        .filter((a) => a.title && a.url && !a.url.includes("removed"))
        .map((a) => ({
          title: a.title,
          url: a.url,
          source: a.source.name,
          subreddit: "",
          score: 0,
          commentCount: 0,
          publishedAt: a.publishedAt,
        }));
    } catch {
      this.logger.warn(`NewsAPI query "${query}" failed — skipping`);
      return [];
    }
  }

  // ─── Shared utilities ────────────────────────────────────────────────────────

  private relevanceScore(title: string): number {
    const text = title.toLowerCase();
    return NICHE_KEYWORDS.filter((kw) => text.includes(kw)).length;
  }

  private async fetchFullArticleText(url: string): Promise<string | undefined> {
    try {
      const { data } = await firstValueFrom(
        this.http.get<string>(url, {
          timeout: 10000,
          headers: {
            "User-Agent": "Mozilla/5.0 (compatible; post-agents-bot/1.0)",
            Accept: "text/html,application/xhtml+xml",
          },
          responseType: "text",
        }),
      );

      const text = this.stripHtml(data);
      if (text.length < 200) return undefined;
      return text;
    } catch {
      return undefined;
    }
  }

  private stripHtml(html: string): string {
    return html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/\s{2,}/g, " ")
      .trim();
  }
}
