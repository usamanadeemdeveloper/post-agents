import { Injectable, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { HttpService } from "@nestjs/axios";
import { AxiosError } from "axios";
import { firstValueFrom } from "rxjs";
import { AppLoggerService } from "../../core/logger/logger.service";
import { SocialPostResult } from "../../shared/interfaces/social-post.interface";

@Injectable()
export class LinkedInService implements OnModuleInit {
  private accessToken: string;
  private authorUrn: string;
  private readonly apiBase = "https://api.linkedin.com/v2";
  private publishRetryAttempts: number;

  constructor(
    private readonly config: ConfigService,
    private readonly http: HttpService,
    private readonly logger: AppLoggerService,
  ) {
    this.logger.setContext(LinkedInService.name);
  }

  onModuleInit(): void {
    const accessToken = this.config.get<string>("app.linkedin.accessToken");
    const authorUrn = this.config.get<string>("app.linkedin.authorUrn");

    if (!accessToken || !authorUrn) {
      this.logger.warn(
        "LinkedIn credentials not configured — skipping client init",
      );
      return;
    }

    this.accessToken = accessToken;
    this.authorUrn = authorUrn;
    this.publishRetryAttempts =
      this.config.get<number>("app.scheduler.publishRetryAttempts") ?? 3;
    const authorType = this.authorUrn.startsWith("urn:li:organization:")
      ? "organization"
      : "member";
    this.logger.log(`LinkedIn service initialized for ${authorType} author`);
    if (authorType === "organization") {
      this.logger.log(
        "Organization posting requires org-scoped LinkedIn permissions and a page role for the authenticated member",
      );
    }
  }

  async createPost(content: string): Promise<SocialPostResult> {
    this.logger.log("Publishing post to LinkedIn...");

    const body = {
      author: this.authorUrn,
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

    let lastError = "unknown error";
    for (let attempt = 1; attempt <= this.publishRetryAttempts; attempt += 1) {
      try {
        const response = await firstValueFrom(
          this.http.post(`${this.apiBase}/ugcPosts`, body, {
            headers: {
              Authorization: `Bearer ${this.accessToken}`,
              "Content-Type": "application/json",
              "X-Restli-Protocol-Version": "2.0.0",
            },
            timeout: 15000,
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
        lastError = this.describePublishError(error);
        this.logger.warn(
          `LinkedIn publish attempt ${attempt}/${this.publishRetryAttempts} failed: ${lastError}`,
        );
        if (attempt < this.publishRetryAttempts) {
          await this.delay(1000 * attempt);
        }
      }
    }

    this.logger.error("Failed to publish LinkedIn post", lastError);
    return {
      platform: "linkedin",
      success: false,
      error: lastError,
      postedAt: new Date(),
    };
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private describePublishError(error: unknown): string {
    if (error instanceof AxiosError) {
      const status = error.response?.status;
      const details =
        typeof error.response?.data === "string"
          ? error.response.data
          : JSON.stringify(error.response?.data);

      return status ? `HTTP ${status}${details ? ` — ${details}` : ""}` : error.message;
    }

    return error instanceof Error ? error.message : String(error);
  }
}
