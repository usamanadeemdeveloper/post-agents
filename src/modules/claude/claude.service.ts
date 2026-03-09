import { Injectable, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Anthropic from "@anthropic-ai/sdk";
import { AppLoggerService } from "../../core/logger/logger.service";
import {
  ClaudeResearchPayload,
  ClaudeResearchResponse,
} from "./interfaces/claude-research.interface";
import { RealNewsItem } from "../news/interfaces/news-item.interface";

@Injectable()
export class ClaudeService implements OnModuleInit {
  private client: Anthropic;
  private model: string;

  constructor(
    private readonly config: ConfigService,
    private readonly logger: AppLoggerService,
  ) {
    this.logger.setContext(ClaudeService.name);
  }

  onModuleInit(): void {
    this.client = new Anthropic({
      apiKey: this.config.get<string>("app.anthropic.apiKey"),
    });
    this.model =
      this.config.get<string>("app.anthropic.model") ?? "claude-opus-4-6";
    this.logger.log(`Claude client initialized with model: ${this.model}`);
  }

  async generateLinkedInPost(
    stories: RealNewsItem[],
    date: string,
  ): Promise<string> {
    this.logger.log("Generating LinkedIn post from real news...");

    const topStory = stories[0];
    const otherHeadlines = stories
      .slice(1, 4)
      .map((s, i) => `${i + 2}. "${s.title}" (r/${s.subreddit})`)
      .join("\n");

    const prompt = `You are writing a LinkedIn post on behalf of an experienced software architect who specialises in building custom software for ecommerce, hospitality, and healthcare businesses. Their goal is to build authority and attract investors and clients — not to talk to other developers.

The tone must be:
- Confident and professional, like a senior consultant speaking to a business audience
- Insight-driven: connect the news to real business impact in ecommerce, hospitality, or healthcare
- Subtle service authority: position them as someone who solves these problems for clients, without being salesy
- Accessible: investors and non-technical clients must understand every word

You have been given the FULL text of a real trending post. Write ONLY from what you read — never add names, numbers, or claims not in the article.

TODAY'S TRENDING TOPIC:
Title: ${topStory.title}
Source: r/${topStory.subreddit} | ${topStory.source}
URL: ${topStory.url}
Upvotes: ${topStory.score} | Comments: ${topStory.commentCount}

FULL CONTENT:
${topStory.articleText}

OTHER TRENDING:
${otherHeadlines}

Write a LinkedIn post using this EXACT structure:

🔍 Industry Insight — ${date}

[Hook: one sharp sentence connecting this topic to a real pain point in ecommerce, hospitality, or healthcare. Must make a business decision-maker stop scrolling.]

[Body: 2 sentences explaining what is happening and why it matters to businesses in these industries. Use specific facts from the article. Zero jargon.]

What this means for your business:
• [Practical impact on ecommerce, hospitality, or healthcare operations]
• [Risk or opportunity business owners should act on]
• [How smart companies are already responding]

[Closing: one question or observation that positions the author as someone who navigates this for clients daily]

Source: ${topStory.url}

#Ecommerce #HealthcareTech #HospitalityTech

STRICT RULES:
- Every fact must come from the article above — nothing invented
- Total post length: 700–950 characters
- Hashtags: exactly 3, always include the niche tags above plus one relevant to the story
- Output ONLY the post text`;

    const response = await this.ask({ prompt, maxTokens: 600 });
    return response.content.trim();
  }

  async generateTwitterPost(
    stories: RealNewsItem[],
    date: string,
  ): Promise<string> {
    this.logger.log("Generating X (Twitter) post from real news...");

    const topStory = stories[0];

    const prompt = `You are writing a tweet on behalf of a software architect who builds solutions for ecommerce, hospitality, and healthcare businesses. The audience is business owners, investors, and decision-makers — not developers.

You have the full article below. Write ONLY from what you read — never invent details.

TODAY'S DATE: ${date}
Title: ${topStory.title}
Source: r/${topStory.subreddit}
URL: ${topStory.url}

FULL CONTENT:
${topStory.articleText}

Write ONE tweet that shares a sharp business insight from this topic.

STRICT RULES:
- Start with "📅 ${date} —" then your insight
- The full tweet text (before the URL line) must be between 200 and 240 characters including the date prefix
- Add the source URL on the last line: ${topStory.url}
- Include exactly 2 hashtags from: #Ecommerce #HealthcareTech #HospitalityTech #SoftwareArchitecture
- Every claim must come from the article — do not invent
- Output ONLY the tweet text and URL, nothing else`;

    const response = await this.ask({ prompt, maxTokens: 200 });
    return response.content.trim();
  }

  private async ask(
    payload: ClaudeResearchPayload,
  ): Promise<ClaudeResearchResponse> {
    const message = await this.client.messages.create({
      model: this.model,
      max_tokens: payload.maxTokens ?? 1024,
      messages: [{ role: "user", content: payload.prompt }],
    });

    const textBlock = message.content.find(
      (b): b is Anthropic.TextBlock => b.type === "text",
    );

    if (!textBlock) {
      throw new Error("Claude returned no text content");
    }

    return {
      content: textBlock.text,
      inputTokens: message.usage.input_tokens,
      outputTokens: message.usage.output_tokens,
    };
  }
}
