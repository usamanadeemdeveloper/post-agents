# post-agents

Automated LinkedIn (and optionally X/Twitter) posting agent for software architects targeting investors and clients in **ecommerce, hospitality, and healthcare**. It researches recent source-backed stories, validates niche fit and factual support, and falls back to vetted evergreen source packs when live discovery is weak.

**Runs completely free** via GitHub Actions. No server required. Everything is controlled via GitHub Secrets — no code changes needed to change behaviour.

---

## How it works

```
Daily at 9:00 AM UTC — check if POST_INTERVAL_DAYS have elapsed since last successful post
        ↓ (skip if not enough time has passed)
Fetch recent stories in parallel:
  ├── Google News RSS  (queries from NEWS_NICHE profile)
  ├── NewsAPI          (queries from NEWS_NICHE profile, optional)
  ├── Reddit           (developer niche only / community-enabled profiles)
  └── Dev.to           (developer niche only / community-enabled profiles)
        ↓
Merge → deduplicate → source/domain filtering → niche keyword score → top candidates
        ↓
Fetch full article text for each candidate
  └── No summary-snippet fallback — only full text or curated evergreen packs
        ↓
Validate niche alignment on fetched content
        ↓
Claude AI generates posts in parallel:
  ├── LinkedIn post  (style set by POSTING_STYLE)
  └── X/Twitter post (same style, shorter format)
        ↓
Claude validates / repairs generated output against factual anchors
        ↓
If live discovery fails:
  ├── Use curated evergreen source packs
  └── If Claude generation still fails, use deterministic fallback post text
        ↓
If SLACK_BOT_TOKEN + SLACK_CHANNEL_ID are set:
  └── Post preview to Slack with niche label + full post text
      └── Wait for ✅ reaction (up to SLACK_APPROVAL_TIMEOUT_MINUTES)
          ├── ✅ received → proceed to publish
          └── No reaction / timeout → abort run
        ↓
Publish to configured platforms in parallel:
  ├── LinkedIn  (UGC Posts API)  — if credentials set
  └── X/Twitter (twitter-api-v2) — if credentials set
        ↓
Retry publish attempts up to PUBLISH_RETRY_ATTEMPTS
        ↓
Persist .last-post-date only if at least one platform actually published
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

> Without this the pipeline still works via Google News discovery and the fallback layers.

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

### 4. Slack approval gate — optional

Skip this section if you want posts to publish automatically without any review step.

When enabled, the pipeline sends a full post preview to your Slack channel before publishing. You react with ✅ to approve. No reaction within the timeout = run aborts without posting.

**Step 1 — Create a Slack App**
1. Go to [api.slack.com/apps](https://api.slack.com/apps) — sign in with the account that owns your workspace
2. Click **Create New App** → **From scratch**
3. Enter a name (e.g. `PostAgent`), select your workspace from the dropdown → **Create App**

**Step 2 — Add Bot Token Scopes**
1. In the left sidebar click **OAuth & Permissions**
2. Scroll down to **Scopes** → **Bot Token Scopes** → click **Add an OAuth Scope**
3. Add these two scopes one at a time:
   - `chat:write` — lets the bot post messages
   - `reactions:read` — lets the bot read emoji reactions on its messages

**Step 3 — Install the app to your workspace**
1. Scroll back up on the same **OAuth & Permissions** page
2. Click **Install to Workspace** → **Allow**
3. You are taken back to the same page — copy the **Bot User OAuth Token** (starts with `xoxb-`) → this is your `SLACK_BOT_TOKEN`

> ⚠️ If you add scopes after the initial install, Slack will show a yellow banner saying the app needs to be reinstalled. Click **reinstall your app** in that banner, allow again, then copy the fresh token.

**Step 4 — Invite the bot to your channel**
1. In Slack, open the channel where you want previews to appear (or create a new private one e.g. `#post-approvals`)
2. Type `/invite @PostAgent` (replace with whatever name you gave your app) and press Enter
3. Slack will confirm the bot was added to the channel

> If `/invite` doesn't autocomplete your bot name, go to the channel → click the channel name at the top → **Integrations** tab → **Add an App** → search for your app name.

**Step 5 — Get the Channel ID**

**Desktop app:**
1. Right-click the channel name in the sidebar → **View channel details**
2. Scroll to the very bottom of the details panel — you will see the **Channel ID** (e.g. `C08XXXXXXXX`) → copy it

**Browser:**
1. Open the channel in your browser
2. Look at the URL — it looks like `https://app.slack.com/client/TXXXXXXXX/CXXXXXXXXXX`
3. The last segment after the final `/` is your Channel ID (starts with `C`) → copy it → this is your `SLACK_CHANNEL_ID`

**Step 6 — Add secrets to GitHub**

Go to your repo → **Settings → Secrets and variables → Actions** and add:

| Secret | Value |
|---|---|
| `SLACK_BOT_TOKEN` | The `xoxb-...` token from Step 3 |
| `SLACK_CHANNEL_ID` | The `C...` channel ID from Step 5 |

That's it. The two optional secrets below have sensible defaults:

| Secret | Description | Default |
|---|---|---|
| `SLACK_APPROVE_EMOJI` | Emoji name to react with (no colons) | `white_check_mark` (✅) |
| `SLACK_APPROVAL_TIMEOUT_MINUTES` | How long to wait before aborting (max 360) | `360` |

