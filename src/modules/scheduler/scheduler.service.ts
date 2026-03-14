import { Injectable } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { ConfigService } from "@nestjs/config";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { ClaudeService } from "../claude/claude.service";
import { LinkedInService } from "../linkedin/linkedin.service";
import { TwitterService } from "../twitter/twitter.service";
import { NewsService } from "../news/news.service";
import { SlackService } from "../slack/slack.service";
import { RealNewsItem } from "../news/interfaces/news-item.interface";
import { buildPostFooter } from "../../shared/constants/post-footer";
import { AppLoggerService } from "../../core/logger/logger.service";
import {
  DailyRunResult,
  SocialPostResult,
} from "../../shared/interfaces/social-post.interface";

type Platform = "linkedin" | "twitter";

interface PostedStoryEntry {
  fingerprint: string;
  normalizedUrl: string;
  normalizedTitle: string;
  source: string;
  originalUrl: string;
  originalTitle: string;
  postedAt: string;
  platforms: Platform[];
  linkedinHash?: string;
  twitterHash?: string;
  linkedinSignature?: string;
  twitterSignature?: string;
}

interface PostHistory {
  version: 1;
  entries: PostedStoryEntry[];
}

const HISTORY_VERSION = 1 as const;
const DEFAULT_POST_HISTORY_FILE = ".post-history.json";
const MAX_HISTORY_ENTRIES = 400;
const MAX_GENERATION_ATTEMPTS = 3;
const DEFAULT_CONTENT_SIMILARITY_THRESHOLD = 0.8;

@Injectable()
export class SchedulerService {
  private readonly linkedinEnabled: boolean;
  private readonly twitterEnabled: boolean;
  private readonly contentSimilarityThreshold: number;

  constructor(
    private readonly news: NewsService,
    private readonly claude: ClaudeService,
    private readonly linkedin: LinkedInService,
    private readonly twitter: TwitterService,
    private readonly slack: SlackService,
    private readonly config: ConfigService,
    private readonly logger: AppLoggerService,
  ) {
    this.logger.setContext(SchedulerService.name);

    this.linkedinEnabled = !!(
      this.config.get("app.linkedin.accessToken") &&
      this.config.get("app.linkedin.personUrn")
    );

    this.twitterEnabled = !!(
      this.config.get("app.twitter.appKey") &&
      this.config.get("app.twitter.appSecret") &&
      this.config.get("app.twitter.accessToken") &&
      this.config.get("app.twitter.accessSecret")
    );
    this.contentSimilarityThreshold =
      this.config.get<number>("app.scheduler.contentSimilarityThreshold") ??
      DEFAULT_CONTENT_SIMILARITY_THRESHOLD;

    if (!this.linkedinEnabled && !this.twitterEnabled) {
      throw new Error(
        "No social platform configured. Set credentials for at least LinkedIn or Twitter/X in your .env file.",
      );
    }

    this.logger.log(
      `Platforms enabled — LinkedIn: ${this.linkedinEnabled ? "✓" : "✗"}  Twitter: ${this.twitterEnabled ? "✓" : "✗"}`,
    );
    this.logger.log(
      `Content similarity threshold: ${this.contentSimilarityThreshold}`,
    );
  }

  @Cron(process.env.CRON_SCHEDULE!, {
    name: "daily-tech-post",
    timeZone: "UTC",
  })
  async runDailyPost(): Promise<DailyRunResult> {
    const runAt = new Date();
    const date = runAt.toISOString().split("T")[0];
    this.logger.log(`=== Daily post job started at ${runAt.toISOString()} ===`);

    // Step 1 — fetch real news
    const storyCount = this.config.get<number>("app.news.storyCount") ?? 10;
    let stories: RealNewsItem[];
    try {
      stories = await this.news.fetchTopTechStories(storyCount);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `News fetch failed. Falling back to guaranteed source packs. Reason: ${message}`,
      );
      stories = this.news.getGuaranteedFallbackStories(storyCount);
    }
    const postHistory = await this.loadPostHistory();
    let freshStories = this.excludePreviouslyPostedStories(
      stories,
      postHistory,
    );

