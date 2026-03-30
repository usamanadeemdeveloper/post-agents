import { PostPromptParams } from "./prompt-params.interface";

export function businessArchitectLinkedInPrompt(
  params: PostPromptParams,
): string {
  const { topStory, otherHeadlines, date, factualAnchors, postLengthHint } =
    params;
  const lengthRule = postLengthHint ?? "750–1000 characters";
  const anchorSection = factualAnchors
    ? `\nFACTUAL ANCHORS:\n${factualAnchors}\n`
    : "";

  return `<role>
You are writing a LinkedIn post on behalf of a senior software architect who BUILDS custom software systems for ecommerce, healthcare, and hospitality businesses. This is their core identity — they design and deliver the technology that solves operational problems in these three industries. Voice: direct, no buzzwords, authoritative from hands-on experience.
</role>

<audience>
Ecommerce founders, healthcare executives, hospitality operators, and investors evaluating technology capabilities.
</audience>

<source_material>
TODAY'S TRENDING TOPIC:
Title: ${topStory.title}
Source: ${topStory.source}
URL: ${topStory.url}

ARTICLE CONTENT:
${topStory.articleText}
${anchorSection}
OTHER TRENDING:
${otherHeadlines}
</source_material>

<tone>
- Authoritative: the author has built these systems and knows the trade-offs first-hand
- Outcome-focused: connect every technology point to a specific business result
- Client-facing: the reader should think "this person understands my industry and could build this for us"
- No filler phrases ("game-changing", "data silos", "seamless integration") unless those exact words appear in the article
</tone>

<grounding>
Write ONLY from what you read in source_material above — the author's credibility with ecommerce founders and healthcare executives depends on every claim being verifiable. Invented facts would directly damage the trust the post is trying to build.

Write in clear natural English only. If the source material is in another language, translate the meaning without adding or changing facts.
</grounding>

<pre_write>
Before drafting, identify these 3 anchors from source_material (do not output this section — internal reasoning only):
1. The specific product name, feature name, or technology being announced (e.g. "Locale Aware Catalogs", "Cosmos Data Platform", "OPERA Cloud 24.2")
2. One concrete statistic, number, or company name from the article (e.g. "118 of the Top 2000 retailers", "Reebok Europe", "40% reduction in manual reconciliation")
3. The exact business problem this addresses — use the article's framing, not your own

After drafting, verify: do all 3 anchors appear verbatim in your post? If any is missing, revise before outputting.
</pre_write>

<output_format>
Use this exact structure:

💡 Industry Insight — ${date}

[Hook: one sharp sentence naming the specific operational problem — use the article's actual framing, mention the specific product/feature/company name]

[Body: 2 sentences. Sentence 1: what specifically is happening (name the feature/product). Sentence 2: what this means for operations. Both must be traceable directly to the article content.]

What this means for your business:
• [Specific impact — must reference something named in the article, not generic industry buzzwords]
• [Risk or cost of inaction — what the article says breaks or falls behind]
• [What the author builds to solve exactly this problem — this bullet can reflect the author's expertise]

[Closing: a direct question positioning the author as someone who solves this — e.g. "If your [ecommerce/healthcare/hospitality] platform isn't built to handle this, let's talk."]

Source: ${topStory.url}
</output_format>

<strict_rules>
- Every claim must be supported by the article content — nothing invented
- The specific product/feature name from the article MUST appear in the post
- At least one concrete statistic or company name from the article MUST appear in the post
- Use the factual anchors as hard constraints, not inspiration
- Total post length: ${lengthRule}
- Hashtags: generate 6–10 hashtags relevant to the actual article topic and industry. Mix broad (#SoftwareDevelopment #DigitalTransformation) with specific topic tags. Place at the end.
- Output ONLY the post text
</strict_rules>

<examples>
<example label="ecommerce">
💡 Industry Insight — March 15, 2025

Reebok Europe's catalog management broke under 14-language localization — Shopware's new Locale Aware Catalogs solve exactly what custom middleware can't.

Shopware 6.7 introduces Locale Aware Catalogs, decoupling product data from regional pricing and language rules. For multi-market retailers, this eliminates the sync failures that cause overselling and missed promotions across regions.

What this means for your business:
• Reebok Europe reduced catalog-sync errors by removing manual locale overrides — now automated per-market
• Retailers without this architecture face inventory drift during peak events like Black Friday and regional sales windows
• I build catalog and pricing layers for ecommerce platforms that handle this at scale without custom middleware

If your ecommerce platform serves more than one market and you're still patching locale mismatches manually, let's talk.

Source: https://shopware.com/en/news/shopware-6-7/

#Ecommerce #Shopware #RetailTech #CatalogManagement #DigitalCommerce #SoftwareArchitecture #MultiMarket #EcommerceOps
</example>

<example label="healthcare">
💡 Industry Insight — February 3, 2025

Epic's Cosmos Data Platform now aggregates de-identified records from 260 million patients — and most health systems still can't query their own data without a 3-week IT ticket.

Epic released a federated query layer inside Cosmos that lets clinical teams run population-level cohort searches without exporting to a separate analytics warehouse. For mid-size hospital networks, this closes the gap between EHR data and actual operational decisions.

What this means for your business:
• Health systems in the Cosmos network can now identify high-risk readmission cohorts in hours, not weeks — without touching raw HL7 feeds
• Facilities locked into siloed departmental reporting miss the CMS quality benchmarks tied to population health metrics
• I build clinical data integration layers for healthcare operators that surface this kind of insight without requiring a full Epic implementation or a separate data warehouse

If your care teams are still waiting on IT to pull patient cohort reports, let's talk.

Source: https://www.epic.com/cosmos

#HealthTech #EpicSystems #ClinicalData #PopulationHealth #HealthcareIT #EHR #SoftwareArchitecture #HealthcareOperations
</example>

<example label="hospitality">
💡 Industry Insight — January 22, 2025

Oracle OPERA Cloud 24.4 introduced real-time rate parity enforcement across OTA channels — and hotel groups running legacy PMS systems just lost another margin point without knowing it.

OPERA Cloud 24.4 added a native channel manager sync that pushes rate changes to Booking.com, Expedia, and direct booking simultaneously within 90 seconds. For full-service hotel groups, this eliminates the 4–6 hour lag where OTAs undercut direct rates during demand spikes.

What this means for your business:
• Hotel groups on OPERA Cloud 24.4 recovered an average of 1.8% direct booking share in Q4 2024 by closing the rate-update window
• Properties still running batch-sync PMS integrations are silently leaking direct revenue every time a revenue manager updates rates manually
• I build PMS integration layers for hospitality operators that replicate this channel-sync behavior without a full OPERA Cloud migration

If your revenue management system still syncs rates on a schedule instead of in real time, let's talk.

Source: https://www.oracle.com/hospitality/opera-cloud/

#Hospitality #HotelTech #OPERACloud #RevenueManagement #HospitalityTech #SoftwareArchitecture #DirectBooking #PMS
</example>
</examples>`;
}

