import { Injectable } from "@nestjs/common";
import { HttpService } from "@nestjs/axios";
import { ConfigService } from "@nestjs/config";
import { firstValueFrom } from "rxjs";
import { AppLoggerService } from "../../core/logger/logger.service";
import { RedditPost, RealNewsItem } from "./interfaces/news-item.interface";

// ─── Reddit ───────────────────────────────────────────────────────────────────
const REDDIT_BASE = "https://www.reddit.com";
const TARGET_SUBREDDITS = [
  "programming",
  "softwarearchitecture",
  "webdev",
  "javascript",
  "typescript",
  "reactjs",
  "nextjs",
  "node",
  "devops",
  "aws",
  "machinelearning",
  "artificial",
  "LocalLLaMA",
  "experienceddevs",
];

// ─── Google News RSS ──────────────────────────────────────────────────────────
const GOOGLE_NEWS_BASE = "https://news.google.com/rss/search";
const GOOGLE_NEWS_QUERIES = [
  "TypeScript OR JavaScript OR Python release update framework",
  "AI agents OR LLM developer tools OR coding assistant open source",
  "React OR Next.js OR Node.js OR Vite OR Angular release",
  "AWS OR Kubernetes OR Docker OR DevOps engineering update",
];

// ─── NewsAPI ──────────────────────────────────────────────────────────────────
const NEWSAPI_BASE = "https://newsapi.org/v2/everything";
const NEWSAPI_QUERIES = [
  "TypeScript OR JavaScript OR Python OR Rust OR Go framework release",
  "AI agents OR LLM tooling OR developer productivity OR coding assistant",
  "React OR Next.js OR Node.js OR web framework update",
  "Kubernetes OR Docker OR AWS OR DevOps OR platform engineering",
];

// ─── Developer relevance scoring ──────────────────────────────────────────────
const NICHE_KEYWORDS = [
  // Languages / runtimes
  "typescript",
  "javascript",
  "python",
  "rust",
  "golang",
  "go ",
  "java",
  "node",
  // Frameworks / stacks
  "react",
  "next.js",
  "nextjs",
  "vue",
  "angular",
  "svelte",
  "spring",
  "django",
  "laravel",
  "vite",
  // AI / agents
  "llm",
  "agent",
  "agents",
  "ai",
  "model",
  "inference",
  "prompt",
  "copilot",
  "rag",
  // Dev tooling / architecture
  "developer tool",
  "devtools",
  "sdk",
  "api",
  "open source",
  "github",
  "release",
  "changelog",
  "framework",
  "runtime",
  "architecture",
  "performance",
  "scalability",
  "benchmark",
  "security",
  "cve",
  // Cloud / platform engineering
  "devops",
  "kubernetes",
  "docker",
  "aws",
  "gcp",
  "azure",
  "serverless",
  "platform engineering",
  "ci/cd",
  "software",
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

    // Merge, deduplicate by URL, score for developer relevance, sort
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
      .filter((item) => item._relevance > 0) // must match at least one dev keyword
      .sort((a, b) => b._relevance - a._relevance || b.score - a.score)
      .slice(0, count * 4); // top candidates before article fetch

    if (merged.length === 0) {
      throw new Error("No developer-relevant stories found across all sources");
    }

    this.logger.log(
      `${merged.length} relevant candidates after scoring. Fetching full content...`,
    );

    // Fetch full article content — fall back to description snippet if scraping fails
    const withContent: RealNewsItem[] = [];

    for (const item of merged) {
      if (withContent.length >= count) break;

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { _relevance, ...rest } = item as RealNewsItem & {
        _relevance: number;
      };

      const articleText = await this.fetchFullArticleText(item.url);

      if (articleText) {
        this.logger.log(`✓ "${item.title}" [${item.source}] — full article`);
        withContent.push({ ...rest, articleText });
      } else if (item.description && item.description.length >= 80) {
        this.logger.log(
          `✓ "${item.title}" [${item.source}] — using description snippet`,
        );
        withContent.push({ ...rest, articleText: item.description });
      } else {
        this.logger.warn(
          `Skipping "${item.title}" — no usable content (scrape failed, no description)`,
        );
      }
    }

    if (withContent.length === 0) {
      throw new Error(
        "Could not get content for any story (all scraped + no descriptions available)",
      );
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
        const description = this.extractXmlValue(item, "description");

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
          description: description || undefined,
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
            description?: string;
            content?: string;
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
          // NewsAPI description is usually 150-200 chars; content has up to ~200 chars
          description: a.description || a.content || undefined,
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