    if (freshStories.length === 0) {
      this.logger.warn(
        "All candidate stories were already posted previously. Falling back to evergreen rotation.",
      );
      freshStories = this.excludePreviouslyPostedStories(
        this.news.getGuaranteedFallbackStories(storyCount),
        postHistory,
      );
    }

    if (freshStories.length === 0) {
      this.logger.warn(
        "Fallback stories were also previously posted. Reusing fallback stories to avoid an empty run.",
      );
      freshStories = this.news.getGuaranteedFallbackStories(storyCount);
    }

    const selectedStories = this.selectPrimaryStoryForRun(freshStories, runAt);
    let generation;
    try {
      generation = await this.generateNonDuplicateContent(
        selectedStories,
        date,
        postHistory,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const fallbackStory = selectedStories[0] ?? this.news.getGuaranteedFallbackStories(1)[0];
      this.logger.warn(
        `Claude generation failed. Publishing deterministic fallback content instead. Reason: ${message}`,
      );
      generation = {
        ...this.claude.generateDeterministicFallbackPosts(
          fallbackStory,
          date,
          {
            linkedin: this.linkedinEnabled,
            twitter: this.twitterEnabled,
          },
        ),
        story: fallbackStory,
      };
    }
    let linkedInContent = generation.linkedInContent;
    let tweetContent = generation.tweetContent;
    const chosenStory = generation.story;
    this.logger.log(
      `Primary story for this run: "${chosenStory.title}" (${chosenStory.source})`,
    );

    // Step 3 — Slack approval gate (skipped if Slack is not configured)
    if (this.slack.enabled) {
      const niche = this.config.get<string>("app.news.niche") ?? "business-architect";
      const variantCount = this.slack.variantCount;

      // Generate additional variants if more than 1 requested (first variant already generated above)
      let variants = [{ linkedInContent, tweetContent }];
      if (variantCount > 1) {
        const extra = await Promise.allSettled(
          Array.from({ length: variantCount - 1 }, () =>
            this.claude.generatePosts(selectedStories, date, {
              linkedin: this.linkedinEnabled,
              twitter: this.twitterEnabled,
            }),
          ),
        );
        for (const result of extra) {
          if (result.status === "fulfilled") {
            variants.push(result.value);
          }
        }
      }

      const { ts } = await this.slack.postForApproval({
        niche,
        storyTitle: chosenStory.title,
        variants,
      });

      const selected = await this.slack.waitForApproval(ts, variants.length);
      if (selected === null) {
        this.logger.log("Publish aborted — Slack approval timed out");
        const aborted: SocialPostResult = {
          platform: "linkedin",
          success: false,
          error: "slack:timeout",
          postedAt: runAt,
        };
        return {
          runAt,
          linkedinResult: { ...aborted, platform: "linkedin" },
          twitterResult: { ...aborted, platform: "twitter" },
        };
      }

      // Use the chosen variant's content for publishing
      const chosen = variants[selected - 1];
      linkedInContent = chosen.linkedInContent;
      tweetContent = chosen.tweetContent;
      this.logger.log(`Publishing variant ${selected} as selected in Slack`);
    }

    // Step 4 — publish to whichever platforms are configured
    const skipped: SocialPostResult = {
      platform: "linkedin",
      success: false,
      error: "not configured",
      postedAt: runAt,
    };

    const [linkedinResult, twitterResult] = await Promise.all([
      this.linkedinEnabled && linkedInContent
        ? this.linkedin.createPost(linkedInContent)
        : Promise.resolve({ ...skipped, platform: "linkedin" as const }),
      this.twitterEnabled && tweetContent
        ? this.twitter.tweet(tweetContent)
        : Promise.resolve({ ...skipped, platform: "twitter" as const }),
    ]);

    const result: DailyRunResult = { runAt, linkedinResult, twitterResult };
    await this.persistPostedStory(
      result,
      chosenStory,
      runAt,
      postHistory,
      linkedInContent,
      tweetContent,
    );

    if (this.linkedinEnabled)
      this.logger.log(
        `LinkedIn: ${linkedinResult.success ? "POSTED ✓" : `FAILED — ${linkedinResult.error}`}`,
      );
    if (this.twitterEnabled)
      this.logger.log(
        `Twitter:  ${twitterResult.success ? "POSTED ✓" : `FAILED — ${twitterResult.error}`}`,
      );
    this.logger.log(`=== Daily post job completed ===`);

    return result;
  }