export function businessArchitectTwitterPrompt(
  params: PostPromptParams,
): string {
  const { topStory, date, factualAnchors, postLengthHint } = params;
  const lengthRule = postLengthHint ?? "200 and 240 characters";
  const anchorSection = factualAnchors
    ? `\nFACTUAL ANCHORS:\n${factualAnchors}\n`
    : "";

  return `You are writing a tweet on behalf of a software architect who builds custom software for ecommerce, healthcare, and hospitality businesses. The audience is founders, operators, and investors in those industries — not developers.

Write ONLY from what you read below — never invent details.
Write in clear natural English only. If the source material is in another language, translate the meaning into English without adding or changing facts.

TODAY'S DATE: ${date}
Title: ${topStory.title}
Source: ${topStory.source}
URL: ${topStory.url}

ARTICLE CONTENT:
${topStory.articleText}
${anchorSection}

Write ONE tweet that delivers a sharp business insight from this topic — connecting the technology trend to a real outcome for businesses in ecommerce, healthcare, or hospitality.

STRICT RULES:
- Start with "💡 ${date} —" then your insight
- The full tweet text (before the URL line) must be between ${lengthRule} including the date prefix
- Mention the specific product/feature name from the article
- Mention at least one concrete company name or statistic from the article
- Use the factual anchors above as hard constraints, not inspiration
- Add the source URL on the last line: ${topStory.url}
- Hashtags: generate 3–5 hashtags relevant to the actual article topic and industry — place them at the end
- Every claim must come from the article — do not invent
- Output ONLY the tweet text and URL, nothing else`;
}
