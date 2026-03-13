export type NewsNiche = 'business-architect' | 'developer';

export interface NicheProfile {
  subreddits: string[];
  googleNewsQueries: string[];
  newsApiQueries: string[];
  keywords: string[];
}

const NICHES: Record<NewsNiche, NicheProfile> = {
  'business-architect': {
    subreddits: [
      'ecommerce',
      'shopify',
      'AmazonSeller',
      'entrepreneur',
      'startups',
      'healthIT',
      'digitalhealth',
      'HealthcareAnalytics',
      'hospitality',
      'hotel',
      'softwarearchitecture',
    ],
    googleNewsQueries: [
      'ecommerce software technology retail digital transformation',
      'healthcare technology digital health software hospital',
      'hospitality technology hotel software guest experience',
      'software architecture SaaS platform business automation',
    ],
    newsApiQueries: [
      'ecommerce software OR retail technology OR online store platform',
      'healthcare technology OR health IT OR digital health software',
      'hospitality technology OR hotel software OR travel tech',
      'SaaS platform OR business software OR digital transformation',
    ],
    keywords: [
      // Ecommerce
      'ecommerce', 'e-commerce', 'retail', 'shopify', 'amazon', 'marketplace',
      'checkout', 'payment', 'cart', 'online store', 'online shopping', 'merchant',
      'fulfillment', 'inventory',
      // Healthcare
      'healthcare', 'health tech', 'healthtech', 'hospital', 'patient', 'medical',
      'ehr', 'telemedicine', 'pharma', 'clinical', 'digital health', 'health it',
      'interoperability',
      // Hospitality
      'hospitality', 'hotel', 'restaurant', 'booking', 'reservation', 'travel tech',
      'property management', 'pms', 'guest experience',
      // Cross-vertical
      'software', 'platform', 'automation', 'saas', 'digital transformation',
      'technology', 'ai', 'integration', 'efficiency', 'roi', 'revenue', 'cost reduction',
    ],
  },

  developer: {
    subreddits: [
      'programming', 'softwarearchitecture', 'webdev', 'javascript', 'typescript',
      'reactjs', 'nextjs', 'node', 'devops', 'aws', 'machinelearning', 'artificial',
      'LocalLLaMA', 'experienceddevs',
    ],
    googleNewsQueries: [
      'TypeScript OR JavaScript OR Python release update framework',
      'AI agents OR LLM developer tools OR coding assistant open source',
      'React OR Next.js OR Node.js OR Vite OR Angular release',
      'AWS OR Kubernetes OR Docker OR DevOps engineering update',
    ],
    newsApiQueries: [
      'TypeScript OR JavaScript OR Python OR Rust OR Go framework release',
      'AI agents OR LLM tooling OR developer productivity OR coding assistant',
      'React OR Next.js OR Node.js OR web framework update',
      'Kubernetes OR Docker OR AWS OR DevOps OR platform engineering',
    ],
    keywords: [
      'typescript', 'javascript', 'python', 'rust', 'golang', 'go ', 'java', 'node',
      'react', 'next.js', 'nextjs', 'vue', 'angular', 'svelte', 'spring', 'django',
      'laravel', 'vite', 'llm', 'agent', 'agents', 'ai', 'model', 'inference',
      'prompt', 'copilot', 'rag', 'developer tool', 'devtools', 'sdk', 'api',
      'open source', 'github', 'release', 'changelog', 'framework', 'runtime',
      'architecture', 'performance', 'scalability', 'benchmark', 'security', 'cve',
      'devops', 'kubernetes', 'docker', 'aws', 'gcp', 'azure', 'serverless',
      'platform engineering', 'ci/cd', 'software',
    ],
  },
};

export function resolveNiche(niche: string = 'business-architect'): NicheProfile {
  return NICHES[niche as NewsNiche] ?? NICHES['business-architect'];
}