  async triggerManually(): Promise<DailyRunResult> {
    this.logger.log("Manual trigger invoked");
    return this.runDailyPost();
  }

  private selectPrimaryStoryForRun(
    stories: RealNewsItem[],
    runAt: Date,
  ): RealNewsItem[] {
    const windowSize = Math.min(3, stories.length);
    if (windowSize <= 1) return stories;

    const configuredSeed = this.config
      .get<string>("app.scheduler.postVariationSeed")
      ?.trim();
    const seed = configuredSeed || `${runAt.getTime()}`;
    const selectedIndex = this.hashSeed(seed) % windowSize;

    this.logger.log(
      `Story variation seed "${seed}" selected candidate #${selectedIndex + 1} from top ${windowSize}`,
    );

    return [
      stories[selectedIndex],
      ...stories.filter((_, index) => index !== selectedIndex),
    ];
  }

  private hashSeed(seed: string): number {
    let hash = 5381;
    for (let i = 0; i < seed.length; i += 1) {
      hash = (hash * 33) ^ seed.charCodeAt(i);
    }
    return hash >>> 0;
  }

  private excludePreviouslyPostedStories(
    stories: RealNewsItem[],
    history: PostHistory,
  ): RealNewsItem[] {
    const fingerprints = new Set(history.entries.map((entry) => entry.fingerprint));
    const normalizedUrls = new Set(
      history.entries.map((entry) => entry.normalizedUrl),
    );
    const normalizedTitles = new Set(
      history.entries.map((entry) => entry.normalizedTitle),
    );
    const fresh = stories.filter((story) => {
      const fingerprint = this.storyFingerprint(story);
      const normalizedUrl = this.normalizeUrl(story.url);
      const normalizedTitle = this.normalizeTitle(story.title);

      return (
        !fingerprints.has(fingerprint) &&
        !normalizedUrls.has(normalizedUrl) &&
        !normalizedTitles.has(normalizedTitle)
      );
    });

    this.logger.log(
      `Dedup check — candidates: ${stories.length}, previously posted matches: ${stories.length - fresh.length}, remaining: ${fresh.length}`,
    );

    return fresh;
  }

  private async persistPostedStory(
    result: DailyRunResult,
    story: RealNewsItem,
    runAt: Date,
    history: PostHistory,
    linkedInContent: string | null,
    tweetContent: string | null,
  ): Promise<void> {
    const platforms: Platform[] = [];
    if (result.linkedinResult.success) platforms.push("linkedin");
    if (result.twitterResult.success) platforms.push("twitter");

    if (platforms.length === 0) return;

    const fingerprint = this.storyFingerprint(story);
    const normalizedUrl = this.normalizeUrl(story.url);
    const normalizedTitle = this.normalizeTitle(story.title);
    if (
      history.entries.some(
        (entry) =>
          entry.fingerprint === fingerprint ||
          entry.normalizedUrl === normalizedUrl ||
          entry.normalizedTitle === normalizedTitle,
      )
    ) {
      return;
    }

    history.entries.unshift({
      fingerprint,
      normalizedUrl,
      normalizedTitle,
      source: story.source,
      originalUrl: story.url,
      originalTitle: story.title,
      postedAt: runAt.toISOString(),
      platforms,
      linkedinHash:
        linkedInContent && result.linkedinResult.success
          ? this.contentHash("linkedin", linkedInContent)
          : undefined,
      twitterHash:
        tweetContent && result.twitterResult.success
          ? this.contentHash("twitter", tweetContent)
          : undefined,
      linkedinSignature:
        linkedInContent && result.linkedinResult.success
          ? this.contentSignature(linkedInContent)
          : undefined,
      twitterSignature:
        tweetContent && result.twitterResult.success
          ? this.contentSignature(tweetContent)
          : undefined,
    });

    history.entries = history.entries.slice(0, MAX_HISTORY_ENTRIES);
    await this.savePostHistory(history);

    this.logger.log(
      `Saved post history entry for "${story.title}" (${platforms.join(", ")})`,
    );
  }

