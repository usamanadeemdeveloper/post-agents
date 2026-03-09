import { Injectable, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { HttpService } from "@nestjs/axios";
import { firstValueFrom } from "rxjs";
import { AppLoggerService } from "../../core/logger/logger.service";
import { SocialPostResult } from "../../shared/interfaces/social-post.interface";

@Injectable()
export class LinkedInService implements OnModuleInit {
  private accessToken: string;
  private personUrn: string;
  private readonly apiBase = "https://api.linkedin.com/v2";

  constructor(
    private readonly config: ConfigService,
    private readonly http: HttpService,
    private readonly logger: AppLoggerService,
  ) {
    this.logger.setContext(LinkedInService.name);
  }

  onModuleInit(): void {
    const accessToken = this.config.get<string>("app.linkedin.accessToken");
    const personUrn = this.config.get<string>("app.linkedin.personUrn");

    if (!accessToken || !personUrn) {
      this.logger.warn(
        "LinkedIn credentials not configured — skipping client init",
      );
      return;
    }

    this.accessToken = accessToken;
    this.personUrn = personUrn;
    this.logger.log("LinkedIn service initialized");
  }

  async createPost(content: string): Promise<SocialPostResult> {
    this.logger.log("Publishing post to LinkedIn...");

    try {
      const body = {
        author: this.personUrn,
        lifecycleState: "PUBLISHED",
        specificContent: {
          "com.linkedin.ugc.ShareContent": {
            shareCommentary: {
              text: content,
            },
            shareMediaCategory: "NONE",
          },
        },
        visibility: {
          "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC",
        },
      };

      const response = await firstValueFrom(
        this.http.post(`${this.apiBase}/ugcPosts`, body, {
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            "Content-Type": "application/json",
            "X-Restli-Protocol-Version": "2.0.0",
          },
        }),
      );

      const postId = response.headers["x-restli-id"] as string;
      this.logger.log(`LinkedIn post published. ID: ${postId}`);

      return {
        platform: "linkedin",
        success: true,
        postId,
        postedAt: new Date(),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error("Failed to publish LinkedIn post", message);

      return {
        platform: "linkedin",
        success: false,
        error: message,
        postedAt: new Date(),
      };
    }
  }
}
