import { Injectable, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { HttpService } from "@nestjs/axios";
import { firstValueFrom } from "rxjs";
import { AppLoggerService } from "../../core/logger/logger.service";

/** 1-based index of the selected variant, or null if timed out */
export type ApprovalResult = number | null;

export interface PostVariant {
  linkedInContent: string | null;
  tweetContent: string | null;
}

const POLL_INTERVAL_MS = 60_000;
const OPTION_EMOJIS = ["one", "two", "three", "four", "five"] as const;
const OPTION_LABELS = [":one:", ":two:", ":three:", ":four:", ":five:"];

@Injectable()
export class SlackService implements OnModuleInit {
  private readonly botToken: string | null;
  private readonly channelId: string | null;
  private readonly timeoutMs: number;
  readonly enabled: boolean;
  readonly variantCount: number;

  constructor(
    private readonly config: ConfigService,
    private readonly http: HttpService,
    private readonly logger: AppLoggerService,
  ) {
    this.logger.setContext(SlackService.name);
    this.botToken = this.config.get<string>("app.slack.botToken") || null;
    this.channelId = this.config.get<string>("app.slack.channelId") || null;
    const timeoutMinutes =
      this.config.get<number>("app.slack.approvalTimeoutMinutes") ?? 360;
    this.timeoutMs = timeoutMinutes * 60 * 1000;
    this.variantCount = this.config.get<number>("app.slack.postVariants") ?? 3;
    this.enabled = !!(this.botToken && this.channelId);
  }

  onModuleInit(): void {
    if (this.enabled) {
      this.logger.log(
        `Slack approval enabled — channel: ${this.channelId}, variants: ${this.variantCount}, timeout: ${this.timeoutMs / 60000}min`,
      );
    } else {
      this.logger.log(
        "Slack not configured — posts will publish without approval gate",
      );
    }
  }

  async postForApproval(params: {
    niche: string;
    storyTitle: string;
    variants: PostVariant[];
  }): Promise<{ ts: string }> {
    const { niche, storyTitle, variants } = params;
    const platforms = [
      variants[0]?.linkedInContent ? "LinkedIn" : null,
      variants[0]?.tweetContent ? "Twitter / X" : null,
    ]
      .filter(Boolean)
      .join("  ·  ");

    const timeoutMin = this.timeoutMs / 60000;
    const title = storyTitle.length > 80
      ? `${storyTitle.slice(0, 77)}...`
      : storyTitle;

    const reactionHint = OPTION_LABELS.slice(0, variants.length).join("  ");

    const blocks: object[] = [
      {
        type: "header",
        text: { type: "plain_text", text: "📰  New Post Ready for Review", emoji: true },
      },
      {
        type: "section",
        fields: [
          { type: "mrkdwn", text: `*Niche*\n${niche}` },
          { type: "mrkdwn", text: `*Platforms*\n${platforms}` },
        ],
      },
      {
        type: "section",
        text: { type: "mrkdwn", text: `*Story*\n_${title}_` },
      },
    ];

    variants.forEach((variant, i) => {
      blocks.push({ type: "divider" });
      blocks.push({
        type: "section",
        text: { type: "mrkdwn", text: `*Option ${OPTION_LABELS[i]}*` },
      });

      if (variant.linkedInContent) {
        blocks.push({
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*LinkedIn*\n\`\`\`${this.truncate(variant.linkedInContent, 2800)}\`\`\``,
          },
        });
      }

      if (variant.tweetContent) {
        blocks.push({
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*Twitter / X*\n\`\`\`${this.truncate(variant.tweetContent, 500)}\`\`\``,
          },
        });
      }
    });

    blocks.push({ type: "divider" });
    blocks.push({
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: `:point_right:  React with ${reactionHint} to pick one and publish  ·  No reaction within *${timeoutMin}min* = run aborted`,
        },
      ],
    });

    const response = await firstValueFrom(
      this.http.post(
        "https://slack.com/api/chat.postMessage",
        {
          channel: this.channelId,
          text: `New post ready — ${niche} — react ${reactionHint} to pick a variant`,
          blocks,
          unfurl_links: false,
          unfurl_media: false,
        },
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

    this.logger.log(`Post preview sent to Slack (ts: ${data.ts})`);
    return { ts: data.ts! };
  }

  async waitForApproval(ts: string, variantCount: number): Promise<ApprovalResult> {
    const deadline = Date.now() + this.timeoutMs;
    const hint = OPTION_LABELS.slice(0, variantCount).join(" or ");
    this.logger.log(
      `Waiting for ${hint} reaction (timeout: ${this.timeoutMs / 60000}min)`,
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

      const names = new Set(reactions.map((r) => r.name));

      for (let i = 0; i < variantCount; i++) {
        if (names.has(OPTION_EMOJIS[i])) {
          this.logger.log(`Option ${i + 1} selected ✓`);
          return i + 1;
        }
      }

      const remainingMin = Math.round((deadline - Date.now()) / 60_000);
      this.logger.log(`No selection yet — ~${remainingMin}min remaining`);
    }

    this.logger.warn(
      `Slack approval timed out after ${this.timeoutMs / 60000}min — aborting publish`,
    );
    return null;
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

  private truncate(text: string, max: number): string {
    return text.length > max ? `${text.slice(0, max - 3)}...` : text;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