> **Billing note:** The GitHub Actions job stays alive while waiting for your reaction. On **public repos** this is completely free. On **private repos** minutes are billed — set `SLACK_APPROVAL_TIMEOUT_MINUTES` to a realistic window like `60` or `120` to avoid burning through your free quota.

---

### 5. Twitter / X — optional

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
# Recommended for first run: NEWS_NICHE=business-architect, POSTING_STYLE=business-architect

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
| `NEWSAPI_KEY` | NewsAPI key — adds another discovery source | NewsAPI skipped |
| `POST_INTERVAL_DAYS` | Days between posts (`1`, `3`, `7`, etc.) | `3` |

#### Content & persona

| Secret | Description | Default |
|---|---|---|
| `NEWS_NICHE` | Research focus: `business-architect` (ecommerce/healthcare/hospitality) or `developer` | `business-architect` |
| `NEWS_STORY_COUNT` | How many candidate stories to fetch per run (1–20) | `10` |
| `NEWS_RESEARCH_WINDOW_DAYS` | Recent-content window for discovery and ranking | `30` |
| `ALLOW_EVERGREEN_FALLBACK` | Set to `false` to disable curated evergreen fallback packs | `true` |
| `POSTING_STYLE` | Post persona: `business-architect`, `default`, `technical`, `marketing`, `casual` | niche-driven (`business-architect` for business niche, `technical` for developer niche) |
| `DEFAULT_TONE` | Free-text tone hint injected into every prompt e.g. `"authoritative and client-facing"` | none |
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

#### Slack approval gate (optional)

| Secret | Description | Default |
|---|---|---|
| `SLACK_BOT_TOKEN` | Bot User OAuth Token from your Slack app (`xoxb-...`) | no approval gate |
| `SLACK_CHANNEL_ID` | Channel ID where previews are posted (`C...`) | — |
| `SLACK_APPROVE_EMOJI` | Emoji name to react with for approval (no colons) | `white_check_mark` |
| `SLACK_APPROVAL_TIMEOUT_MINUTES` | How long to wait for your reaction before aborting (max 360) | `360` |

> Both `SLACK_BOT_TOKEN` and `SLACK_CHANNEL_ID` must be set to enable the approval gate. If either is missing, posts publish immediately as before.

#### Advanced

| Secret | Description | Default |
|---|---|---|
| `CONTENT_SIMILARITY_THRESHOLD` | Dedup strictness `0.0`–`1.0` | `0.8` |
| `PUBLISH_RETRY_ATTEMPTS` | Publish retry attempts per platform | `3` |
| `FAIL_ON_PUBLISH_FAILURE` | Set to `true` to make the run fail when all configured platforms reject the post | `false` |
| `ENABLE_CLAUDE_BOT` | Set to `'false'` to disable the `@claude` mention bot workflow | enabled |
| `ENABLE_PR_REVIEW` | Set to `'false'` to disable auto PR review workflow | enabled |

### Step 3 — Done

The workflow runs daily and posts whenever `POST_INTERVAL_DAYS` have elapsed since the last successful publish.

To trigger manually anytime: **Actions tab → Tech Post → Run workflow**

Use the **force** option in the manual trigger to post immediately regardless of the interval.

> If your target branch is protected with “changes must be made through a pull request”, the workflow may be unable to persist `.last-post-date` and `.post-history.json`. Either allow GitHub Actions to bypass that rule or run the posting workflow on a branch where the bot can push state updates.

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
→ This usually means the fetched stories were off-niche, blocked, or had no usable full text. Increase `NEWS_RESEARCH_WINDOW_DAYS`, add `NEWSAPI_KEY`, or leave `ALLOW_EVERGREEN_FALLBACK=true` so the workflow can fall back to curated source packs.

**`"FAIL_ON_PUBLISH_FAILURE" must be a boolean`**
→ Set the secret to `true` or `false` exactly. No quotes, no extra spaces.

**Protected branch push rejected by GitHub**
→ Your repo likely blocks direct pushes and requires PRs. The posting workflow needs permission to commit `.last-post-date` and `.post-history.json` back to the branch if you want interval/history persistence.

**`No social platform configured`**
→ Neither LinkedIn nor Twitter credentials are set. Configure at least one platform.

**Workflow ran but no post was made**
→ `POST_INTERVAL_DAYS` has not elapsed since the last post. Check `.last-post-date` in the repo, or trigger manually with `force=true`.

**Slack preview sent but job timed out without publishing**
→ You didn't react with ✅ within `SLACK_APPROVAL_TIMEOUT_MINUTES`. The run aborted intentionally. Trigger manually with `force=true` if you still want to post.

**`Slack chat.postMessage failed: not_in_channel`**
→ The bot hasn't been invited to your channel. In Slack, type `/invite @YourBotName` in the target channel.

**`Slack chat.postMessage failed: invalid_auth`**
→ `SLACK_BOT_TOKEN` is wrong or expired. Regenerate from your app's **OAuth & Permissions** page.

**Slack bot posts the message but reactions are never detected**
→ Check that `SLACK_APPROVE_EMOJI` matches exactly the emoji name without colons (e.g. `white_check_mark`, not `:white_check_mark:`). Also confirm the `reactions:read` scope is added and the app is reinstalled after adding it.

**GitHub Actions run failed**
→ Actions tab → click the failed run → expand the failed step to see full logs.
