import { Injectable, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { TwitterApi } from "twitter-api-v2";
import { AppLoggerService } from "../../core/logger/logger.service";
import { SocialPostResult } from "../../shared/interfaces/social-post.interface";

@Injectable()
export class TwitterService implements OnModuleInit {
  private client: TwitterApi;

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
    this.logger.log("Twitter/X client initialized");
  }

  async tweet(content: string): Promise<SocialPostResult> {
    this.logger.log("Publishing tweet to X...");

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
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error("Failed to publish tweet", message);

      return {
        platform: "twitter",
        success: false,
        error: message,
        postedAt: new Date(),
      };
    }
  }
}
