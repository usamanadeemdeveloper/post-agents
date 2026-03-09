# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this project does
Posts every 3 days that:
1. Fetches trending stories from **Reddit** (10 niche subreddits), **Google News RSS**, and **NewsAPI** in parallel
2. Scores stories for relevance to the three target niches: **ecommerce, hospitality, healthcare software**
3. Fetches the **full article text** for top candidates — Claude writes only from what it reads, never invents
4. Passes full content to **Claude AI** (`claude-sonnet-4-6`) which formats a LinkedIn post targeting investors and clients
5. Publishes to **LinkedIn** (UGC Posts API). Twitter/X is optional.

Deployed via **GitHub Actions** — runs free, no server required.

## Commands

```bash
# Development
npm run trigger          # run the full pipeline once and exit — primary dev command
npm run test:linkedin    # post a hardcoded test post to LinkedIn (credential check, no Claude needed)
npm run start:dev        # watch mode HTTP server (not used in production)
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
GitHub Actions cron (0 9 */3 * *  →  every 3 days at 9 AM UTC)
  → npm run trigger
    → NewsService.fetchTopTechStories()
        → Reddit (10 subreddits, hot.json)     ─┐
        → Google News RSS (3 niche queries)    ─┼─ parallel
        → NewsAPI (3 niche queries)            ─┘
        → merge → deduplicate → niche keyword score → top candidates
        → fetchFullArticleText() for each     # full HTML stripped to plain text
    → ClaudeService.generateLinkedInPost()    # parallel
    → ClaudeService.generateTwitterPost()     # parallel (if Twitter configured)
    → LinkedInService.createPost()            # parallel
    → TwitterService.tweet()                  # parallel (skipped if not configured)
```

### Module responsibilities
- **`core/`** — `@Global` module. Owns `ConfigModule` (Joi-validated), `HttpModule`, `AppLoggerService`. Available everywhere without re-importing.
- **`modules/news/`** — fetches from Reddit + Google News RSS + NewsAPI, scores by niche relevance keywords, fetches full article HTML and strips to plain text. Only stories with full readable content are returned.
- **`modules/claude/`** — wraps `@anthropic-ai/sdk`. Receives full article text. Prompts are written for a software architect persona targeting business investors/clients in ecommerce, hospitality, healthcare. **No post-generation truncation** — length is enforced in the prompt.
- **`modules/linkedin/`** — calls `https://api.linkedin.com/v2/ugcPosts` with `X-Restli-Protocol-Version: 2.0.0`. Skips init gracefully if credentials are missing.
- **`modules/twitter/`** — uses `twitter-api-v2`. Skips init gracefully if credentials are missing.
- **`modules/scheduler/`** — checks which platforms are configured on startup, throws if neither is set. `@Cron` reads `CRON_SCHEDULE` env var at decoration time (before module init).

### Platform optionality
Both LinkedIn and Twitter are optional — but at least one must be configured. The check happens in `SchedulerService` constructor. If a platform's credentials are empty/missing, it is silently skipped.

### Config pattern
All config accessed via `ConfigService.get<T>('app.xxx')` using `registerAs('app', ...)` in `core/config/app.config.ts`. Joi schema in `config.validation.ts` validates on startup.

## Key constraints
- **Never truncate posts** — if a post is wrong length, fix the prompt in `claude.service.ts`, not the output
- **Never invent facts** — Claude receives the full article text; prompts explicitly forbid adding any claim not present in the article
- All posts include the source URL
- Niche focus is always ecommerce, hospitality, or healthcare software — `NICHE_KEYWORDS` array in `news.service.ts` controls relevance scoring

## Environment setup
```bash
cp .env.example .env
# Required: ANTHROPIC_API_KEY, LINKEDIN_ACCESS_TOKEN, LINKEDIN_PERSON_URN
# Optional: NEWSAPI_KEY (newsapi.org free key — 100 req/day)
# Optional: TWITTER_APP_KEY, TWITTER_APP_SECRET, TWITTER_ACCESS_TOKEN, TWITTER_ACCESS_SECRET
# Optional: CRON_SCHEDULE (default: 0 9 */3 * *)
```

## GitHub Actions workflows
- `.github/workflows/daily-post.yml` — runs `npm run trigger` every 3 days. Secrets mirror `.env.example`.
- `.github/workflows/claude.yml` — `@claude` mention bot for issues and PR comments. Requires [github.com/apps/claude](https://github.com/apps/claude) installed.
- `.github/workflows/claude-review.yml` — auto PR review on every open/push.
