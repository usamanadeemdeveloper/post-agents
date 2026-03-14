import { Injectable, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { TwitterApi } from "twitter-api-v2";
import { AppLoggerService } from "../../core/logger/logger.service";
import { SocialPostResult } from "../../shared/interfaces/social-post.interface";

@Injectable()
export class TwitterService implements OnModuleInit {
  private client: TwitterApi;
  private publishRetryAttempts: number;

  constructor(
    private readonly config: ConfigService,
    private readonly logger: AppLoggerService,
  ) {
    this.logger.setContext(TwitterService.name);
  }

  onModuleInit(): void {
    const appKey = this.config.get<string>("app.twitter.appKey");
    const appSecret = this.config.get<string>("app.twitter.appSecret");
    const accessToken = this.config.get<string>("app.twitter.accessToken");
    const accessSecret = this.config.get<string>("app.twitter.accessSecret");

    if (!appKey || !appSecret || !accessToken || !accessSecret) {
      this.logger.warn(
        "Twitter/X credentials not configured — skipping client init",
      );
      return;
    }

    this.client = new TwitterApi({
      appKey,
      appSecret,
      accessToken,
      accessSecret,
    });
    this.publishRetryAttempts =
      this.config.get<number>("app.scheduler.publishRetryAttempts") ?? 3;
    this.logger.log("Twitter/X client initialized");
  }

  async tweet(content: string): Promise<SocialPostResult> {
    this.logger.log("Publishing tweet to X...");

    let lastError = "unknown error";
    for (let attempt = 1; attempt <= this.publishRetryAttempts; attempt += 1) {
      try {
        const rwClient = this.client.readWrite;
        const { data } = await rwClient.v2.tweet(content);

        this.logger.log(`Tweet published. ID: ${data.id}`);

        return {
          platform: "twitter",
          success: true,
          postId: data.id,
          postedAt: new Date(),
        };
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
        this.logger.warn(
          `Twitter publish attempt ${attempt}/${this.publishRetryAttempts} failed: ${lastError}`,
        );
        if (attempt < this.publishRetryAttempts) {
          await this.delay(1000 * attempt);
        }
      }
    }

    this.logger.error("Failed to publish tweet", lastError);
    return {
      platform: "twitter",
      success: false,
      error: lastError,
      postedAt: new Date(),
    };
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
