import { Injectable } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { ConfigService } from "@nestjs/config";
import { ClaudeService } from "../claude/claude.service";
import { LinkedInService } from "../linkedin/linkedin.service";
import { TwitterService } from "../twitter/twitter.service";
import { NewsService } from "../news/news.service";
import { AppLoggerService } from "../../core/logger/logger.service";
import {
  DailyRunResult,
  SocialPostResult,
} from "../../shared/interfaces/social-post.interface";

@Injectable()
export class SchedulerService {
  private readonly linkedinEnabled: boolean;
  private readonly twitterEnabled: boolean;

  constructor(
    private readonly news: NewsService,
    private readonly claude: ClaudeService,
    private readonly linkedin: LinkedInService,
    private readonly twitter: TwitterService,
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

    if (!this.linkedinEnabled && !this.twitterEnabled) {
      throw new Error(
        "No social platform configured. Set credentials for at least LinkedIn or Twitter/X in your .env file.",
      );
    }

    this.logger.log(
      `Platforms enabled — LinkedIn: ${this.linkedinEnabled ? "✓" : "✗"}  Twitter: ${this.twitterEnabled ? "✓" : "✗"}`,
    );
  }

  @Cron(process.env.CRON_SCHEDULE ?? "0 9 * * *", {
    name: "daily-tech-post",
    timeZone: "UTC",
  })
  async runDailyPost(): Promise<DailyRunResult> {
    const runAt = new Date();
    const date = runAt.toISOString().split("T")[0];
    this.logger.log(`=== Daily post job started at ${runAt.toISOString()} ===`);

    // Step 1 — fetch real news
    const stories = await this.news.fetchTopTechStories(5);
    this.logger.log(`Top story: "${stories[0].title}" (${stories[0].source})`);

    // Step 2 — generate only the posts we need
    const [linkedInContent, tweetContent] = await Promise.all([
      this.linkedinEnabled
        ? this.claude.generateLinkedInPost(stories, date)
        : Promise.resolve(null),
      this.twitterEnabled
        ? this.claude.generateTwitterPost(stories, date)
        : Promise.resolve(null),
    ]);

    // Step 3 — publish to whichever platforms are configured
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
}
