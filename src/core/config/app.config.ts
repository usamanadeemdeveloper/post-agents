import { registerAs } from "@nestjs/config";

export default registerAs("app", () => ({
  nodeEnv: process.env.NODE_ENV,
  port: parseInt(process.env.PORT!, 10),

  newsapi: {
    apiKey: process.env.NEWSAPI_KEY,
  },

  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY,
    model: process.env.CLAUDE_MODEL,
  },

  linkedin: {
    accessToken: process.env.LINKEDIN_ACCESS_TOKEN,
    personUrn: process.env.LINKEDIN_PERSON_URN,
  },

  twitter: {
    appKey: process.env.TWITTER_APP_KEY,
    appSecret: process.env.TWITTER_APP_SECRET,
    accessToken: process.env.TWITTER_ACCESS_TOKEN,
    accessSecret: process.env.TWITTER_ACCESS_SECRET,
  },

  scheduler: {
    cronSchedule: process.env.CRON_SCHEDULE,
    postVariationSeed: process.env.POST_VARIATION_SEED,
    postHistoryFile: process.env.POST_HISTORY_FILE,
    contentSimilarityThreshold: (() => {
      const raw = process.env.CONTENT_SIMILARITY_THRESHOLD;
      if (!raw) return 0.8;
      const parsed = Number(raw);
      return Number.isFinite(parsed) ? parsed : 0.8;
    })(),
  },

  prompts: {
    postingStyle: process.env.POSTING_STYLE ?? '',
    defaultTone: process.env.DEFAULT_TONE ?? '',
    promptVersion: process.env.PROMPT_VERSION ?? '',
    linkedInPostLength: process.env.LINKEDIN_POST_LENGTH || '',
    twitterPostLength: process.env.TWITTER_POST_LENGTH || '',
  },

  post: {
    authorName: process.env.POST_AUTHOR_NAME || '',
    agentName: process.env.POST_AGENT_NAME || '',
  },

  news: {
    niche: process.env.NEWS_NICHE ?? 'business-architect',
    storyCount: (() => {
      const raw = process.env.NEWS_STORY_COUNT;
      if (!raw) return 10;
      const parsed = parseInt(raw, 10);
      return Number.isFinite(parsed) && parsed > 0 ? parsed : 10;
    })(),
  },
}));
