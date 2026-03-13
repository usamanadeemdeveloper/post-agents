# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this project does
Automated LinkedIn and/or X/Twitter posting pipeline for a software architect targeting investors and clients in **ecommerce, healthcare, and hospitality**. Fetches real trending news, uses Claude AI to write fact-only posts in a configurable style, and publishes on a configurable schedule. Runs free via GitHub Actions — no server required. Every behaviour is controlled via GitHub Secrets with no hardcoded values.

## Commands

```bash
# Development
npm run trigger          # run the full pipeline once and exit — primary dev command
npm run test:linkedin    # post a hardcoded test post to LinkedIn (credential check, no Claude needed)
npm run build            # compile TypeScript to dist/

# Testing
npm test                           # run all unit tests
npm run test:cov                   # with coverage report
npx jest path/to/file.spec.ts      # run a single test file

# Code quality
npm run lint             # ESLint with auto-fix
npm run format           # Prettier
```

## Architecture

### Two entry points
- `src/main.ts` — NestJS HTTP server bootstrap. Not used in production.
- `src/run-once.ts` — uses `NestFactory.createApplicationContext()` (no HTTP server). Called by GitHub Actions via `npm run trigger`. Boots DI, runs `SchedulerService.triggerManually()`, exits.

### Pipeline flow
```
GitHub Actions cron fires daily at 9 AM UTC
  → Check .last-post-date vs POST_INTERVAL_DAYS secret — skip if not enough time elapsed
  → npm run trigger
    → NewsService.fetchTopTechStories(storyCount)
        → Reddit (subreddits from niche profile)  ─┐
        → Google News RSS (queries from profile)  ─┼─ parallel
        → NewsAPI (queries from profile)          ─┘
        → merge → deduplicate by URL → keyword score → top candidates
        → fetchFullArticleText() for each          # full HTML stripped to plain text
    → SchedulerService.runDailyPost()
        → ClaudeService.generateLinkedInPost()  ─┐ parallel (only if platform enabled)
        → ClaudeService.generateTwitterPost()   ─┘
    → LinkedInService.createPost()  ─┐ parallel
    → TwitterService.tweet()        ─┘ (skipped if not configured)
  → Persist .last-post-date (and .post-history.json if present) back to repo
```

### Module responsibilities
- **`core/`** — `@Global` module. Owns `ConfigModule` (Joi-validated), `HttpModule`, `AppLoggerService`. Available everywhere without re-importing.
- **`modules/news/`** — fetches from Reddit + Google News RSS + NewsAPI. Sources are driven by `NEWS_NICHE` via `src/modules/news/news-niches.ts` — not hardcoded. Fetches full article HTML and strips to plain text.
- **`modules/claude/`** — wraps `@anthropic-ai/sdk`. Reads `POSTING_STYLE`, `DEFAULT_TONE`, `POST_HASHTAGS_*`, `*_POST_LENGTH` from config, resolves the prompt via `prompts/prompt-resolver.ts`, calls Claude, optionally appends footer.
- **`modules/linkedin/`** — calls `https://api.linkedin.com/v2/ugcPosts` with `X-Restli-Protocol-Version: 2.0.0`. Skips init gracefully if credentials are missing.
- **`modules/twitter/`** — uses `twitter-api-v2`. Skips init gracefully if credentials are missing.
- **`modules/scheduler/`** — orchestrates the full run. Reads `NEWS_STORY_COUNT` from config. Checks which platforms are configured (throws if none).

### Niche profiles (`src/modules/news/news-niches.ts`)
Two profiles: `business-architect` (ecommerce/healthcare/hospitality — default) and `developer` (languages/frameworks/AI/DevOps). Selected via `NEWS_NICHE` env var. Each profile defines its own subreddits, Google News queries, NewsAPI queries, and relevance keywords. To add a new niche: add an entry to `NICHES` in `news-niches.ts` and extend the `NewsNiche` type.

