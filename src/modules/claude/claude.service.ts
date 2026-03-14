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
import { appendPostFooter } from "../../shared/constants/post-footer";

interface StoryGrounding {
  productOrFeature: string;
  companyOrStat: string;
  businessProblem: string;
  whyNow: string;
  mustMentionPhrases: string[];
  evidenceSnippets: string[];
}

interface GeneratedPostReview {
  approved: boolean;
  missingAnchors: string[];
  unsupportedClaims: string[];
  correctedPost: string;
}

@Injectable()
export class ClaudeService implements OnModuleInit {
  private client: Anthropic;
  private model: string;
  private authorName: string;
  private agentName: string = '';

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
    this.authorName = this.config.get<string>("app.post.authorName") || '';
    const agentName = this.config.get<string>("app.post.agentName") || '';
    if (agentName) this.agentName = agentName;
    this.logger.log(`Claude client initialized with model: ${this.model}`);
  }

  async generatePosts(
    stories: RealNewsItem[],
    date: string,
    platforms: { linkedin: boolean; twitter: boolean },
  ): Promise<{ linkedInContent: string | null; tweetContent: string | null }> {
    const topStory = stories[0];
    const otherHeadlines = stories
      .slice(1, 4)
      .map((s, i) => `${i + 2}. "${s.title}" (${s.source})`)
      .join("\n");
    const style = this.resolvePostingStyle();
    const tone = this.config.get<string>("app.prompts.defaultTone", "");
    const grounding = await this.buildStoryGrounding(topStory);
    this.assertNicheFit(topStory, grounding);
    const factualAnchors = this.formatGroundingAnchors(grounding);

    const [linkedInContent, tweetContent] = await Promise.all([
      platforms.linkedin
        ? this.generateValidatedPost("linkedin", {
          date,
          topStory,
          otherHeadlines,
          style,
          tone,
          factualAnchors,
          grounding,
        })
        : Promise.resolve(null),
      platforms.twitter
        ? this.generateValidatedPost("twitter", {
          date,
          topStory,
          otherHeadlines: "",
          style,
          tone,
          factualAnchors,
          grounding,
        })
        : Promise.resolve(null),
    ]);

    const footerOpts = this.authorName || this.agentName
      ? { author: this.authorName || undefined, agentName: this.agentName || undefined }
      : undefined;

    return {
      linkedInContent:
        linkedInContent && footerOpts
          ? appendPostFooter(linkedInContent, footerOpts)
          : linkedInContent,
      tweetContent:
        tweetContent && footerOpts
          ? appendPostFooter(tweetContent, footerOpts)
          : tweetContent,
    };
  }

  generateDeterministicFallbackPosts(
    story: RealNewsItem,
    date: string,
    platforms: { linkedin: boolean; twitter: boolean },
  ): { linkedInContent: string | null; tweetContent: string | null } {
    const niche = this.config.get<string>("app.news.niche")?.trim() ?? "business-architect";
    const linkedInContent = platforms.linkedin
      ? this.appendFooterIfNeeded(this.buildDeterministicLinkedInPost(story, date, niche))
      : null;
    const tweetContent = platforms.twitter
      ? this.appendFooterIfNeeded(this.buildDeterministicTwitterPost(story, date, niche))
      : null;

    return { linkedInContent, tweetContent };
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

  private resolvePostingStyle(): PostingStyle {
    const configuredStyle = this.config.get<string>("app.prompts.postingStyle")?.trim();
    if (configuredStyle) {
      return configuredStyle as PostingStyle;
    }

    const niche = this.config.get<string>("app.news.niche")?.trim();
    return niche === "developer" ? "technical" : "business-architect";
  }

  private buildDeterministicLinkedInPost(
    story: RealNewsItem,
    date: string,
    niche: string,
  ): string {
    const sentences = this.extractSentences(story.articleText ?? "", 4);
    const intro = niche === "developer"
      ? `🛠️ Dev Insight — ${date}`
      : `💡 Industry Insight — ${date}`;
    const businessHeader = niche === "developer"
      ? "Why this matters for builders:"
      : "What this means for your business:";
    const hashtags = niche === "developer"
      ? "#SoftwareEngineering #PlatformEngineering #DeveloperExperience #Architecture"
      : "#EcommerceTech #HealthcareIT #HospitalityTech #SoftwareArchitecture #DigitalTransformation";

    const lines = [
      intro,
      "",
      sentences[0] || story.title,
      "",
      sentences.slice(1, 3).join(" "),
      "",
      businessHeader,
      `• ${sentences[1] || "The source points to a concrete systems or operations pattern worth paying attention to."}`,
      `• ${sentences[2] || "Teams that ignore this pattern usually create avoidable process and integration friction."}`,
      `• ${sentences[3] || "The practical move is to design software and workflows around this operating reality instead of treating it as an edge case."}`,
      "",
      niche === "developer"
        ? "How are you handling this in your stack right now?"
        : "If your operation depends on software around this workflow, is the architecture built to handle it cleanly?",
      "",
      `Source: ${story.url}`,
      "",
      hashtags,
    ];

    return lines.filter((line) => line.trim().length > 0 || line === "").join("\n").trim();
  }

  private buildDeterministicTwitterPost(
    story: RealNewsItem,
    date: string,
    niche: string,
  ): string {
    const sentences = this.extractSentences(story.articleText ?? "", 2);
    const prefix = niche === "developer" ? "🛠️" : "💡";
    const hashtagLine = niche === "developer"
      ? "#SoftwareEngineering #Architecture"
      : "#SoftwareArchitecture #DigitalTransformation";

    const body = `${prefix} ${date} — ${sentences[0] || story.title} ${sentences[1] || ""}`.trim();
    return `${body}\n${story.url}\n${hashtagLine}`.trim();
  }

  private async generateValidatedPost(
    platform: "linkedin" | "twitter",
    params: {
      date: string;
      topStory: RealNewsItem;
      otherHeadlines: string;
      style: PostingStyle;
      tone: string;
      factualAnchors: string;
      grounding: StoryGrounding;
    },
  ): Promise<string> {
    const { date, topStory, otherHeadlines, style, tone, factualAnchors, grounding } = params;
    const postLengthHint = platform === "linkedin"
      ? this.config.get<string>("app.prompts.linkedInPostLength") || undefined
      : this.config.get<string>("app.prompts.twitterPostLength") || undefined;

    this.logger.log(
      `Generating ${platform === "linkedin" ? "LinkedIn" : "X"} post using style "${style}"`,
    );

    const prompt = resolvePrompt(
      platform,
      { topStory, otherHeadlines, date, tone, factualAnchors, postLengthHint },
      style,
    );
    const response = await this.ask({
      prompt,
      maxTokens: platform === "linkedin" ? 1024 : 300,
    });
    const draft = response.content.trim();
    const reviewed = await this.reviewGeneratedPost(
      platform,
      topStory,
      grounding,
      draft,
      date,
    );

    const reviewedCandidate =
      !reviewed.approved && reviewed.correctedPost?.trim() && reviewed.correctedPost.trim() !== draft
        ? await this.reviewGeneratedPost(
          platform,
          topStory,
          grounding,
          reviewed.correctedPost.trim(),
          date,
        )
        : reviewed;

    const candidate = reviewedCandidate.correctedPost?.trim()
      || reviewed.correctedPost?.trim()
      || draft;
    const missingAnchors = this.findMissingAnchors(candidate, grounding);
    if (missingAnchors.length > 0) {
      const repaired = await this.repairMissingAnchors(
        platform,
        topStory,
        grounding,
        candidate,
        date,
        missingAnchors,
      );
      const remainingMissing = this.findMissingAnchors(repaired, grounding);
      if (remainingMissing.length > 0) {
        throw new Error(
          `Generated ${platform} post is still missing required anchors: ${remainingMissing.join(", ")}`,
        );
      }
      return repaired;
    }

    if (!reviewedCandidate.approved && !candidate) {
      throw new Error(`Claude could not produce a supported ${platform} post`);
    }

    return candidate;
  }

  private async buildStoryGrounding(story: RealNewsItem): Promise<StoryGrounding> {
    const prompt = `Read the article data below and return STRICT JSON with these keys only:
{
  "productOrFeature": string,
  "companyOrStat": string,
  "businessProblem": string,
  "whyNow": string,
  "mustMentionPhrases": string[],
  "evidenceSnippets": string[]
}

Rules:
- Use exact phrases from the title or article when possible
- "productOrFeature" should be the specific product, feature, release, or technology being discussed
- "companyOrStat" should be one concrete company name, customer name, number, or statistic from the article
- "businessProblem" should describe the exact problem/opportunity in the article's own framing
- "mustMentionPhrases" must include productOrFeature and companyOrStat when they are not empty
- "evidenceSnippets" must be 2-4 short verbatim snippets from the article, each under 20 words
- Do not invent missing details; use empty strings when unavailable
- Output JSON only

TITLE: ${story.title}
SOURCE: ${story.source}
URL: ${story.url}

ARTICLE CONTENT:
${story.articleText ?? ""}`;

    const grounding = await this.askForJson<StoryGrounding>({
      prompt,
      maxTokens: 400,
    }, "story grounding");

    return {
      productOrFeature: grounding.productOrFeature?.trim() ?? "",
      companyOrStat: grounding.companyOrStat?.trim() ?? "",
      businessProblem: grounding.businessProblem?.trim() ?? "",
      whyNow: grounding.whyNow?.trim() ?? "",
      mustMentionPhrases: [...new Set(
        (grounding.mustMentionPhrases ?? [])
          .map((phrase) => phrase.trim())
          .filter((phrase) => phrase.length > 0),
      )].slice(0, 4),
      evidenceSnippets: (grounding.evidenceSnippets ?? [])
        .map((snippet) => snippet.trim())
        .filter((snippet) => snippet.length > 0)
        .slice(0, 4),
    };
  }

  private formatGroundingAnchors(grounding: StoryGrounding): string {
    const lines = [
      `Product/feature: ${grounding.productOrFeature || "N/A"}`,
      `Company/stat: ${grounding.companyOrStat || "N/A"}`,
      `Business problem: ${grounding.businessProblem || "N/A"}`,
      `Why now: ${grounding.whyNow || "N/A"}`,
      `Must mention exactly: ${(grounding.mustMentionPhrases.length > 0 ? grounding.mustMentionPhrases.join(" | ") : "N/A")}`,
      `Supporting evidence: ${(grounding.evidenceSnippets.length > 0 ? grounding.evidenceSnippets.join(" | ") : "N/A")}`,
    ];
    return lines.join("\n");
  }

  private assertNicheFit(story: RealNewsItem, grounding: StoryGrounding): void {
    const niche = this.config.get<string>("app.news.niche")?.trim() ?? "business-architect";
    if (niche !== "business-architect") return;

    const text = [
      story.title,
      story.articleText ?? "",
      grounding.productOrFeature,
      grounding.businessProblem,
      grounding.whyNow,
    ].join(" ").toLowerCase();

    const verticalHits = this.countOccurrences(text, [
      "ecommerce", "e-commerce", "retail", "merchant", "shopify", "marketplace",
      "healthcare", "hospital", "clinic", "patient", "digital health",
      "hospitality", "hotel", "restaurant", "guest", "reservation",
    ]);
    const techHits = this.countOccurrences(text, [
      "software", "platform", "integration", "api", "automation", "system",
      "saas", "cloud", "data", "digital", "ehr", "emr", "portal", "workflow",
      "booking engine", "property management system", "pms", "architecture",
      "infrastructure",
    ]);

    if (verticalHits === 0 || techHits === 0) {
      throw new Error(
        `Story does not match the ${niche} niche after grounding validation`,
      );
    }
  }

  private async reviewGeneratedPost(
    platform: "linkedin" | "twitter",
    story: RealNewsItem,
    grounding: StoryGrounding,
    draft: string,
    date: string,
  ): Promise<GeneratedPostReview> {
    const prompt = `You are validating a social post against source material.

Return STRICT JSON with these keys only:
{
  "approved": boolean,
  "missingAnchors": string[],
  "unsupportedClaims": string[],
  "correctedPost": string
}

Rules:
- Reject the draft if any named feature, company, statistic, causal claim, or business claim is not supported by the article
- Reject the draft if it omits required must-mention phrases when they exist
- If the draft is weak but salvageable, rewrite it into "correctedPost" so every claim is supported
- The final post must be in clear natural English only
- Preserve the platform format and source URL requirement
- Output JSON only

PLATFORM: ${platform}
DATE: ${date}
TITLE: ${story.title}
SOURCE: ${story.source}
URL: ${story.url}

FACTUAL ANCHORS:
${this.formatGroundingAnchors(grounding)}

ARTICLE CONTENT:
${story.articleText ?? ""}

DRAFT POST:
${draft}`;

    return this.askForJson<GeneratedPostReview>({
      prompt,
      maxTokens: platform === "linkedin" ? 900 : 500,
    }, `${platform} post review`);
  }

  private findMissingAnchors(content: string, grounding: StoryGrounding): string[] {
    const lower = content.toLowerCase();
    return grounding.mustMentionPhrases.filter((phrase) => {
      const needle = phrase.trim().toLowerCase();
      return needle.length > 0 && !lower.includes(needle);
    });
  }

  private async repairMissingAnchors(
    platform: "linkedin" | "twitter",
    story: RealNewsItem,
    grounding: StoryGrounding,
    draft: string,
    date: string,
    missingAnchors: string[],
  ): Promise<string> {
    const prompt = `Revise the social post below so it stays fully supported by the article and includes these exact missing phrases:
${missingAnchors.join(" | ")}

Rules:
- Keep the output appropriate for ${platform}
- Keep the article's actual angle
- Do not add unsupported claims
- Write in clear natural English only
- Keep the source URL requirement intact
- Output only the revised post text

DATE: ${date}
TITLE: ${story.title}
SOURCE: ${story.source}
URL: ${story.url}

FACTUAL ANCHORS:
${this.formatGroundingAnchors(grounding)}

ARTICLE CONTENT:
${story.articleText ?? ""}

CURRENT DRAFT:
${draft}`;

    const response = await this.ask({
      prompt,
      maxTokens: platform === "linkedin" ? 1024 : 300,
    });
    return response.content.trim();
  }

  private async askForJson<T>(
    payload: ClaudeResearchPayload,
    context: string,
  ): Promise<T> {
    const response = await this.ask(payload);

    try {
      return this.parseJson<T>(response.content);
    } catch (error) {
      this.logger.warn(`Claude returned malformed JSON for ${context}; retrying once`);

      const repaired = await this.ask({
        prompt: `Convert the content below into valid JSON only. Do not add commentary.

TARGET:
${context}

CONTENT:
${response.content}`,
        maxTokens: payload.maxTokens ?? 1024,
      });

      return this.parseJson<T>(repaired.content);
    }
  }

  private parseJson<T>(raw: string): T {
    const fencedMatch = raw.match(/```json\s*([\s\S]*?)```/i)
      ?? raw.match(/```\s*([\s\S]*?)```/i);
    const candidate = (fencedMatch ? fencedMatch[1] : raw).trim();
    const start = candidate.indexOf("{");
    const end = candidate.lastIndexOf("}");

    if (start === -1 || end === -1 || end <= start) {
      throw new Error("Claude returned invalid JSON");
    }

    return JSON.parse(candidate.slice(start, end + 1)) as T;
  }

  private countOccurrences(text: string, terms: string[]): number {
    return terms.filter((term) => text.includes(term)).length;
  }

  private extractSentences(text: string, limit: number): string[] {
    return text
      .replace(/\s+/g, " ")
      .split(/(?<=[.!?])\s+/)
      .map((sentence) => sentence.trim())
      .filter((sentence) => sentence.length > 0)
      .slice(0, limit);
  }

  private appendFooterIfNeeded(content: string): string {
    const footerOpts = this.authorName || this.agentName
      ? { author: this.authorName || undefined, agentName: this.agentName || undefined }
      : undefined;
    return footerOpts ? appendPostFooter(content, footerOpts) : content;
  }
}