  private async loadPostHistory(): Promise<PostHistory> {
    const filePath = this.postHistoryFilePath();

    try {
      const raw = await readFile(filePath, "utf8");
      const parsed = JSON.parse(raw) as Partial<PostHistory>;

      if (parsed.version !== HISTORY_VERSION || !Array.isArray(parsed.entries)) {
        throw new Error("invalid history schema");
      }

      return {
        version: HISTORY_VERSION,
        entries: parsed.entries.filter(
          (entry): entry is PostedStoryEntry =>
            !!entry &&
            typeof entry.fingerprint === "string" &&
            typeof entry.normalizedUrl === "string" &&
            typeof entry.normalizedTitle === "string" &&
            typeof entry.source === "string" &&
            typeof entry.originalUrl === "string" &&
            typeof entry.originalTitle === "string" &&
            typeof entry.postedAt === "string" &&
            Array.isArray(entry.platforms) &&
            (entry.linkedinHash === undefined ||
              typeof entry.linkedinHash === "string") &&
            (entry.twitterHash === undefined ||
              typeof entry.twitterHash === "string") &&
            (entry.linkedinSignature === undefined ||
              typeof entry.linkedinSignature === "string") &&
            (entry.twitterSignature === undefined ||
              typeof entry.twitterSignature === "string"),
        ),
      };
    } catch (error) {
      const code =
        typeof error === "object" && error !== null && "code" in error
          ? String((error as { code?: string }).code)
          : "";

      if (code !== "ENOENT") {
        this.logger.warn(
          `Could not read post history (${filePath}), starting fresh`,
        );
      }

      return {
        version: HISTORY_VERSION,
        entries: [],
      };
    }
  }