### Prompt system (`prompts/`)
Five posting styles: `default`, `technical`, `marketing`, `casual`, `business-architect`. Each style has separate LinkedIn and Twitter prompt functions. `prompt-resolver.ts` is the single dispatch point. Every prompt accepts `hashtags` and `postLengthHint` params — populated from `POST_HASHTAGS_*` and `*_POST_LENGTH` secrets, falling back to per-style defaults if not set. To add a style: create `prompts/my-style.prompt.ts` and add one entry to `PROMPT_REGISTRY` in `prompt-resolver.ts`.

### Post footer (`src/shared/constants/post-footer.ts`)
Footer is **only appended when `POST_AUTHOR_NAME` or `POST_AGENT_NAME` is set**. If neither secret is set, posts have no footer. `buildPostFooter({ author, agentName })` constructs it dynamically.

### Schedule control
The GitHub Actions cron fires daily (platform minimum tick). Actual posting frequency is controlled by `POST_INTERVAL_DAYS` secret. After each post, `.last-post-date` is committed to the repo and checked on every daily tick. `workflow_dispatch` supports a `force=true` input to bypass the interval check.

### Config pattern
All config accessed via `ConfigService.get<T>('app.xxx')` using `registerAs('app', ...)` in `core/config/app.config.ts`. Joi schema in `config.validation.ts` validates on startup and documents all accepted env vars.

## Key constraints
- **Never truncate posts** — if a post is the wrong length, fix the prompt in `prompts/` or adjust `*_POST_LENGTH` secret, never slice the output
- **Never invent facts** — Claude receives the full article text; every prompt explicitly forbids adding any claim not present in the article
- **No hardcoded content values** — subreddits, queries, keywords, hashtags, post length, story count, posting interval, footer, and model are all env-var driven
- **Niche and style must match** — `NEWS_NICHE=business-architect` should be paired with `POSTING_STYLE=business-architect` for consistent audience targeting

## All environment variables

```bash
# Required
ANTHROPIC_API_KEY          # Claude API key
LINKEDIN_ACCESS_TOKEN      # LinkedIn OAuth token (expires every 60 days)
LINKEDIN_PERSON_URN        # urn:li:person:xxxxx from /v2/userinfo

# Core behaviour
CLAUDE_MODEL               # default: claude-sonnet-4-6
NEWS_NICHE                 # business-architect | developer  (default: business-architect)
NEWS_STORY_COUNT           # 1–20  (default: 10)
POST_INTERVAL_DAYS         # days between posts  (default: 3)
POSTING_STYLE              # business-architect | default | technical | marketing | casual
DEFAULT_TONE               # freeform tone hint injected into the prompt

# Post content overrides
POST_HASHTAGS_LINKEDIN     # space-separated hashtags e.g. "#Ecommerce #HealthTech"
POST_HASHTAGS_TWITTER      # space-separated hashtags for Twitter
LINKEDIN_POST_LENGTH       # e.g. "800–1100 characters"
TWITTER_POST_LENGTH        # e.g. "200 and 220 characters"

# Footer (both optional — if neither set, no footer is added)
POST_AUTHOR_NAME           # adds "— built by [name]" to footer
POST_AGENT_NAME            # overrides "PostAgent" in footer

# Twitter / X (all optional)
TWITTER_APP_KEY / TWITTER_APP_SECRET
TWITTER_ACCESS_TOKEN / TWITTER_ACCESS_SECRET

# Optional sources & dedup
NEWSAPI_KEY                # newsapi.org free key — 100 req/day
CONTENT_SIMILARITY_THRESHOLD  # 0.0–1.0  (default: 0.8)

# Workflow feature flags (set to 'false' to disable)
ENABLE_CLAUDE_BOT          # disables @claude mention bot workflow
ENABLE_PR_REVIEW           # disables auto PR review workflow
```

## GitHub Actions workflows
- `.github/workflows/daily-post.yml` — fires daily, checks interval, runs pipeline, commits `.last-post-date`. Supports `force=true` manual dispatch to skip interval check.
- `.github/workflows/claude.yml` — `@claude` mention bot. Gated by `ENABLE_CLAUDE_BOT != 'false'`.
- `.github/workflows/claude-review.yml` — auto PR review on every open/push. Gated by `ENABLE_PR_REVIEW != 'false'`.
