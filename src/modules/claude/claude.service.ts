import { Injectable, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Anthropic from "@anthropic-ai/sdk";
import { AppLoggerService } from "../../core/logger/logger.service";
import {
  ClaudeResearchPayload,
  ClaudeResearchResponse,
} from "./interfaces/claude-research.interface";
import { RealNewsItem } from "../news/interfaces/news-item.interface";
import { resolvePrompt } from "../../../prompts/prompt-resolver";
import { PostingStyle } from "../../../prompts/prompt-params.interface";

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
    this.model = this.config.get<string>("app.anthropic.model")!;
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
      .map((s, i) => `${i + 2}. "${s.title}" (${s.source})`)
      .join("\n");

    const style = this.config.get<PostingStyle>("app.prompting.postingStyle", "default");
    const tone = this.config.get<string>("app.prompting.defaultTone");

    const prompt = resolvePrompt("linkedin", { topStory, otherHeadlines, date, tone }, style);

    const response = await this.ask({ prompt, maxTokens: 600 });
    return response.content.trim();
  }

  async generateTwitterPost(
    stories: RealNewsItem[],
    date: string,
  ): Promise<string> {
    this.logger.log("Generating X (Twitter) post from real news...");

    const topStory = stories[0];
    const style = this.config.get<PostingStyle>("app.prompting.postingStyle", "default");
    const tone = this.config.get<string>("app.prompting.defaultTone");

    const prompt = resolvePrompt("twitter", { topStory, date, tone }, style);

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
