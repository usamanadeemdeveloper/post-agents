import { Injectable } from "@nestjs/common";
import { HttpService } from "@nestjs/axios";
import { ConfigService } from "@nestjs/config";
import { firstValueFrom } from "rxjs";
import { AppLoggerService } from "../../core/logger/logger.service";
import { RedditPost, RealNewsItem } from "./interfaces/news-item.interface";
import { evergreenSourcePacksFor } from "./evergreen-source-packs";
import { NicheProfile, resolveNiche } from "./news-niches";

const REDDIT_BASE = "https://www.reddit.com";
const GOOGLE_NEWS_BASE = "https://news.google.com/rss/search";
const NEWSAPI_BASE = "https://newsapi.org/v2/everything";
const DEVTO_BASE = "https://dev.to/api";

// Known paywalled domains — articles from these are skipped before scraping
const PAYWALLED_DOMAINS = [
  "wsj.com", "nytimes.com", "bloomberg.com", "ft.com",
  "washingtonpost.com", "economist.com", "barrons.com",
  "seekingalpha.com", "hbr.org", "thetimes.co.uk", "telegraph.co.uk",
  "theatlantic.com", "businessinsider.com", "fortune.com",
  "forbes.com", "inc.com",
];

const PR_WIRE_DOMAINS = [
  "globenewswire.com",
  "prnewswire.com",
  "businesswire.com",
  "accessnewswire.com",
];

const OFFICIAL_SOURCE_DOMAINS = [
  "shopify.com",
  "klaviyo.com",
  "stripe.com",
  "cloudbeds.com",
  "mews.com",
  "amazon.com",
  "google.com",
  "meta.com",
  "microsoft.com",
  "salesforce.com",
];

const TRUSTED_EDITORIAL_DOMAINS = [
  "digitalcommerce360.com",
  "retaildive.com",
  "modernretail.co",
  "chainstoreage.com",
  "pymnts.com",
  "healthcareitnews.com",
  "mobihealthnews.com",
  "fiercehealthcare.com",
  "medcitynews.com",
  "beckershospitalreview.com",
  "hospitalitynet.org",
  "hoteltechreport.com",
  "skift.com",
  "techcrunch.com",
  "venturebeat.com",
];

@Injectable()
export class NewsService {
  private readonly newsApiKey: string;
  private readonly niche: NicheProfile;
  private readonly researchWindowDays: number;
  private readonly allowEvergreenFallback: boolean;

  constructor(
    private readonly http: HttpService,
    private readonly config: ConfigService,
    private readonly logger: AppLoggerService,
  ) {
    this.logger.setContext(NewsService.name);
    this.newsApiKey = this.config.get<string>("app.newsapi.apiKey") ?? "";
    this.niche = resolveNiche(this.config.get<string>("app.news.niche"));
    this.researchWindowDays =
      this.config.get<number>("app.news.researchWindowDays") ?? 30;
    this.allowEvergreenFallback =
      this.config.get<boolean>("app.news.allowEvergreenFallback") ?? true;
    this.logger.log(`News niche: ${this.config.get<string>("app.news.niche") ?? "business-architect"}`);
  }

