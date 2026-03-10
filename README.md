# post-agents

Automated LinkedIn posting agent for software architects targeting investors and clients in **ecommerce, hospitality, and healthcare**. Researches real trending discussions across Reddit, Google News, and NewsAPI — then uses Claude AI to write authoritative, fact-only posts every 3 days.

**Runs completely free** via GitHub Actions. No server required.

---

## How it works

```
Every 3 days at 9:00 AM UTC
        ↓
Fetch trending stories from Reddit (10 niche subreddits)
                        + Google News RSS (3 niche queries)
                        + NewsAPI (3 niche queries)
        ↓
Score for relevance to ecommerce / hospitality / healthcare software
        ↓
Fetch full article text for top candidates
        ↓
Claude AI writes a LinkedIn post (700–950 chars)
Facts come only from the real article. Source URL always included.
        ↓
Publish to LinkedIn
        ↓
GitHub Actions marks run ✓ or ✗
```

> Twitter/X is optional — configure credentials to enable it, leave blank to skip.

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

### 3. LinkedIn — required

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

Open your app → click the **Keys and tokens** icon (or go to **Apps → your app → Keys and tokens panel**). You will see:

| What you see on screen | `.env` variable |
|---|---|
| **OAuth 1.0 Keys → Consumer Key** → click **Show** | `TWITTER_APP_KEY` |
| **OAuth 1.0 Keys → Consumer Key** → click **Regenerate** → copy the **Consumer Secret** shown | `TWITTER_APP_SECRET` |
| **OAuth 1.0 Keys → Access Token** → click **Generate** → copy the **Access Token** shown | `TWITTER_ACCESS_TOKEN` |
| Same generation popup → copy the **Access Token Secret** | `TWITTER_ACCESS_SECRET` |

> ⚠️ The Access Token and Secret are shown **only once** at generation time. Copy them immediately — if you close the popup you must regenerate.

> The **OAuth 2.0 Keys** section (Client ID / Client Secret) is NOT needed — ignore it.

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
# Fill in: ANTHROPIC_API_KEY, LINKEDIN_ACCESS_TOKEN, LINKEDIN_PERSON_URN
# Optional: NEWSAPI_KEY, TWITTER_* credentials

# 3. Test LinkedIn credentials first (no Claude credits needed)
npm run test:linkedin

# 4. Run the full pipeline
npm run trigger
```

Expected output:
```
Platforms enabled — LinkedIn: ✓  Twitter: ✗
Fetching from Reddit, Google News, and NewsAPI in parallel...
Raw items — Reddit: 47 | Google News: 18 | NewsAPI: 22
✓ "How AI is transforming hotel check-in" [r/hospitality]
...
=== Run complete ===
LinkedIn : ✓ post ID urn:li:share:xxxxxxxxxx
Twitter  : not configured — skipped
```

---

## Deploy with GitHub Actions (free)

### Step 1 — Push to GitHub
```bash
git init
git add .
git commit -m "initial commit"
git remote add origin https://github.com/YOUR_USERNAME/post-agents.git
git push -u origin main
```

### Step 2 — Add GitHub Secrets

Go to repo → **Settings → Secrets and variables → Actions → New repository secret**

| Secret | Required | Where to get it |
|---|---|---|
| `ANTHROPIC_API_KEY` | ✅ | console.anthropic.com |
| `CLAUDE_MODEL` | ✅ | Set to `claude-sonnet-4-6` |
| `LINKEDIN_ACCESS_TOKEN` | ✅ | LinkedIn OAuth tool |
| `LINKEDIN_PERSON_URN` | ✅ | `/v2/userinfo` curl call |
| `NEWSAPI_KEY` | ⭐ recommended | newsapi.org |
| `TWITTER_APP_KEY` | optional | Twitter Developer Portal |
| `TWITTER_APP_SECRET` | optional | Twitter Developer Portal |
| `TWITTER_ACCESS_TOKEN` | optional | Twitter Developer Portal |
| `TWITTER_ACCESS_SECRET` | optional | Twitter Developer Portal |

### Step 3 — Done

Posts automatically every 3 days at **9:00 AM UTC**.

To trigger manually anytime: **Actions tab → Tech Post (Every 3 Days) → Run workflow**

---

## Change posting frequency

Default: every 3 days (`0 9 */3 * *`). To change, update both places:

**`.github/workflows/daily-post.yml`:**
```yaml
- cron: '0 9 */4 * *'   # every 4 days
```

**`.env` / GitHub Secret:**
```
CRON_SCHEDULE=0 9 */4 * *
```

Use [crontab.guru](https://crontab.guru) to build expressions.

---

## Claude bot (PR reviews + issue fixes)

**Automatic PR review** — Claude reviews every PR for bugs, code quality, and security.

**`@claude` mention** — mention `@claude` in any issue or PR comment:
```
# Paste a screenshot of a bad post + write:
@claude the LinkedIn post in this screenshot is missing the source URL.
Fix the prompt in claude.service.ts so it always includes it.
```
Claude reads the image, finds the file, and pushes a fix commit directly.

**One-time setup:** Install [github.com/apps/claude](https://github.com/apps/claude) on your repo. Reuses your existing `ANTHROPIC_API_KEY` secret — nothing extra needed.

---

## Troubleshooting

**Posts stopped after ~60 days**
→ LinkedIn token expired. Regenerate at [linkedin.com/developers/tools/oauth](https://www.linkedin.com/developers/tools/oauth) and update `LINKEDIN_ACCESS_TOKEN` GitHub Secret.

**`AuthenticationError: invalid x-api-key`**
→ Check `ANTHROPIC_API_KEY` in `.env` — must start with `sk-ant-`, no extra spaces.

**`Your credit balance is too low`**
→ Add credits at [console.anthropic.com](https://console.anthropic.com) → Plans & Billing.

**No stories found / all skipped**
→ All fetched articles were blocked by paywalls. The pipeline retries with the next best candidate automatically. If persistent, add `NEWSAPI_KEY` to increase source coverage.

**GitHub Actions run failed**
→ Actions tab → click the failed run → expand **Run daily post pipeline** to see full logs.
