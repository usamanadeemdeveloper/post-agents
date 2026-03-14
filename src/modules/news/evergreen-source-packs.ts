import { RealNewsItem } from "./interfaces/news-item.interface";
import { NewsNiche } from "./news-niches";

interface EvergreenSourcePack {
  niche: NewsNiche;
  title: string;
  url: string;
  source: string;
  publishedAt: string;
  articleText: string;
}

const EVERGREEN_SOURCE_PACKS: EvergreenSourcePack[] = [
  {
    niche: "business-architect",
    title: "Shopify Markets centralizes international selling across storefronts, pricing, and domains",
    url: "https://help.shopify.com/en/manual/markets",
    source: "Shopify Help Center",
    publishedAt: "2025-01-15T00:00:00.000Z",
    articleText:
      "Shopify Markets is Shopify's central workspace for international selling. The help documentation explains that merchants can manage countries and regions, local currencies, local domains and subfolders, and product publishing for different markets from one admin. For a software architect, the operational takeaway is that cross-border commerce is no longer just a storefront problem. The architecture has to account for market-specific merchandising, pricing, and storefront behavior as a first-class system concern. Businesses that expand globally need integrations, order logic, analytics, and back-office workflows that stay aligned with each market configuration rather than assuming one universal catalog.",
  },
  {
    niche: "business-architect",
    title: "Shopify Flow shows why ecommerce operations increasingly depend on event-driven automation",
    url: "https://help.shopify.com/en/manual/shopify-flow",
    source: "Shopify Help Center",
    publishedAt: "2025-01-16T00:00:00.000Z",
    articleText:
      "Shopify Flow documentation describes an automation builder based on triggers, conditions, and actions. It is used to automate commerce operations like tagging customers, routing orders, and coordinating tasks across apps and admin workflows. The business lesson is that modern ecommerce stacks are becoming event-driven by default. Teams that still depend on manual handoffs or disconnected scripts create latency and inconsistency in fulfillment, service, and merchandising. A business architect should design operational systems so workflows can react cleanly to platform events and connect to the rest of the commerce stack without brittle custom glue.",
  },
  {
    niche: "business-architect",
    title: "FHIR remains the foundation for healthcare systems that need interoperable data exchange",
    url: "https://www.hl7.org/fhir/overview.html",
    source: "HL7 FHIR",
    publishedAt: "2025-01-17T00:00:00.000Z",
    articleText:
      "HL7's FHIR overview describes FHIR as a standard for exchanging healthcare information electronically using modular resources and modern web technologies. For healthcare software leaders, that matters because interoperability is not just a compliance topic; it shapes how scheduling, patient portals, care coordination, and analytics platforms connect. Systems that ignore interoperability standards create downstream friction for implementation, reporting, and patient experience. A business architect building healthcare platforms needs to treat standardized data exchange and API design as core product requirements rather than afterthought integrations.",
  },
  {
    niche: "business-architect",
    title: "Cloudbeds positions the PMS as the operational backbone for modern hospitality teams",
    url: "https://www.cloudbeds.com/hotel-management-software/",
    source: "Cloudbeds",
    publishedAt: "2025-01-18T00:00:00.000Z",
    articleText:
      "Cloudbeds describes its platform as a hospitality management system that connects reservations, guest operations, payments, and distribution in one workflow. That is a useful architectural signal for hospitality operators because fragmented hotel systems create data and process gaps across front desk, revenue management, and guest communications. A business architect should treat the PMS layer as an operational backbone and design integrations so booking, guest, and payment data stay synchronized across the stack.",
  },
  {
    niche: "business-architect",
    title: "Mews highlights how hospitality platforms are shifting from siloed tools to connected operating systems",
    url: "https://www.mews.com/en/products/hotel-pms",
    source: "Mews",
    publishedAt: "2025-01-19T00:00:00.000Z",
    articleText:
      "Mews positions its property management system as a cloud platform for automating guest journeys, front-of-house operations, and payments. For software and operations leaders, that supports a broader trend: hospitality platforms are moving away from isolated tools toward unified systems that can share operational context. The business implication is that architecture decisions now affect guest experience, staff efficiency, and revenue capture at the same time.",
  },
  {
    niche: "business-architect",
    title: "Stripe Connect shows why marketplace and platform businesses need payments built into their core architecture",
    url: "https://stripe.com/connect",
    source: "Stripe",
    publishedAt: "2025-01-20T00:00:00.000Z",
    articleText:
      "Stripe Connect is designed to help platforms and marketplaces embed payments, onboarding, payouts, and financial workflows directly into their products. That matters because payment orchestration is not an edge concern for digital businesses; it influences seller activation, compliance, cash flow, and reporting. A business architect designing platform software should treat payments as a core capability that shapes the operating model, not just a checkout plugin.",
  },
  {
    niche: "developer",
    title: "TypeScript keeps tightening the feedback loop between developer intent and runtime safety",
    url: "https://www.typescriptlang.org/docs/",
    source: "TypeScript Docs",
    publishedAt: "2025-01-15T00:00:00.000Z",
    articleText:
      "The TypeScript documentation emphasizes static analysis, editor tooling, and gradual typing for JavaScript applications. For engineering teams, that matters because type systems reduce ambiguity at the boundaries between modules, services, and teams. The practical takeaway is that developer productivity and correctness improve when the codebase makes intent explicit and catches contract drift before runtime.",
  },
  {
    niche: "developer",
    title: "React documentation keeps pushing teams toward thinking in state, composition, and user-driven updates",
    url: "https://react.dev/learn",
    source: "React Docs",
    publishedAt: "2025-01-16T00:00:00.000Z",
    articleText:
      "React's learning materials focus on component composition, state transitions, and rendering logic driven by user interaction. The engineering lesson is that front-end complexity grows when teams fight the framework model instead of leaning into explicit state and predictable data flow. Teams shipping product interfaces benefit when they simplify state ownership and make component boundaries easier to reason about.",
  },
  {
    niche: "developer",
    title: "Kubernetes remains a lesson in declarative operations rather than manual environment management",
    url: "https://kubernetes.io/docs/concepts/overview/",
    source: "Kubernetes Docs",
    publishedAt: "2025-01-17T00:00:00.000Z",
    articleText:
      "Kubernetes documentation frames the platform around declarative configuration, orchestration, and reconciliation of cluster state. For platform teams, the deeper point is that operations become more reliable when desired state is explicit and repeatable instead of being enforced manually. The practical implication is that teams should design deployment and runtime workflows around declarative contracts, observability, and controlled change management.",
  },
];

export function evergreenSourcePacksFor(niche: NewsNiche): RealNewsItem[] {
  return EVERGREEN_SOURCE_PACKS
    .filter((pack) => pack.niche === niche)
    .map((pack) => ({
      title: pack.title,
      url: pack.url,
      source: pack.source,
      subreddit: "",
      score: 0,
      commentCount: 0,
      publishedAt: pack.publishedAt,
      articleText: pack.articleText,
      sourceDomain: new URL(pack.url).hostname.replace(/^www\./, "").toLowerCase(),
    }));
}
