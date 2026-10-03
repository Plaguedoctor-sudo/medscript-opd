/**
 * Pediatric Growth Standards & WHO Z-Score Calculation Engine
 * Based on World Health Organization (WHO) Child Growth Standards (0-5 years)
 * and Indian Academy of Pediatrics (IAP) Growth Curves.
 */

export interface GrowthMetricsResult {
  bmi: number;
  weightForAgeZScore: number;
  heightForAgeZScore: number;
  bmiForAgeZScore: number;
  percentileWeight: number;
  percentileHeight: number;
  percentileBmi: number;
  clinicalAssessment: {
    weightStatus: 'Severely Underweight' | 'Underweight' | 'Normal' | 'Overweight' | 'Obese';
    heightStatus: 'Severely Stunted' | 'Stunted' | 'Normal' | 'Tall';
    bmiStatus: 'Severe Wasting' | 'Wasting' | 'Normal' | 'Overweight' | 'Obese';
  };
}

// Approximate WHO Child Growth Standards (Median & Standard Deviation) for key age points (0 to 60 months)
// Boys: [AgeMonths, MedianWeightKg, SDWeight, MedianHeightCm, SDHeight]
const WHO_BOYS_TABLE: Record<number, { wM: number; wSD: number; hM: number; hSD: number }> = {
  0:  { wM: 3.3, wSD: 0.5, hM: 49.9, hSD: 1.9 },
  1:  { wM: 4.5, wSD: 0.6, hM: 54.7, hSD: 2.0 },
  2:  { wM: 5.6, wSD: 0.7, hM: 58.4, hSD: 2.1 },
  3:  { wM: 6.4, wSD: 0.8, hM: 61.4, hSD: 2.2 },
  6:  { wM: 7.9, wSD: 0.9, hM: 67.6, hSD: 2.3 },
  9:  { wM: 8.9, wSD: 1.0, hM: 72.0, hSD: 2.4 },
  12: { wM: 9.6, wSD: 1.0, hM: 75.7, hSD: 2.5 },
  18: { wM: 10.9, wSD: 1.1, hM: 82.3, hSD: 2.7 },
  24: { wM: 12.2, wSD: 1.3, hM: 87.8, hSD: 3.0 },
  36: { wM: 14.3, wSD: 1.6, hM: 96.1, hSD: 3.5 },
  48: { wM: 16.3, wSD: 1.9, hM: 103.3, hSD: 3.8 },
  60: { wM: 18.3, wSD: 2.3, hM: 110.0, hSD: 4.2 },
};

// Girls: [AgeMonths, MedianWeightKg, SDWeight, MedianHeightCm, SDHeight]
const WHO_GIRLS_TABLE: Record<number, { wM: number; wSD: number; hM: number; hSD: number }> = {
  0:  { wM: 3.2, wSD: 0.5, hM: 49.1, hSD: 1.9 },
  1:  { wM: 4.2, wSD: 0.5, hM: 53.7, hSD: 1.9 },
  2:  { wM: 5.1, wSD: 0.6, hM: 57.1, hSD: 2.0 },
  3:  { wM: 5.8, wSD: 0.7, hM: 59.8, hSD: 2.1 },
  6:  { wM: 7.3, wSD: 0.8, hM: 65.7, hSD: 2.2 },
  9:  { wM: 8.2, wSD: 0.9, hM: 70.1, hSD: 2.3 },
  12: { wM: 8.9, wSD: 1.0, hM: 74.0, hSD: 2.4 },
  18: { wM: 10.2, wSD: 1.1, hM: 80.7, hSD: 2.7 },
  24: { wM: 11.5, wSD: 1.3, hM: 86.4, hSD: 3.0 },
  36: { wM: 13.9, wSD: 1.6, hM: 95.1, hSD: 3.4 },
  48: { wM: 16.1, wSD: 2.0, hM: 102.7, hSD: 3.8 },
  60: { wM: 18.2, wSD: 2.4, hM: 109.4, hSD: 4.1 },
};

/**
 * Finds closest reference age bracket or linearly interpolates standards.
 */
function getWhoStandards(gender: 'Male' | 'Female' | 'Other', ageMonths: number) {
  const table = gender === 'Female' ? WHO_GIRLS_TABLE : WHO_BOYS_TABLE;
  const ages = Object.keys(table).map(Number).sort((a, b) => a - b);

  if (ageMonths <= ages[0]) return table[ages[0]];
  if (ageMonths >= ages[ages.length - 1]) return table[ages[ages.length - 1]];

  let lower = ages[0];
  let upper = ages[1];

  for (let i = 0; i < ages.length - 1; i++) {
    if (ageMonths >= ages[i] && ageMonths <= ages[i + 1]) {
      lower = ages[i];
      upper = ages[i + 1];
      break;
    }
  }

  const fraction = (ageMonths - lower) / (upper - lower);
  const stdLower = table[lower];
  const stdUpper = table[upper];

  return {
    wM: stdLower.wM + fraction * (stdUpper.wM - stdLower.wM),
    wSD: stdLower.wSD + fraction * (stdUpper.wSD - stdLower.wSD),
    hM: stdLower.hM + fraction * (stdUpper.hM - stdLower.hM),
    hSD: stdLower.hSD + fraction * (stdUpper.hSD - stdLower.hSD),
  };
}

