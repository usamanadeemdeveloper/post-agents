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
  CRON_SCHEDULE: Joi.string().default("0 9 */3 * *"),

  // Prompting
  POSTING_STYLE: Joi.string()
    .valid("default", "technical", "marketing", "casual")
    .default("default"),
  DEFAULT_TONE: Joi.string().allow("").optional(),
  PROMPT_VERSION: Joi.string().allow("").optional(),
});
