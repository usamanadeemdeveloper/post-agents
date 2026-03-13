# post-agents

Automated LinkedIn (and optionally X/Twitter) posting agent for software architects targeting investors and clients in **ecommerce, hospitality, and healthcare**. Researches real trending discussions across Reddit, Google News, and NewsAPI — then uses Claude AI to write authoritative, fact-only posts on a configurable schedule.

**Runs completely free** via GitHub Actions. No server required. Everything is controlled via GitHub Secrets — no code changes needed to change behaviour.

---

## How it works

```
Daily at 9:00 AM UTC — check if POST_INTERVAL_DAYS have elapsed since last post
        ↓ (skip if not enough time has passed)
Fetch trending stories in parallel:
  ├── Reddit        (subreddits from NEWS_NICHE profile)
  ├── Google News RSS  (queries from NEWS_NICHE profile)
  └── NewsAPI       (queries from NEWS_NICHE profile, optional)
        ↓
Merge → deduplicate → niche keyword score → top candidates
        ↓
Fetch full article text for each candidate
  └── Fallback: use description snippet if scraping fails
        ↓
Claude AI generates posts in parallel:
  ├── LinkedIn post  (style set by POSTING_STYLE)
  └── X/Twitter post (same style, shorter format)
        ↓
Publish to configured platforms in parallel:
  ├── LinkedIn  (UGC Posts API)  — if credentials set
  └── X/Twitter (twitter-api-v2) — if credentials set
        ↓
Persist .last-post-date → GitHub Actions commits it back to repo
```

> At least one platform must be configured. If only LinkedIn credentials are set, Twitter is silently skipped — and vice versa.

---

## Prerequisites

### 1. Anthropic (Claude AI) — required