  private async savePostHistory(history: PostHistory): Promise<void> {
    const filePath = this.postHistoryFilePath();
    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, `${JSON.stringify(history, null, 2)}\n`, "utf8");
  }

  private postHistoryFilePath(): string {
    const configured = this.config
      .get<string>("app.scheduler.postHistoryFile")
      ?.trim();
    const relativePath = configured || DEFAULT_POST_HISTORY_FILE;
    return resolve(process.cwd(), relativePath);
  }

  private storyFingerprint(story: Pick<RealNewsItem, "url" | "title" | "source">): string {
    return `${this.normalizeUrl(story.url)}|${this.normalizeTitle(story.title)}|${story.source.toLowerCase()}`;
  }

  private normalizeUrl(url: string): string {
    const cleaned = url.trim();
    if (!cleaned) return "";

    try {
      const parsed = new URL(cleaned);
      parsed.hash = "";
      parsed.hostname = parsed.hostname.toLowerCase();

      const trackingKeys = new Set([
        "utm_source",
        "utm_medium",
        "utm_campaign",
        "utm_term",
        "utm_content",
        "gclid",
        "fbclid",
        "rcm",
        "trk",
        "trackingid",
        "lipi",
      ]);

      for (const key of [...parsed.searchParams.keys()]) {
        if (trackingKeys.has(key.toLowerCase())) {
          parsed.searchParams.delete(key);
        }
      }

      const serialized = parsed.toString();
      return serialized.endsWith("/") ? serialized.slice(0, -1) : serialized;
    } catch {
      return cleaned.toLowerCase().replace(/\/+$/, "");
    }
  }

  private normalizeTitle(title: string): string {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  private async generateNonDuplicateContent(
    stories: RealNewsItem[],
    date: string,
    history: PostHistory,
  ): Promise<{
    linkedInContent: string | null;
    tweetContent: string | null;
    story: RealNewsItem;
  }> {
    const attempts = Math.min(MAX_GENERATION_ATTEMPTS, stories.length);

    for (let attempt = 0; attempt < attempts; attempt += 1) {
      const candidateStories = [
        stories[attempt],
        ...stories.filter((_, index) => index !== attempt),
      ];
      const candidateStory = candidateStories[0];

      let linkedInContent: string | null;
      let tweetContent: string | null;

      try {
        const generated = await this.claude.generatePosts(
          candidateStories,
          date,
          {
            linkedin: this.linkedinEnabled,
            twitter: this.twitterEnabled,
          },
        );
        linkedInContent = generated.linkedInContent;
        tweetContent = generated.tweetContent;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.warn(
          `Generation failed for "${candidateStory.title}". Trying next candidate. Reason: ${message}`,
        );
        continue;
      }

      const duplicateLinkedIn =
        !!linkedInContent &&
        this.isGeneratedContentDuplicate("linkedin", linkedInContent, history);
      const duplicateTwitter =
        !!tweetContent &&
        this.isGeneratedContentDuplicate("twitter", tweetContent, history);

      if (!duplicateLinkedIn && !duplicateTwitter) {
        return {
          linkedInContent,
          tweetContent,
          story: candidateStory,
        };
      }

      this.logger.warn(
        `Generated content matches previously posted output for "${candidateStory.title}". Trying next candidate...`,
      );
    }

    throw new Error(
      "Could not generate a unique post after trying multiple candidate stories.",
    );
  }

  private isGeneratedContentDuplicate(
    platform: Platform,
    content: string,
    history: PostHistory,
  ): boolean {
    const hash = this.contentHash(platform, content);
    const signature = this.contentSignature(content);

    for (const entry of history.entries) {
      const existingHash =
        platform === "linkedin" ? entry.linkedinHash : entry.twitterHash;
      if (existingHash === hash) return true;

      const existingSignature =
        platform === "linkedin"
          ? entry.linkedinSignature
          : entry.twitterSignature;
      if (!existingSignature) continue;

      if (
        this.textSimilarity(signature, existingSignature) >=
        this.contentSimilarityThreshold
      ) {
        return true;
      }
    }

    return false;
  }

  private contentHash(platform: Platform, content: string): string {
    const canonical = this.normalizeGeneratedContent(content);
    const hash = this.hashSeed(`${platform}|${canonical}`);
    return hash.toString(16).padStart(8, "0");
  }

  private contentSignature(content: string): string {
    const canonical = this.normalizeGeneratedContent(content);
    const tokens = this.tokenizeForSimilarity(canonical);
    return [...new Set(tokens)].sort().join(" ");
  }

  private normalizeGeneratedContent(content: string): string {
    const lines = content
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .filter((line) => !line.toLowerCase().startsWith("source:"))
      .filter((line) => !/^https?:\/\//i.test(line))
      .filter((line) => !line.startsWith("#"))
      .filter((line) => !line.includes(buildPostFooter()));

    return lines
      .join(" ")
      .toLowerCase()
      .replace(/\b\d{4}-\d{2}-\d{2}\b/g, " ")
      .replace(
        /\b(jan|january|feb|february|mar|march|apr|april|may|jun|june|jul|july|aug|august|sep|sept|september|oct|october|nov|november|dec|december)\s+\d{1,2},?\s+\d{4}\b/g,
        " ",
      )
      .replace(/https?:\/\/\S+/g, " ")
      .replace(/[^a-z0-9\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  private tokenizeForSimilarity(text: string): string[] {
    const stopWords = new Set([
      "the",
      "and",
      "for",
      "with",
      "that",
      "this",
      "from",
      "your",
      "into",
      "they",
      "them",
      "their",
      "will",
      "are",
      "was",
      "were",
      "been",
      "have",
      "has",
      "had",
      "than",
      "then",
      "but",
      "not",
      "you",
      "our",
      "its",
      "can",
      "all",
      "new",
      "now",
      "out",
      "why",
      "how",
      "what",
      "when",
      "where",
      "who",
      "which",
      "about",
      "over",
      "under",
      "through",
      "across",
      "more",
      "most",
      "much",
      "many",
      "just",
      "also",
      "only",
      "very",
      "being",
      "still",
      "industry",
      "business",
      "platform",
      "platforms",
      "software",
      "technology",
    ]);

    return text
      .split(/\s+/)
      .map((token) => token.trim())
      .filter((token) => token.length >= 4)
      .filter((token) => !stopWords.has(token));
  }

  private textSimilarity(a: string, b: string): number {
    const aTokens = new Set(this.tokenizeForSimilarity(a));
    const bTokens = new Set(this.tokenizeForSimilarity(b));

    if (aTokens.size === 0 || bTokens.size === 0) return 0;

    let intersection = 0;
    for (const token of aTokens) {
      if (bTokens.has(token)) intersection += 1;
    }

    return intersection / Math.max(aTokens.size, bTokens.size);
  }
}
