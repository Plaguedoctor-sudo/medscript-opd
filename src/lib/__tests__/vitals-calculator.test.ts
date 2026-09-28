import { describe, it, expect } from 'vitest';
import { calculateBmi, calculatePediatricDosage, calculateCrCl } from '../vitals-calculator';

describe('Vitals & Clinical Calculations', () => {
  describe('BMI Calculator', () => {
    it('returns null for missing or invalid inputs', () => {
      expect(calculateBmi(null, null)).toBeNull();
      expect(calculateBmi(0, 170)).toBeNull();
      expect(calculateBmi(70, 0)).toBeNull();
      expect(calculateBmi('invalid', '170')).toBeNull();
    });

    it('accurately calculates normal weight BMI', () => {
      // 60kg, 165cm -> 60 / (1.65^2) = 22.03 -> 22.0
      const res = calculateBmi(60, 165);
      expect(res).not.toBeNull();
      expect(res?.bmi).toBe(22.0);
      expect(res?.category).toBe('NORMAL');
    });

    it('detects underweight, overweight, and obesity classes', () => {
      expect(calculateBmi(40, 165)?.category).toBe('UNDERWEIGHT');
      expect(calculateBmi(65, 165)?.category).toBe('OVERWEIGHT');
      expect(calculateBmi(75, 165)?.category).toBe('OBESE_CLASS_1');
      expect(calculateBmi(95, 165)?.category).toBe('OBESE_CLASS_2');
    });
  });

  describe('Pediatric Dosage Calculator', () => {
    it('computes daily and single dose requirements', () => {
      // 10kg child, 15 mg/kg/day, divided 3 times (TDS)
      const res = calculatePediatricDosage({
        weightKg: 10,
        doseMgPerKgPerDay: 15,
        frequencyPerDay: 3,
        syrupConcentrationMg: 125,
        syrupVolumeMl: 5,
      });

      expect(res.totalMgPerDay).toBe(150);
      expect(res.mgPerDose).toBe(50);
      // 50 mg in 125mg/5mL syrup -> (50 * 5) / 125 = 2.0 mL
      expect(res.mlPerDose).toBe(2.0);
      expect(res.description).toContain('2 mL (50 mg) 3 times daily');
    });
  });

  describe('Renal Cockcroft-Gault CrCl Calculator', () => {
    it('calculates creatinine clearance accurately', () => {
      // 60yo male, 70kg, Cr 1.0 mg/dL -> (140 - 60) * 70 * 1 / (72 * 1) = 5600 / 72 = 77.8 mL/min
      const resMale = calculateCrCl({
        ageYears: 60,
        weightKg: 70,
        serumCreatinineMgDl: 1.0,
        gender: 'Male',
      });
      expect(resMale).not.toBeNull();
      expect(resMale?.crCl).toBe(77.8);
      expect(resMale?.isImpaired).toBe(false);

      // Severe renal impairment check (15-29 mL/min)
      const resSevere = calculateCrCl({
        ageYears: 70,
        weightKg: 50,
        serumCreatinineMgDl: 2.0,
        gender: 'Female',
      });
      expect(resSevere).not.toBeNull();
      expect(resSevere?.isImpaired).toBe(true);
      expect(resSevere?.staging).toContain('Severe Renal Impairment');
    });
  });
});