/**
 * Converts Z-score to Cumulative Standard Normal Percentile (0 to 100).
 */
export function zScoreToPercentile(z: number): number {
  if (z < -4) return 0.1;
  if (z > 4) return 99.9;

  // Approximation of Error Function erf(x / sqrt(2))
  const sign = z < 0 ? -1 : 1;
  const x = Math.abs(z) / Math.SQRT2;
  const t = 1.0 / (1.0 + 0.3275911 * x);
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const erf = 1.0 - (((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t) * Math.exp(-x * x);
  const cdf = 0.5 * (1.0 + sign * erf);

  return Math.round(cdf * 1000) / 10;
}

/**
 * Calculates Pediatric Growth Z-Scores, Percentiles and WHO Clinical Assessment.
 */
export function calculatePediatricGrowthMetrics(
  gender: 'Male' | 'Female' | 'Other',
  ageMonths: number,
  weightKg: number,
  heightCm: number
): GrowthMetricsResult {
  const heightM = heightCm / 100;
  const bmi = heightM > 0 ? Math.round((weightKg / (heightM * heightM)) * 10) / 10 : 0;

  const std = getWhoStandards(gender, ageMonths);

  // Z = (Observed - Median) / SD
  const weightZ = std.wSD > 0 ? (weightKg - std.wM) / std.wSD : 0;
  const heightZ = std.hSD > 0 ? (heightCm - std.hM) / std.hSD : 0;

  // Approximate BMI standard median: 15.3, SD: 1.2 for children
  const bmiZ = (bmi - 15.3) / 1.2;

  const roundZ = (v: number) => Math.round(v * 100) / 100;

  const pWeight = zScoreToPercentile(weightZ);
  const pHeight = zScoreToPercentile(heightZ);
  const pBmi = zScoreToPercentile(bmiZ);

  // WHO Growth Interpretations
  let weightStatus: GrowthMetricsResult['clinicalAssessment']['weightStatus'] = 'Normal';
  if (weightZ < -3) weightStatus = 'Severely Underweight';
  else if (weightZ < -2) weightStatus = 'Underweight';
  else if (weightZ > 2) weightStatus = 'Obese';
  else if (weightZ > 1) weightStatus = 'Overweight';

  let heightStatus: GrowthMetricsResult['clinicalAssessment']['heightStatus'] = 'Normal';
  if (heightZ < -3) heightStatus = 'Severely Stunted';
  else if (heightZ < -2) heightStatus = 'Stunted';
  else if (heightZ > 2) heightStatus = 'Tall';

  let bmiStatus: GrowthMetricsResult['clinicalAssessment']['bmiStatus'] = 'Normal';
  if (bmiZ < -3) bmiStatus = 'Severe Wasting';
  else if (bmiZ < -2) bmiStatus = 'Wasting';
  else if (bmiZ > 2) bmiStatus = 'Obese';
  else if (bmiZ > 1) bmiStatus = 'Overweight';

  return {
    bmi,
    weightForAgeZScore: roundZ(weightZ),
    heightForAgeZScore: roundZ(heightZ),
    bmiForAgeZScore: roundZ(bmiZ),
    percentileWeight: pWeight,
    percentileHeight: pHeight,
    percentileBmi: pBmi,
    clinicalAssessment: {
      weightStatus,
      heightStatus,
      bmiStatus,
    },
  };
}

/**
 * Returns reference growth curves for visual SVG chart rendering.
 */
export function getGrowthReferenceCurves(gender: 'Male' | 'Female' | 'Other', metric: 'weight' | 'height') {
  const table = gender === 'Female' ? WHO_GIRLS_TABLE : WHO_BOYS_TABLE;
  const ages = Object.keys(table).map(Number).sort((a, b) => a - b);

  return ages.map((age) => {
    const entry = table[age];
    if (metric === 'weight') {
      return {
        ageMonths: age,
        minus2SD: Math.round((entry.wM - 2 * entry.wSD) * 10) / 10,
        median: entry.wM,
        plus2SD: Math.round((entry.wM + 2 * entry.wSD) * 10) / 10,
      };
    } else {
      return {
        ageMonths: age,
        minus2SD: Math.round((entry.hM - 2 * entry.hSD) * 10) / 10,
        median: entry.hM,
        plus2SD: Math.round((entry.hM + 2 * entry.hSD) * 10) / 10,
      };
    }
  });
}
