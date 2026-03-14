export type NewsNiche = 'business-architect' | 'developer';

export interface NicheProfile {
  name: NewsNiche;
  subreddits: string[];
  googleNewsQueries: string[];
  newsApiQueries: string[];
  devToTags: string[];
  keywords: string[];
  allowCommunitySources: boolean;
}

const NICHES: Record<NewsNiche, NicheProfile> = {
  'business-architect': {
    name: 'business-architect',
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
      'ecommerce software platform retail technology integration',
      'healthcare software digital health EHR hospital technology',
      'hospitality software hotel technology PMS guest experience',
    ],
    newsApiQueries: [
      'ecommerce software OR retail platform OR online store technology',
      'healthcare software OR health IT OR EHR OR digital health hospital',
      'hospitality software OR hotel technology OR PMS OR booking platform',
    ],
    devToTags: ['shopify', 'ecommerce', 'saas', 'healthtech', 'api'],
    keywords: [
      // Ecommerce — specific to software/platform in this space
      'ecommerce', 'e-commerce', 'shopify', 'woocommerce', 'magento', 'marketplace',
      'checkout', 'payment gateway', 'cart', 'online store', 'merchant platform',
      'fulfillment software', 'inventory management', 'retail software', 'pos system',
      'order management',
      // Healthcare — specific to software/platform in this space
      'healthcare software', 'health tech', 'healthtech', 'ehr', 'emr',
      'telemedicine', 'clinical software', 'digital health', 'health it',
      'patient portal', 'medical software', 'hospital software', 'practice management',
      'interoperability', 'health data',
      // Hospitality — specific to software/platform in this space
      'hospitality software', 'hotel software', 'hotel technology', 'restaurant software',
      'booking software', 'reservation system', 'travel tech', 'property management system',
      'pms software', 'guest experience software', 'hotel pms', 'channel manager',
      // Software architecture signals (must co-occur with vertical terms to score high)
      'custom software', 'software integration', 'api integration', 'software platform',
      'saas solution', 'cloud software', 'software architecture',
    ],
    allowCommunitySources: false,
  },

  developer: {
    name: 'developer',
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
    devToTags: ['javascript', 'typescript', 'python', 'webdev', 'devops', 'aws', 'ai'],
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
    allowCommunitySources: true,
  },
};

export function resolveNiche(niche: string = 'business-architect'): NicheProfile {
  return NICHES[niche as NewsNiche] ?? NICHES['business-architect'];
}
