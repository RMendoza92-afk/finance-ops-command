// Executive Review classification - hybrid of age, stage, duration, and complexity
export type ExecutiveReviewLevel = 'NONE' | 'WATCH' | 'REQUIRED' | 'CRITICAL';

export interface ExecutiveReviewResult {
  level: ExecutiveReviewLevel;
  reasons: string[];
  score: number;
}

// Estimate claim age from prefix (lower prefixes = older claims)
export function estimateClaimAge(prefix: string): number {
  const currentYear = 2025;
  
  const prefixNum = parseInt(prefix);
  if (isNaN(prefixNum)) return 0;
  
  if (prefixNum <= 39) return currentYear - 2017; // ~8 years
  if (prefixNum <= 55) return currentYear - 2018; // ~7 years  
  if (prefixNum <= 65) return currentYear - 2019; // ~6 years
  if (prefixNum <= 70) return currentYear - 2020; // ~5 years
  if (prefixNum <= 72) return currentYear - 2021; // ~4 years
  if (prefixNum <= 78) return currentYear - 2022; // ~3 years
  if (prefixNum <= 89) return currentYear - 2023; // ~2 years
  return currentYear - 2024; // ~1 year
}

// HYBRID EXECUTIVE REVIEW CLASSIFICATION
// Combines: 1) Age, 2) Stage mismatch, 3) Duration drift, 4) Complexity markers
export function calculateExecutiveReview(
  claimAge: number,
  litigationStage: 'Early' | 'Mid' | 'Late' | 'Very Late',
  expertSpend: number,
  reactiveSpend: number,
  painEscalation: number,
  maxPain: number,
  expCategory: string
): ExecutiveReviewResult {
  let score = 0;
  const reasons: string[] = [];
  
  // 1. AGE-BASED FLAGS (claims >3 years = concern, >5 years = serious)
  if (claimAge >= 7) {
    score += 40;
    reasons.push(`${claimAge}yr old claim - requires closure strategy`);
  } else if (claimAge >= 5) {
    score += 25;
    reasons.push(`${claimAge}yr in litigation - duration drift`);
  } else if (claimAge >= 3) {
    score += 10;
    reasons.push(`${claimAge}yr litigation cycle`);
  }
  
  // 2. STAGE MISMATCH - Late/Very Late with no expert strategy
  if ((litigationStage === 'Late' || litigationStage === 'Very Late') && expertSpend === 0) {
    score += 20;
    reasons.push(`${litigationStage} stage with $0 expert spend`);
  }
  
  // 3. HIGH REACTIVE with low expert = reactive posture
  if (reactiveSpend > 10000 && expertSpend === 0) {
    score += 15;
    reasons.push(`$${(reactiveSpend/1000).toFixed(0)}K reactive, no expert strategy`);
  }
  
  // 4. PAIN ESCALATION - significant increase indicates deterioration
  if (painEscalation >= 4) {
    score += 20;
    reasons.push(`Pain escalated ${painEscalation}+ levels`);
  } else if (painEscalation >= 2) {
    score += 10;
    reasons.push(`Pain increased ${painEscalation} levels`);
  }
  
  // 5. HIGH PAIN CEILING - near max exposure
  if (maxPain >= 9) {
    score += 15;
    reasons.push(`Pain level ${maxPain}/10 - max exposure`);
  } else if (maxPain >= 8) {
    score += 10;
    reasons.push(`Pain level ${maxPain}/10`);
  }
  
  // 6. COMPLEXITY MARKERS - L3L (large loss), trustee, complex litigation patterns
  const catUpper = (expCategory || '').toUpperCase();
  if (catUpper.includes('L3L') || catUpper.includes('LIM') || catUpper.includes('LARGE')) {
    score += 15;
    reasons.push('Large loss / complex matter');
  }
  
  // CLASSIFICATION
  let level: ExecutiveReviewLevel = 'NONE';
  if (score >= 50) {
    level = 'CRITICAL';
  } else if (score >= 30) {
    level = 'REQUIRED';
  } else if (score >= 15) {
    level = 'WATCH';
  }
  
  return { level, reasons, score };
}

// Helper to get litigation stage
export function getLitigationStage(painLvl: number): 'Early' | 'Mid' | 'Late' | 'Very Late' {
  if (painLvl <= 2) return 'Early';
  if (painLvl <= 5) return 'Mid';
  if (painLvl <= 7) return 'Late';
  return 'Very Late';
}

// Helper to get expert type from expense category
export function getExpertType(expCategory: string): string {
  if (!expCategory) return 'Other';
  const cat = expCategory.toUpperCase();
  if (cat.includes('MEDICAL') || cat.includes('MED')) return 'Medical';
  if (cat.includes('LEGAL') || cat.includes('ATTORNEY')) return 'Legal';
  if (cat.includes('EXPERT') || cat.includes('CONSULT')) return 'Consultant';
  if (cat.includes('ENGINEER')) return 'Engineering';
  if (cat.includes('ACCOUNT') || cat.includes('ECON')) return 'Economic';
  return 'Other';
}