import * as Joi from "joi";

export const configValidationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid("development", "production", "test")
    .default("development"),

  PORT: Joi.number().default(3000),

  // NewsAPI — optional but recommended (newsapi.org free key)
  NEWSAPI_KEY: Joi.string().allow("").optional(),

  // Anthropic
  ANTHROPIC_API_KEY: Joi.string().required(),
  CLAUDE_MODEL: Joi.string().default("claude-sonnet-4-6"),

  // LinkedIn — optional, but at least one platform must be configured
  LINKEDIN_ACCESS_TOKEN: Joi.string().allow("").optional(),
  LINKEDIN_PERSON_URN: Joi.string().allow("").optional(),

  // Twitter / X — optional, but at least one platform must be configured
  TWITTER_APP_KEY: Joi.string().allow("").optional(),
  TWITTER_APP_SECRET: Joi.string().allow("").optional(),
  TWITTER_ACCESS_TOKEN: Joi.string().allow("").optional(),
  TWITTER_ACCESS_SECRET: Joi.string().allow("").optional(),

  // Scheduler
  CRON_SCHEDULE: Joi.string().default("0 9 * * *"),
  POST_VARIATION_SEED: Joi.string().allow("").optional(),
  POST_HISTORY_FILE: Joi.string().allow("").optional(),
  PUBLISH_RETRY_ATTEMPTS: Joi.number().integer().min(1).max(5).optional(),
  FAIL_ON_PUBLISH_FAILURE: Joi.boolean().optional(),
  CONTENT_SIMILARITY_THRESHOLD: Joi.number().min(0).max(1).default(0.8),

  // Prompt configuration
  NEWS_NICHE: Joi.string()
    .valid("business-architect", "developer")
    .default("business-architect"),

  POST_AUTHOR_NAME: Joi.string().allow("").optional(),
  POST_AGENT_NAME: Joi.string().allow("").optional(),
  NEWS_STORY_COUNT: Joi.number().integer().min(1).max(20).optional(),
  NEWS_RESEARCH_WINDOW_DAYS: Joi.number().integer().min(7).max(90).optional(),
  ALLOW_EVERGREEN_FALLBACK: Joi.boolean().optional(),
  LINKEDIN_POST_LENGTH: Joi.string().allow("").optional(),
  TWITTER_POST_LENGTH: Joi.string().allow("").optional(),

  POSTING_STYLE: Joi.string()
    .valid("default", "technical", "marketing", "casual", "business-architect")
    .allow("")
    .optional(),
  DEFAULT_TONE: Joi.string().allow("").optional(),
  PROMPT_VERSION: Joi.string().allow("").optional(),

  // Slack approval gate (optional — if not set, posts publish immediately)
  SLACK_BOT_TOKEN: Joi.string().allow("").optional(),
  SLACK_CHANNEL_ID: Joi.string().allow("").optional(),
  SLACK_APPROVAL_TIMEOUT_MINUTES: Joi.number().integer().min(1).max(360).optional(),
  SLACK_POST_VARIANTS: Joi.number().integer().min(1).max(5).optional(),
});
