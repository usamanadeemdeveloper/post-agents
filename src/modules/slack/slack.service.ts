import { Injectable, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { HttpService } from "@nestjs/axios";
import { firstValueFrom } from "rxjs";
import { AppLoggerService } from "../../core/logger/logger.service";

export type ApprovalResult = "approved" | "timeout";

const POLL_INTERVAL_MS = 60_000; // poll every 60 seconds

@Injectable()
export class SlackService implements OnModuleInit {
  private readonly botToken: string | null;
  private readonly channelId: string | null;
  private readonly approveEmoji: string;
  private readonly timeoutMs: number;
  readonly enabled: boolean;

  constructor(
    private readonly config: ConfigService,
    private readonly http: HttpService,
    private readonly logger: AppLoggerService,
  ) {
    this.logger.setContext(SlackService.name);
    this.botToken = this.config.get<string>("app.slack.botToken") || null;
    this.channelId = this.config.get<string>("app.slack.channelId") || null;
    this.approveEmoji =
      this.config.get<string>("app.slack.approveEmoji") || "white_check_mark";
    const timeoutMinutes =
      this.config.get<number>("app.slack.approvalTimeoutMinutes") ?? 360;
    this.timeoutMs = timeoutMinutes * 60 * 1000;
    this.enabled = !!(this.botToken && this.channelId);
  }

  onModuleInit(): void {
    if (this.enabled) {
      this.logger.log(
        `Slack approval enabled — channel: ${this.channelId}, timeout: ${this.timeoutMs / 60000}min, approve with :${this.approveEmoji}:`,
      );
    } else {
      this.logger.log(
        "Slack not configured — posts will publish without approval gate",
      );
    }
  }

  async postForApproval(params: {
    niche: string;
    linkedInContent: string | null;
    tweetContent: string | null;
  }): Promise<{ ts: string }> {
    const { niche, linkedInContent, tweetContent } = params;
    const platforms = [
      linkedInContent ? "LinkedIn" : null,
      tweetContent ? "Twitter/X" : null,
    ]
      .filter(Boolean)
      .join(", ");

    const lines: string[] = [
      `*New post ready for review*`,
      `*Niche:* ${niche}   *Platforms:* ${platforms}`,
      ``,
    ];

    if (linkedInContent) {
      lines.push(`*LinkedIn Post:*`, "```", linkedInContent, "```", ``);
    }

    if (tweetContent) {
      lines.push(`*Twitter/X Post:*`, "```", tweetContent, "```", ``);
    }

    lines.push(
      `React with :${this.approveEmoji}: to *publish*. No reaction within ${this.timeoutMs / 60000}min = aborted.`,
    );

    const text = lines.join("\n");
    const response = await firstValueFrom(
      this.http.post(
        "https://slack.com/api/chat.postMessage",
        { channel: this.channelId, text, unfurl_links: false, unfurl_media: false },
        {
          headers: {
            Authorization: `Bearer ${this.botToken}`,
            "Content-Type": "application/json",
          },
        },
      ),
    );

    const data = response.data as { ok: boolean; ts?: string; error?: string };
    if (!data.ok) {
      throw new Error(`Slack chat.postMessage failed: ${data.error}`);
    }

    this.logger.log(`Post previewed in Slack (ts: ${data.ts})`);
    return { ts: data.ts! };
  }

  async waitForApproval(ts: string): Promise<ApprovalResult> {
    const deadline = Date.now() + this.timeoutMs;
    this.logger.log(
      `Waiting for :${this.approveEmoji}: reaction (timeout: ${this.timeoutMs / 60000}min)`,
    );

    while (Date.now() < deadline) {
      await this.sleep(POLL_INTERVAL_MS);

      let reactions: Array<{ name: string }>;
      try {
        reactions = await this.fetchReactions(ts);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.warn(`Could not fetch reactions: ${msg} — will retry`);
        continue;
      }

      if (reactions.some((r) => r.name === this.approveEmoji)) {
        this.logger.log("Slack approval received ✓");
        return "approved";
      }

      const remainingMin = Math.round((deadline - Date.now()) / 60_000);
      this.logger.log(`No approval yet — ~${remainingMin}min remaining`);
    }

    this.logger.warn(
      `Slack approval timed out after ${this.timeoutMs / 60000}min — aborting publish`,
    );
    return "timeout";
  }

  private async fetchReactions(ts: string): Promise<Array<{ name: string }>> {
    const url = `https://slack.com/api/reactions.get?channel=${this.channelId}&timestamp=${ts}`;
    const response = await firstValueFrom(
      this.http.get(url, {
        headers: { Authorization: `Bearer ${this.botToken}` },
      }),
    );

    const data = response.data as {
      ok: boolean;
      message?: { reactions?: Array<{ name: string; count: number }> };
      error?: string;
    };

    if (!data.ok) {
      throw new Error(`Slack reactions.get failed: ${data.error}`);
    }

    return data.message?.reactions ?? [];
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