  async fetchTopTechStories(count = 5): Promise<RealNewsItem[]> {
    this.logger.log(
      "Fetching from Reddit, Google News, and NewsAPI in parallel...",
    );

    // Fetch from all sources simultaneously
    const [redditItems, googleItems, newsApiItems, devToItems] = await Promise.all([
      this.niche.allowCommunitySources
        ? this.fetchFromReddit()
        : Promise.resolve([]),
      this.fetchFromGoogleNews(),
      this.fetchFromNewsApi(),
      this.niche.allowCommunitySources
        ? this.fetchFromDevTo()
        : Promise.resolve([]),
    ]);

    this.logger.log(
      `Raw items — Reddit: ${redditItems.length} | Google News: ${googleItems.length} | NewsAPI: ${newsApiItems.length} | Dev.to: ${devToItems.length}`,
    );

    // Merge, deduplicate, drop items older than the research window, then rank by:
    //   relevance × recencyBoost × popularityBoost
    // This ensures posts are recent, but not so fresh that quality collapses.
    const cutoff = Date.now() - this.researchWindowDays * 24 * 60 * 60 * 1000;
    const seen = new Set<string>();
    const skipCounts = {
      duplicateOrMissingUrl: 0,
      blockedDomain: 0,
      olderThanWindow: 0,
      lowRelevance: 0,
      fetchFailed: 0,
      languageMismatch: 0,
      nicheMismatch: 0,
    };
    const merged = [...redditItems, ...googleItems, ...newsApiItems, ...devToItems]
      .filter((item) => {
        if (!item.url || seen.has(item.url)) {
          skipCounts.duplicateOrMissingUrl += 1;
          return false;
        }
        if (this.isBlockedDomain(item.url)) {
          skipCounts.blockedDomain += 1;
          return false;
        }
        seen.add(item.url);
        if (item.publishedAt && new Date(item.publishedAt).getTime() < cutoff) {
          skipCounts.olderThanWindow += 1;
          return false;
        }
        return true;
      })
      .map((item) => ({
        ...item,
        _relevance: this.relevanceScore(item.title),
        _combined: this.combinedScore(item),
      }))
      .filter((item) => {
        const keep = item._relevance > 0;
        if (!keep) skipCounts.lowRelevance += 1;
        return keep;
      })
      .sort((a, b) => b._combined - a._combined)
      .slice(0, count * 10); // wider candidate pool improves hit rate for full-text fetches

    if (merged.length === 0) {
      throw new Error("No niche-relevant stories found across all sources");
    }

    this.logger.log(
      `${merged.length} relevant candidates after scoring. Fetching full content...`,
    );

    // Fetch full article content for the strongest candidates, then re-rank by source quality.
    const withContent: RealNewsItem[] = [];

    for (const item of merged) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { _relevance, _combined, ...rest } = item as RealNewsItem & {
        _relevance: number;
        _combined: number;
      };

      // Reddit self posts already carry their full text — skip scraping entirely
      if (rest.articleText && rest.articleText.length >= 300) {
        this.logger.log(`✓ "${item.title}" [${item.source}] — pre-attached content`);
        withContent.push({
          ...rest,
          sourceDomain: this.extractDomain(rest.url),
        });
        continue;
      }

      // Dev.to articles — fetch full markdown via API (always available, no scraping)
      if (rest.devToId) {
        const markdown = await this.fetchDevToArticle(rest.devToId);
        if (markdown && markdown.length >= 300) {
          this.logger.log(`✓ "${item.title}" [Dev.to] — full markdown`);
          withContent.push({
            ...rest,
            articleText: markdown.slice(0, 8000),
            sourceDomain: this.extractDomain(rest.url),
          });
          continue;
        }
        this.logger.warn(`Skipping "${item.title}" — Dev.to markdown unavailable`);
        skipCounts.fetchFailed += 1;
        continue;
      }

      // All other sources — scrape the article URL
      const fetched = await this.fetchFullArticleText(item.url);

      if (fetched) {
        this.logger.log(`✓ "${item.title}" [${item.source}] — full article`);
        withContent.push({
          ...rest,
          articleText: fetched.text,
          url: fetched.resolvedUrl,
          sourceDomain: fetched.sourceDomain,
        });
      } else {
        this.logger.warn(`Skipping "${item.title}" — could not fetch full article text`);
        skipCounts.fetchFailed += 1;
      }
    }

    if (withContent.length === 0) {
      this.logger.warn(
        `No fetched full-text stories available. blocked=${skipCounts.blockedDomain}, fetchFailed=${skipCounts.fetchFailed}, lowRelevance=${skipCounts.lowRelevance}, olderThanWindow=${skipCounts.olderThanWindow}`,
      );
      if (this.allowEvergreenFallback) {
        const evergreenStories = this.getEvergreenFallbackStories(count);
        if (evergreenStories.length > 0) {
          this.logger.log(
            `Using ${evergreenStories.length} evergreen source pack(s) for niche "${this.niche.name}"`,
          );
          return evergreenStories;
        }
      }
      throw new Error("Could not get full article content for any story");
    }