1. Go to [console.anthropic.com](https://console.anthropic.com)
2. Create an API key → `ANTHROPIC_API_KEY`
3. Add credits (minimum $5 — costs ~$0.01–0.03 per run, lasts months)

---

### 2. NewsAPI — optional but recommended

1. Go to [newsapi.org](https://newsapi.org) → **Get API Key** (free, 100 req/day)
2. Copy it → `NEWSAPI_KEY`

> Without this the pipeline still works via Reddit + Google News.

---

### 3. LinkedIn — required (unless Twitter is configured)

**Step 1 — Create a LinkedIn Developer App**
1. Go to [linkedin.com/developers/apps](https://www.linkedin.com/developers/apps) → **Create app**
2. Fill in the name — LinkedIn requires a LinkedIn Page association (portal requirement only, posts still go to your personal profile). No page? Create a free one at [linkedin.com/company/setup/new](https://www.linkedin.com/company/setup/new) then come back.
3. Under **Products**, request **Share on LinkedIn** and **Sign In with LinkedIn using OpenID Connect**

**Step 2 — Get your access token**
1. Go to [linkedin.com/developers/tools/oauth](https://www.linkedin.com/developers/tools/oauth)
2. Select your app, tick scopes: `w_member_social`, `openid`, `profile`
3. Tick the redirect URL checkbox → **Request access token** → copy it → `LINKEDIN_ACCESS_TOKEN`

> ⚠️ LinkedIn tokens **expire after 60 days**. Set a calendar reminder to regenerate before expiry.

**Step 3 — Find your Person URN**
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" https://api.linkedin.com/v2/userinfo
```
Copy the `sub` value → your URN is `urn:li:person:THAT_VALUE` → `LINKEDIN_PERSON_URN`

> To post as a company page instead: `urn:li:organization:xxxxxxxx`

---

### 4. Twitter / X — optional

**Step 1 — Create a developer app**
1. Go to [developer.twitter.com/en/portal/dashboard](https://developer.twitter.com/en/portal/dashboard)
2. Click **+ Create Project** → give it a name → select **Making a bot** as use case
3. Create an **App** inside the project → give it a name → click **Complete**

**Step 2 — Enable Read and Write permissions**
1. Open your app → go to **User authentication settings**
2. Set **App permissions** to **Read and Write**
3. Set **Type of App** to **Web App, Automated App or Bot**
4. For **Callback URI** enter `https://localhost` (placeholder — not used)
5. For **Website URL** enter any URL (e.g. your GitHub repo)
6. Click **Save**

> ⚠️ You MUST set Read and Write permissions BEFORE generating tokens — tokens generated with Read-only permissions cannot post tweets.

**Step 3 — Get your keys**

Open your app → **Keys and tokens** panel:

| What you see on screen | Secret name |
|---|---|
| **Consumer Key** | `TWITTER_APP_KEY` |
| **Consumer Secret** | `TWITTER_APP_SECRET` |
| **Access Token** | `TWITTER_ACCESS_TOKEN` |
| **Access Token Secret** | `TWITTER_ACCESS_SECRET` |

> ⚠️ Access Token and Secret are shown **only once**. Copy immediately.

> Free tier: 1,500 posts/month — more than enough.

---

## Local setup

```bash
# 1. Clone and install
git clone <your-repo-url>
cd post-agents
npm install

# 2. Configure environment
cp .env.example .env
# Fill in at minimum: ANTHROPIC_API_KEY, LINKEDIN_ACCESS_TOKEN, LINKEDIN_PERSON_URN

# 3. Test LinkedIn credentials first (no Claude credits needed)
npm run test:linkedin

# 4. Run the full pipeline once
npm run trigger
```

---

## Deploy with GitHub Actions (free)

### Step 1 — Push to GitHub
```bash
git remote add origin https://github.com/YOUR_USERNAME/post-agents.git
git push -u origin main
```

### Step 2 — Add GitHub Secrets

Go to repo → **Settings → Secrets and variables → Actions → New repository secret**

#### Required

| Secret | Description |
|---|---|
| `ANTHROPIC_API_KEY` | Claude API key from console.anthropic.com |
| `LINKEDIN_ACCESS_TOKEN` | LinkedIn OAuth access token |
| `LINKEDIN_PERSON_URN` | `urn:li:person:xxxxxx` from `/v2/userinfo` |

#### Recommended

| Secret | Description | Default |
|---|---|---|
| `CLAUDE_MODEL` | Claude model to use | `claude-sonnet-4-6` |
| `NEWSAPI_KEY` | NewsAPI key — adds a third news source | NewsAPI skipped |
| `POST_INTERVAL_DAYS` | Days between posts (`1`, `3`, `7`, etc.) | `3` |

#### Content & persona

| Secret | Description | Default |
|---|---|---|
| `NEWS_NICHE` | Research focus: `business-architect` (ecommerce/healthcare/hospitality) or `developer` | `business-architect` |
| `NEWS_STORY_COUNT` | How many stories to fetch per run (1–20) | `10` |
| `POSTING_STYLE` | Post persona: `business-architect`, `default`, `technical`, `marketing`, `casual` | `default` |
| `DEFAULT_TONE` | Free-text tone hint injected into every prompt e.g. `"authoritative and client-facing"` | none |
| `POST_HASHTAGS_LINKEDIN` | Override LinkedIn hashtags e.g. `#Ecommerce #HealthTech #HospitalityTech` | style defaults |
| `POST_HASHTAGS_TWITTER` | Override Twitter/X hashtags | style defaults |
| `LINKEDIN_POST_LENGTH` | Override LinkedIn length hint e.g. `800–1100 characters` | style defaults |
| `TWITTER_POST_LENGTH` | Override Twitter length hint e.g. `200 and 220 characters` | style defaults |

#### Footer

| Secret | Description | Default |
|---|---|---|
| `POST_AUTHOR_NAME` | Adds `— built by [name]` to footer. If not set, **no footer is added at all** | no footer |
| `POST_AGENT_NAME` | Custom bot name in footer e.g. `MyBot` | `PostAgent` |

#### Twitter / X (all optional)

| Secret | Description |
|---|---|
| `TWITTER_APP_KEY` | Twitter Consumer Key |
| `TWITTER_APP_SECRET` | Twitter Consumer Secret |
| `TWITTER_ACCESS_TOKEN` | Twitter Access Token |
| `TWITTER_ACCESS_SECRET` | Twitter Access Token Secret |

#### Advanced

| Secret | Description | Default |
|---|---|---|
| `CONTENT_SIMILARITY_THRESHOLD` | Dedup strictness `0.0`–`1.0` | `0.8` |
| `ENABLE_CLAUDE_BOT` | Set to `'false'` to disable the `@claude` mention bot workflow | enabled |
| `ENABLE_PR_REVIEW` | Set to `'false'` to disable auto PR review workflow | enabled |

### Step 3 — Done

The workflow runs daily and posts whenever `POST_INTERVAL_DAYS` have elapsed since the last post.

To trigger manually anytime: **Actions tab → Tech Post → Run workflow**

Use the **force** option in the manual trigger to post immediately regardless of the interval.

---

## Posting styles

| Style | Persona | Best for |
|---|---|---|
| `business-architect` | Software architect selling services to business clients | Attracting investors and clients in ecommerce/healthcare/hospitality |
| `default` | Senior software engineer sharing dev insights | General developer audience |
| `technical` | Software architect sharing architecture analysis | Engineering leads, CTOs |
| `marketing` | Engineering consultancy, opportunity-focused | Founders, product leaders |
| `casual` | Authentic, conversational developer voice | Relatable developer community |

To add a custom style: create `prompts/my-style.prompt.ts` exporting `myStyleLinkedInPrompt` and `myStyleTwitterPrompt`, then add one entry to `PROMPT_REGISTRY` in `prompts/prompt-resolver.ts`.

---

## Change posting frequency

Set the `POST_INTERVAL_DAYS` GitHub Secret to any number of days. No code changes needed.

| `POST_INTERVAL_DAYS` | Posts |
|---|---|
| `1` | Daily |
| `3` | Every 3 days (default) |
| `7` | Weekly |
| `14` | Every 2 weeks |

---

## Claude bot (PR reviews + issue fixes)

**Automatic PR review** — Claude reviews every PR for bugs, code quality, and security. Disable with `ENABLE_PR_REVIEW=false`.

**`@claude` mention** — mention `@claude` in any issue or PR comment and Claude reads context, fixes bugs, and pushes commits directly. Disable with `ENABLE_CLAUDE_BOT=false`.

**One-time setup:** Install [github.com/apps/claude](https://github.com/apps/claude) on your repo. Reuses your existing `ANTHROPIC_API_KEY` — nothing extra needed.

---

## Troubleshooting

**Posts stopped after ~60 days**
→ LinkedIn token expired. Regenerate at [linkedin.com/developers/tools/oauth](https://www.linkedin.com/developers/tools/oauth) and update `LINKEDIN_ACCESS_TOKEN`.

**`AuthenticationError: invalid x-api-key`**
→ Check `ANTHROPIC_API_KEY` — must start with `sk-ant-`, no extra spaces.

**`Your credit balance is too low`**
→ Add credits at [console.anthropic.com](https://console.anthropic.com) → Plans & Billing.

**No stories found / all skipped**
→ All fetched articles were blocked by paywalls. The pipeline automatically falls back to the article description snippet. Add `NEWSAPI_KEY` to increase source coverage.

**`No social platform configured`**
→ Neither LinkedIn nor Twitter credentials are set. Configure at least one platform.

**Workflow ran but no post was made**
→ `POST_INTERVAL_DAYS` has not elapsed since the last post. Check `.last-post-date` in the repo, or trigger manually with `force=true`.

**GitHub Actions run failed**
→ Actions tab → click the failed run → expand the failed step to see full logs.
