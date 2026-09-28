/**
 * Copyright (c) 2026 Dr. Nitin Hiralal Sonare <sonarenitin3@gmail.com>. All Rights Reserved.
 * MedScript OPD - Clinical Calculations Engine.
 */

export interface BmiResult {
  bmi: number;
  category: 'UNDERWEIGHT' | 'NORMAL' | 'OVERWEIGHT' | 'OBESE_CLASS_1' | 'OBESE_CLASS_2';
  categoryLabel: string;
  badgeColor: string; // Tailwind color class
}

/**
 * Calculates Body Mass Index (BMI) and categorization based on Asian-Indian consensus guidelines
 * (BMI cutoffs: <18.5 Underweight, 18.5-22.9 Normal, 23-24.9 Overweight, >=25 Obese).
 */
export function calculateBmi(weightKg: number | string | null | undefined, heightCm: number | string | null | undefined): BmiResult | null {
  if (!weightKg || !heightCm) return null;

  const w = typeof weightKg === 'string' ? parseFloat(weightKg) : weightKg;
  const h = typeof heightCm === 'string' ? parseFloat(heightCm) : heightCm;

  if (isNaN(w) || isNaN(h) || w <= 0 || h <= 0) return null;

  const heightM = h / 100;
  const bmi = Math.round((w / (heightM * heightM)) * 10) / 10;

  if (bmi < 18.5) {
    return {
      bmi,
      category: 'UNDERWEIGHT',
      categoryLabel: 'Underweight',
      badgeColor: 'bg-amber-100 text-amber-800 border-amber-300',
    };
  } else if (bmi <= 22.9) {
    return {
      bmi,
      category: 'NORMAL',
      categoryLabel: 'Normal Weight',
      badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    };
  } else if (bmi <= 24.9) {
    return {
      bmi,
      category: 'OVERWEIGHT',
      categoryLabel: 'Overweight',
      badgeColor: 'bg-orange-100 text-orange-800 border-orange-300',
    };
  } else if (bmi <= 29.9) {
    return {
      bmi,
      category: 'OBESE_CLASS_1',
      categoryLabel: 'Class I Obesity',
      badgeColor: 'bg-rose-100 text-rose-800 border-rose-300',
    };
  } else {
    return {
      bmi,
      category: 'OBESE_CLASS_2',
      categoryLabel: 'Class II / Severe Obesity',
      badgeColor: 'bg-red-100 text-red-900 border-red-400 font-bold',
    };
  }
}

export interface PediatricDosageResult {
  weightKg: number;
  mgPerDose: number;
  totalMgPerDay: number;
  mlPerDose?: number;
  description: string;
}

/**
 * Calculates weight-based pediatric medication dosage.
 */
export function calculatePediatricDosage(params: {
  weightKg: number;
  doseMgPerKgPerDay: number;
  frequencyPerDay: number; // e.g. 3 for TDS, 2 for BD
  syrupConcentrationMg?: number; // e.g. 120 or 250 mg
  syrupVolumeMl?: number; // e.g. 5 mL
}): PediatricDosageResult {
  const { weightKg, doseMgPerKgPerDay, frequencyPerDay, syrupConcentrationMg, syrupVolumeMl = 5 } = params;

  const totalMgPerDay = Math.round(weightKg * doseMgPerKgPerDay * 10) / 10;
  const doses = Math.max(1, frequencyPerDay);
  const mgPerDose = Math.round((totalMgPerDay / doses) * 10) / 10;

  let mlPerDose: number | undefined;
  if (syrupConcentrationMg && syrupConcentrationMg > 0) {
    const rawMl = (mgPerDose * syrupVolumeMl) / syrupConcentrationMg;
    mlPerDose = Math.round(rawMl * 10) / 10;
  }

  const desc = mlPerDose
    ? `${mlPerDose} mL (${mgPerDose} mg) ${doses} times daily`
    : `${mgPerDose} mg ${doses} times daily`;

  return {
    weightKg,
    mgPerDose,
    totalMgPerDay,
    mlPerDose,
    description: desc,
  };
}

/**
 * Calculates estimated Creatinine Clearance (Cockcroft-Gault formula)
 * CrCl (mL/min) = [(140 - Age) * Weight(kg) * (0.85 if female)] / (72 * Serum Creatinine mg/dL)
 */
export function calculateCrCl(params: {
  ageYears: number;
  weightKg: number;
  serumCreatinineMgDl: number;
  gender: 'Male' | 'Female' | string;
}): { crCl: number; staging: string; isImpaired: boolean } | null {
  const { ageYears, weightKg, serumCreatinineMgDl, gender } = params;
  if (ageYears <= 0 || weightKg <= 0 || serumCreatinineMgDl <= 0) return null;

  const factor = gender.toLowerCase().startsWith('f') ? 0.85 : 1.0;
  const rawCrCl = ((140 - ageYears) * weightKg * factor) / (72 * serumCreatinineMgDl);
  const crCl = Math.round(rawCrCl * 10) / 10;

  let staging = 'Normal Renal Function (CrCl > 90 mL/min)';
  let isImpaired = false;

  if (crCl < 15) {
    staging = 'Kidney Failure (Stage 5 CKD, CrCl < 15 mL/min) - High Toxicity Risk';
    isImpaired = true;
  } else if (crCl < 30) {
    staging = 'Severe Renal Impairment (CrCl 15-29 mL/min) - Significant Dose Reduction Required';
    isImpaired = true;
  } else if (crCl < 60) {
    staging = 'Moderate Renal Impairment (CrCl 30-59 mL/min) - Monitor & Adjust Renally Excreted Drugs';
    isImpaired = true;
  } else if (crCl < 90) {
    staging = 'Mild Renal Impairment (CrCl 60-89 mL/min)';
  }

  return { crCl, staging, isImpaired };
}
