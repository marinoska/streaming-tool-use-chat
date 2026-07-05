// ============================================================
// Mock tool implementations — DO NOT MODIFY
// ============================================================

export interface CompanyInfo {
  name: string; industry: string; employees: string;
  hq: string; description: string; founded: number;
}

export interface CompanyResearch {
  recentNews: string[]; techStack: string[];
  funding: string; competitors: string[]; hiringTrends: string;
}

export interface EmailValidation {
  email: string; is_valid: boolean; is_deliverable: boolean;
  is_catch_all: boolean; risk_score: number; reason: string;
}

export const companyDb: Record<string, CompanyInfo> = {
  'acme.com': {
    name: 'Acme Corp', industry: 'Manufacturing', employees: '500-1000',
    hq: 'San Francisco, CA', description: 'Enterprise manufacturing solutions',
    founded: 2015
  },
  'techstart.io': {
    name: 'TechStart', industry: 'SaaS', employees: '10-50',
    hq: 'Austin, TX', description: 'Developer productivity tools',
    founded: 2021
  },
  'globalbank.com': {
    name: 'Global Bank', industry: 'Finance', employees: '10000+',
    hq: 'New York, NY', description: 'International banking services',
    founded: 1985
  },
};

const researchDb: Record<string, CompanyResearch> = {
  'acme.com': {
    recentNews: [
      'Acme Corp raised $80M Series C led by Sequoia Capital',
      'Acme Corp opened new Megafactory in Berlin, Germany',
    ],
    techStack: ['Go', 'Kubernetes', 'PostgreSQL', 'AWS'],
    funding: '$80M Series C (Sequoia Capital, lead)',
    competitors: ['IndustrialOne', 'MakerWorks'],
    hiringTrends: 'Aggressively hiring across EU, 40 open roles in Germany',
  },
  'techstart.io': {
    recentNews: [
      'TechStart closed $8M Series A from a16z',
      'TechStart launched GitHub-native code review bot powered by Buildkite',
    ],
    techStack: ['TypeScript', 'Node.js', 'GitHub Actions', 'Buildkite'],
    funding: '$8M Series A (a16z, lead)',
    competitors: ['DevFlow', 'CodeStream'],
    hiringTrends: 'Hiring senior engineers focused on code review tooling, 12 open roles',
  },
  'globalbank.com': {
    recentNews: [
      'Global Bank expanded private wealth division in New York',
      'Global Bank acquired a regional retail banking network',
    ],
    techStack: ['Java', 'Spring', 'Oracle DB', 'Kafka'],
    funding: 'Publicly traded (NYSE)',
    competitors: ['MetroBank', 'CapitalTrust'],
    hiringTrends: 'Hiring in wealth management and compliance, 80+ open roles',
  },
};

export async function lookupCompany(domain: string): Promise<CompanyInfo | { error: string }> {
  await new Promise(r => setTimeout(r, 200)); // simulate latency
  return companyDb[domain] || { error: `Company not found for domain: ${domain}` };
}

export async function researchCompany(domain: string): Promise<CompanyResearch | { error: string }> {
  await new Promise(r => setTimeout(r, 500)); // simulate slower research
  return researchDb[domain] || { error: `No research data for domain: ${domain}` };
}

export async function validateEmail(email: string): Promise<EmailValidation> {
  await new Promise(r => setTimeout(r, 300)); // simulate lookup
  const domain = email.split('@')[1];
  const known = !!domain && !!companyDb[domain];
  return {
    email,
    is_valid: email.includes('@') && email.includes('.'),
    is_deliverable: known,
    is_catch_all: !known,
    risk_score: known ? 0.1 : 0.8,
    reason: known ? 'Verified domain' : 'Unknown domain, high risk'
  };
}

