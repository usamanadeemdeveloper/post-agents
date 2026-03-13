import { Injectable } from "@nestjs/common";
import { HttpService } from "@nestjs/axios";
import { ConfigService } from "@nestjs/config";
import { firstValueFrom } from "rxjs";
import { AppLoggerService } from "../../core/logger/logger.service";
import { RedditPost, RealNewsItem } from "./interfaces/news-item.interface";
import { NicheProfile, resolveNiche } from "./news-niches";

const REDDIT_BASE = "https://www.reddit.com";
const GOOGLE_NEWS_BASE = "https://news.google.com/rss/search";
const NEWSAPI_BASE = "https://newsapi.org/v2/everything";

@Injectable()
export class NewsService {
  private readonly newsApiKey: string;
  private readonly niche: NicheProfile;

  constructor(
    private readonly http: HttpService,
    private readonly config: ConfigService,
    private readonly logger: AppLoggerService,
  ) {
    this.logger.setContext(NewsService.name);
    this.newsApiKey = this.config.get<string>("app.newsapi.apiKey") ?? "";
    this.niche = resolveNiche(this.config.get<string>("app.news.niche"));
    this.logger.log(`News niche: ${this.config.get<string>("app.news.niche") ?? "business-architect"}`);
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

    // Merge, deduplicate, drop items older than 7 days, then rank by:
    //   relevance × recencyBoost × popularityBoost
    // This ensures posts are both recent AND engaging — not just one or the other.
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const seen = new Set<string>();
    const merged = [...redditItems, ...googleItems, ...newsApiItems]
      .filter((item) => {
        if (!item.url || seen.has(item.url)) return false;
        seen.add(item.url);
        if (item.publishedAt && new Date(item.publishedAt).getTime() < cutoff) return false;
        return true;
      })
      .map((item) => ({
        ...item,
        _relevance: this.relevanceScore(item.title),
        _combined: this.combinedScore(item),
      }))
      .filter((item) => item._relevance > 0)
      .sort((a, b) => b._combined - a._combined)
      .slice(0, count * 4); // top candidates before article fetch

    if (merged.length === 0) {
      throw new Error("No niche-relevant stories found across all sources");
    }

    this.logger.log(
      `${merged.length} relevant candidates after scoring. Fetching full content...`,
    );

    // Fetch full article content — fall back to description snippet if scraping fails
    const withContent: RealNewsItem[] = [];

    for (const item of merged) {
      if (withContent.length >= count) break;

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { _relevance, _combined, ...rest } = item as RealNewsItem & {
        _relevance: number;
        _combined: number;
      };

      // Reddit self posts already carry their full text — skip scraping entirely
      if (rest.articleText && rest.articleText.length >= 300) {
        this.logger.log(`✓ "${item.title}" [${item.source}] — pre-attached content`);
        withContent.push(rest);
        continue;
      }

      const articleText = await this.fetchFullArticleText(item.url);

      if (articleText) {
        this.logger.log(`✓ "${item.title}" [${item.source}] — full article`);
        withContent.push({ ...rest, articleText });
      } else if (item.description && item.description.length >= 300) {
        this.logger.log(
          `✓ "${item.title}" [${item.source}] — using description snippet`,
        );
        withContent.push({
          ...rest,
          articleText: `[SUMMARY ONLY — full article unavailable. Base the post strictly on what is written below, do not expand or infer beyond it.]\n\n${item.description}`,
        });
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
      this.niche.subreddits.map((sub) => this.fetchSubredditPosts(sub)),
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
      this.niche.googleNewsQueries.map((q) => this.fetchGoogleNewsQuery(q)),
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
      this.niche.newsApiQueries.map((q) => this.fetchNewsApiQuery(q)),
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
            sortBy: "publishedAt",
            from: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
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
    return this.niche.keywords.filter((kw) => text.includes(kw)).length;
  }

  private combinedScore(item: RealNewsItem): number {
    const relevance = this.relevanceScore(item.title);

    // Recency boost: 1.0 = today, 0.6 = 3 days ago, 0.3 = 7 days ago
    let recencyBoost = 0.3;
    if (item.publishedAt) {
      const ageMs = Date.now() - new Date(item.publishedAt).getTime();
      const ageDays = ageMs / (24 * 60 * 60 * 1000);
      if (ageDays <= 1) recencyBoost = 1.0;
      else if (ageDays <= 3) recencyBoost = 0.6;
      else if (ageDays <= 5) recencyBoost = 0.4;
    }

    // Popularity boost from Reddit score + comments (capped to avoid one viral post dominating)
    const popularityBoost = 1 + Math.min(item.score / 1000, 2) + Math.min((item.commentCount ?? 0) / 200, 1);

    return relevance * recencyBoost * popularityBoost;
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

      // Detect paywall / login walls before wasting Claude tokens on junk
      if (this.isPaywalled(data)) return undefined;

      const text = this.extractArticleText(data);
      if (text.length < 300) return undefined;
      // Cap at ~8000 chars to keep Claude prompt size reasonable
      return text.slice(0, 8000);
    } catch {
      return undefined;
    }
  }

  private isPaywalled(html: string): boolean {
    const lower = html.toLowerCase();
    const signals = [
      'subscribe to read',
      'subscribe to continue',
      'subscribe for full access',
      'create a free account to continue',
      'sign in to read',
      'sign up to read',
      'this article is for subscribers',
      'premium content',
      'members only',
      'you have used all your free articles',
      'your free article limit',
      'unlock this article',
    ];
    return signals.some((s) => lower.includes(s));
  }

  private extractArticleText(html: string): string {
    // Step 1 — remove entire boilerplate sections before stripping tags
    const cleaned = html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, "")
      // Navigation, header, footer, sidebar, cookie banners, ads
      .replace(/<nav[\s\S]*?<\/nav>/gi, "")
      .replace(/<header[\s\S]*?<\/header>/gi, "")
      .replace(/<footer[\s\S]*?<\/footer>/gi, "")
      .replace(/<aside[\s\S]*?<\/aside>/gi, "")
      .replace(/<figure[\s\S]*?<\/figure>/gi, "")
      .replace(/<form[\s\S]*?<\/form>/gi, "")
      // Common boilerplate class/id patterns
      .replace(/<[^>]*(class|id)="[^"]*?(cookie|banner|popup|modal|subscribe|newsletter|related|sidebar|menu|ad-|advertisement)[^"]*?"[^>]*>[\s\S]*?<\/[a-z]+>/gi, "")
      // Strip remaining tags
      .replace(/<[^>]+>/g, " ")
      // Decode entities
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#\d+;/g, " ")
      // Collapse whitespace
      .replace(/\s{2,}/g, " ")
      .trim();

    return cleaned;
  }
}