    const englishStories = withContent.filter((item) => {
      const english = this.isEnglishContent(item);
      if (!english) skipCounts.languageMismatch += 1;
      return english;
    });

    const nicheAlignedStories = englishStories.filter((item) => {
      const aligned = this.isNicheAligned(item);
      if (!aligned) skipCounts.nicheMismatch += 1;
      return aligned;
    });

    if (nicheAlignedStories.length === 0) {
      this.logger.warn(
        `Fetched stories failed validation. languageMismatch=${skipCounts.languageMismatch}, nicheMismatch=${skipCounts.nicheMismatch}`,
      );
      if (this.allowEvergreenFallback) {
        const evergreenStories = this.getEvergreenFallbackStories(count);
        if (evergreenStories.length > 0) {
          this.logger.log(
            `Using ${evergreenStories.length} evergreen source pack(s) after niche validation removed all fetched stories`,
          );
          return evergreenStories;
        }
      }
      throw new Error("No fetched stories matched the configured niche after content validation");
    }

    const rankedStories = nicheAlignedStories
      .map((item) => ({
        ...item,
        _finalScore: this.finalStoryScore(item),
      }))
      .sort((a, b) => b._finalScore - a._finalScore)
      .slice(0, count)
      .map(({ _finalScore, ...item }) => item);

    this.logger.log(
      `${rankedStories.length} stories ready with full content. Top: "${rankedStories[0].title}"`,
    );

