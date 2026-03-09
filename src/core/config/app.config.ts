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
  },
}));
