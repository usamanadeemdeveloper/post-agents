# PROJECT_MEMORY.md

Last initialized: 2026-03-12
Workspace: /Users/hammad/workspace/post-agents

## Purpose
Automated social posting pipeline for a software architect brand in 3 niches:
- ecommerce
- healthcare
- hospitality

It fetches trending news/discussions, asks Claude to write posts from source content, then publishes to LinkedIn (required in practice) and optionally X/Twitter.

## Runtime Entry Points
- `src/run-once.ts`: non-HTTP Nest application context used by cron/GitHub Actions (`npm run trigger`)
- `src/main.ts`: HTTP bootstrap (not used for production posting flow)

## End-to-End Flow
1. `SchedulerService.triggerManually()` or `runDailyPost()` starts a run.
2. `NewsService.fetchTopTechStories(5)`:
   - fetches Reddit + Google News RSS + NewsAPI in parallel
   - deduplicates and relevance-scores by niche keywords
   - fetches article text for top candidates
3. `ClaudeService` generates:
   - LinkedIn post
   - tweet (if Twitter credentials configured)
4. Posting happens in parallel:
   - `LinkedInService.createPost()`
   - `TwitterService.tweet()`
5. Run completes and exits with code `1` only when both platforms fail.

## Key Modules
- `src/modules/news/*`: source aggregation, scoring, scraping/cleaning article text
- `src/modules/claude/*`: Anthropic SDK calls and post prompts
- `src/modules/linkedin/*`: LinkedIn UGC API posting
- `src/modules/twitter/*`: twitter-api-v2 posting
- `src/modules/scheduler/*`: orchestrates platform enablement, generate + publish flow
- `src/core/*`: global config (`Joi` validated), HTTP module, logger

## Important Commands
- `npm run trigger`: full one-off pipeline
- `npm run test:linkedin`: credential-only LinkedIn post test
- `npm run test:social`: credential-only LinkedIn + Twitter post test
- `npm run build`
- `npm run test:e2e`

## Environment and Ops Notes
- `ANTHROPIC_API_KEY` is currently required at startup by schema validation.
- At least one social platform must be configured (`SchedulerService` guard).
- GitHub Action schedule is in `.github/workflows/daily-post.yml`.
- Story selection now supports `POST_VARIATION_SEED` to rotate primary story choice across top candidates per run.
- Posted-story dedup is persisted in `.post-history.json` (configurable via `POST_HISTORY_FILE`).
- Workflow auto-commits `.post-history.json` after runs when it changes.
- Duplicate prevention now has two layers:
  - story-level dedup (URL/title/source)
  - generated-content hash dedup (platform-specific), with retry on next candidate story.

## Review Snapshot (2026-03-12)
Main risk areas identified:
- Reddit self-post `articleText` is currently ignored during final content selection.
- LinkedIn prompt has conflicting hashtag rules.
- `src/test-social.ts` tweet fixture is over Twitter's 280-char limit.
- E2E test teardown can throw a secondary error when app bootstrap fails.