    return rankedStories;
  }

  getGuaranteedFallbackStories(count = 5): RealNewsItem[] {
    const fallbackStories = evergreenSourcePacksFor(this.niche.name)
      .filter((item) => this.isNicheAligned(item))
      .slice(0, count);

    if (fallbackStories.length === 0) {
      throw new Error(`No evergreen fallback stories configured for niche "${this.niche.name}"`);
    }

    return fallbackStories;
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
              from: new Date(Date.now() - this.researchWindowDays * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
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

  // ─── Dev.to ──────────────────────────────────────────────────────────────────

  private async fetchFromDevTo(): Promise<RealNewsItem[]> {
    const results = await Promise.all(
      this.niche.devToTags.map((tag) => this.fetchDevToByTag(tag)),
    );
    return results.flat();
  }

  private async fetchDevToByTag(tag: string): Promise<RealNewsItem[]> {
    try {
      const { data } = await firstValueFrom(
        this.http.get<{
          id: number;
          title: string;
          url: string;
          description?: string;
          published_timestamp: string;
          positive_reactions_count: number;
          comments_count: number;
        }[]>(`${DEVTO_BASE}/articles`, {
          params: { tag, per_page: 10, top: 7 },
          timeout: 8000,
          headers: { "User-Agent": "post-agents-bot/1.0" },
        }),
      );

      return data
        .filter((a) => a.title && a.id)
        .map((a) => ({
          title: a.title,
          url: a.url,
          source: "Dev.to",
          subreddit: "",
          score: a.positive_reactions_count ?? 0,
          commentCount: a.comments_count ?? 0,
          publishedAt: a.published_timestamp,
          description: a.description || undefined,
          devToId: a.id,
        }));
    } catch {
      this.logger.warn(`Dev.to tag "${tag}" failed — skipping`);
      return [];
    }
  }

  private async fetchDevToArticle(id: number): Promise<string | undefined> {
    try {
      const { data } = await firstValueFrom(
        this.http.get<{ body_markdown?: string }>(`${DEVTO_BASE}/articles/${id}`, {
          timeout: 8000,
          headers: { "User-Agent": "post-agents-bot/1.0" },
        }),
      );
      const markdown = data.body_markdown?.trim();
      return markdown && markdown.length > 0 ? markdown : undefined;
    } catch {
      return undefined;
    }
  }

  // ─── Shared utilities ────────────────────────────────────────────────────────

  private isBlockedDomain(url: string): boolean {
    const hostname = this.extractDomain(url);
    return [...PAYWALLED_DOMAINS, ...PR_WIRE_DOMAINS]
      .some((d) => hostname === d || hostname.endsWith(`.${d}`));
  }

  private extractDomain(url: string): string {
    try {
      return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
    } catch {
      return "";
    }
  }

  private finalStoryScore(item: RealNewsItem): number {
    const contentRichnessBoost = Math.min(
      Math.max((item.articleText?.length ?? 0) / 3500, 0.6),
      1.2,
    );
    return this.combinedScore(item)
      * this.sourceAuthorityBoost(item)
      * contentRichnessBoost
      * this.nicheAlignmentBoost(item);
  }

  private nicheAlignmentBoost(item: RealNewsItem): number {
    if (this.niche.name !== "business-architect") return 1;
    const text = `${item.title} ${item.articleText ?? ""}`.toLowerCase();
    const verticalHits = this.countMatches(text, [
      "ecommerce", "e-commerce", "retail", "shopify", "woocommerce", "magento",
      "merchant", "checkout", "marketplace", "hospital", "clinic", "patient",
      "healthcare", "digital health", "health system", "hotel", "hospitality",
      "restaurant", "guest", "reservation", "travel",
    ]);
    const techHits = this.countMatches(text, [
      "software", "platform", "integration", "api", "automation", "system",
      "saas", "cloud", "digital", "data", "ehr", "emr", "portal", "workflow",
      "property management system", "pms", "booking engine", "architecture",
      "infrastructure",
    ]);

    if (verticalHits > 0 && techHits > 0) return 1.15;
    return 1;
  }

  private isNicheAligned(item: RealNewsItem): boolean {
    const text = `${item.title} ${item.articleText ?? ""}`.toLowerCase();

    if (this.niche.name === "business-architect") {
      const verticalHits = this.countMatches(text, [
        "ecommerce", "e-commerce", "retail", "shopify", "woocommerce", "magento",
        "merchant", "checkout", "marketplace", "hospital", "clinic", "patient",
        "healthcare", "digital health", "health system", "hotel", "hospitality",
        "restaurant", "guest", "reservation", "travel",
      ]);
      const techHits = this.countMatches(text, [
        "software", "platform", "integration", "api", "automation", "system",
        "saas", "cloud", "digital", "data", "ehr", "emr", "portal", "workflow",
        "property management system", "pms", "booking engine", "architecture",
        "infrastructure",
      ]);
      return verticalHits > 0 && techHits > 0;
    }

    return this.relevanceScore(text) > 0;
  }

  private isEnglishContent(item: RealNewsItem): boolean {
    const sample = `${item.title} ${item.articleText ?? ""}`.toLowerCase().slice(0, 3000);
    if (!sample.trim()) return true;

    const englishSignals = this.countMatches(sample, [
      " the ", " and ", " for ", " with ", " this ", " that ", " from ", " into ",
      "software", "platform", "system", "build", "developer", "business", "engineering",
    ]);
    const portugueseSignals = this.countMatches(sample, [
      " uma ", " para ", " com ", " que ", " como ", " mais ", " uma ", " este ",
      " essa ", " isso ", " onde ", " ainda ", " deploy ", " usando ", " branch ",
      " times ", " fluxo ", " curva de aprendizado", " além de",
    ]) + this.countRegexMatches(sample, /[ãõçáéíóúâêôà]/g);

    return englishSignals >= portugueseSignals;
  }

  private countMatches(text: string, terms: string[]): number {
    return terms.filter((term) => text.includes(term)).length;
  }

  private countRegexMatches(text: string, pattern: RegExp): number {
    return text.match(pattern)?.length ?? 0;
  }

  private sourceAuthorityBoost(item: RealNewsItem): number {
    const domain = item.sourceDomain ?? this.extractDomain(item.url);
    if (!domain) return 1;
    if (OFFICIAL_SOURCE_DOMAINS.some((d) => domain === d || domain.endsWith(`.${d}`))) {
      return 1.4;
    }
    if (TRUSTED_EDITORIAL_DOMAINS.some((d) => domain === d || domain.endsWith(`.${d}`))) {
      return 1.2;
    }
    if (domain === "news.google.com") return 0.8;
    if (domain === "reddit.com" || domain.endsWith(".reddit.com")) return 0.6;
    if (domain === "dev.to") return 0.6;
    return 1;
  }

  private relevanceScore(title: string): number {
    const text = title.toLowerCase();
    return this.niche.keywords.filter((kw) => text.includes(kw)).length;
  }

  private combinedScore(item: RealNewsItem): number {
    const relevance = this.relevanceScore(item.title);

    // Recency still matters, but we deliberately allow a wider research window for better quality.
    let recencyBoost = 0.35;
    if (item.publishedAt) {
      const ageMs = Date.now() - new Date(item.publishedAt).getTime();
      const ageDays = ageMs / (24 * 60 * 60 * 1000);
      if (ageDays <= 1) recencyBoost = 1.0;
      else if (ageDays <= 3) recencyBoost = 0.85;
      else if (ageDays <= 7) recencyBoost = 0.72;
      else if (ageDays <= 15) recencyBoost = 0.58;
      else if (ageDays <= 30) recencyBoost = 0.46;
    }

    // Popularity boost from Reddit score + comments (capped to avoid one viral post dominating)
    const popularityBoost = 1 + Math.min(item.score / 1000, 2) + Math.min((item.commentCount ?? 0) / 200, 1);

    return relevance * recencyBoost * popularityBoost;
  }

  private async fetchFullArticleText(url: string): Promise<{ text: string; resolvedUrl: string; sourceDomain: string } | undefined> {
    try {
      const response = await firstValueFrom(
        this.http.get<string>(url, {
          timeout: 10000,
          headers: {
            "User-Agent": "Mozilla/5.0 (compatible; post-agents-bot/1.0)",
            Accept: "text/html,application/xhtml+xml",
          },
          responseType: "text",
        }),
      );

      // Capture the final URL after redirects (handles Google News CBMi... redirect URLs)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const resolvedUrl: string = (response.request as any)?.res?.responseUrl || url;
      const sourceDomain = this.extractDomain(resolvedUrl);

      // Detect paywall / login walls before wasting Claude tokens on junk
      if (this.isBlockedDomain(resolvedUrl) || this.isPaywalled(response.data)) return undefined;

      const text = this.extractArticleText(response.data);
      if (text.length < 300) return undefined;
      // Cap at ~8000 chars to keep Claude prompt size reasonable
      return { text: text.slice(0, 8000), resolvedUrl, sourceDomain };
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
    const fragment = this.extractLikelyArticleFragment(html) || html;
    return this.htmlToText(fragment);
  }

  private extractLikelyArticleFragment(html: string): string | undefined {
    const candidates = [
      ...this.collectHtmlMatches(/<article\b[^>]*>([\s\S]*?)<\/article>/gi, html),
      ...this.collectHtmlMatches(/<main\b[^>]*>([\s\S]*?)<\/main>/gi, html),
      ...this.collectHtmlMatches(
        /<(?:section|div)\b[^>]*(?:class|id)="[^"]*(?:article-body|article-content|story-body|story-content|entry-content|post-content|content-body|main-content|article__content|article-copy|rich-text|post-body|wysiwyg)[^"]*"[^>]*>([\s\S]*?)<\/(?:section|div)>/gi,
        html,
      ),
    ];

    const viable = candidates
      .map((candidate) => ({
        html: candidate,
        textLength: this.htmlToText(candidate).length,
      }))
      .filter((candidate) => candidate.textLength >= 300)
      .sort((a, b) => b.textLength - a.textLength);

    return viable[0]?.html;
  }

  private collectHtmlMatches(pattern: RegExp, html: string): string[] {
    const matches: string[] = [];
    for (const match of html.matchAll(pattern)) {
      const fragment = match[1]?.trim();
      if (fragment) matches.push(fragment);
    }
    return matches;
  }

  private getEvergreenFallbackStories(count: number): RealNewsItem[] {
    return this.getGuaranteedFallbackStories(count);
  }

  private htmlToText(html: string): string {
    return html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, "")
      .replace(/<svg[\s\S]*?<\/svg>/gi, "")
      .replace(/<!--[\s\S]*?-->/g, "")
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
      .replace(/&#39;/g, "'")
      .replace(/&#\d+;/g, " ")
      // Collapse whitespace
      .replace(/\s{2,}/g, " ")
      .trim();
  }
}
