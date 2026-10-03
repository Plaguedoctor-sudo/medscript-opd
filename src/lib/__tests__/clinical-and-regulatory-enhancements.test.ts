import { describe, it, expect, beforeEach } from 'vitest';
import {
  calculatePediatricGrowthMetrics,
  zScoreToPercentile,
  getGrowthReferenceCurves,
} from '@/lib/pediatrics/growth-charts';
import {
  generateChildImmunizationSchedule,
  IAP_RECOMMENDED_VACCINES,
} from '@/lib/pediatrics/immunization-schedule';
import {
  isScheduleH1Drug,
  computeScheduleH1Seal,
  recordScheduleH1Dispensation,
  getLowStockAlerts,
} from '@/lib/pharmacy/schedule-h1';
import {
  getHospitalWards,
  getHospitalBeds,
  updateBedStatus,
} from '@/lib/ipd/bed-management';
import {
  computePacSeal,
  recordWhoSurgicalChecklist,
} from '@/lib/ot/surgical-checklist';
import {
  recordCrashCartAudit,
  getRecentCrashCartAudits,
} from '@/lib/emergency/crash-cart';
import {
  computeHealthcareGst,
} from '@/lib/billing/gst-calculator';
import {
  generateDynamicUpiQr,
} from '@/lib/billing/upi-qr-generator';
import {
  computeReferralSeal,
  verifyReferralSeal,
} from '@/lib/clinical/referral-letter';
import { sqlite } from '@/db';

describe('Clinical, Statutory & Hospital Operational Systems', () => {
  describe('WHO Pediatric Growth Standards & Z-Scores', () => {
    it('calculates accurate Z-scores and percentiles for a normal 12-month male infant', () => {
      // Median 12mo boy weight ~9.6kg, height ~75.7cm
      const metrics = calculatePediatricGrowthMetrics('Male', 12, 9.6, 75.7);

      expect(metrics.weightForAgeZScore).toBeCloseTo(0, 1);
      expect(metrics.heightForAgeZScore).toBeCloseTo(0, 1);
      expect(metrics.percentileWeight).toBeCloseTo(50, 5);
      expect(metrics.percentileHeight).toBeCloseTo(50, 5);
      expect(metrics.clinicalAssessment.weightStatus).toBe('Normal');
      expect(metrics.clinicalAssessment.heightStatus).toBe('Normal');
    });

    it('detects severe underweight when Z-score < -3', () => {
      // 12mo boy at 6.0kg (normal is 9.6kg, SD is 1.0kg) -> Z ~ -3.6
      const metrics = calculatePediatricGrowthMetrics('Male', 12, 6.0, 75.7);

      expect(metrics.weightForAgeZScore).toBeLessThan(-3);
      expect(metrics.clinicalAssessment.weightStatus).toBe('Severely Underweight');
      expect(metrics.percentileWeight).toBeLessThan(1);
    });

    it('converts Z-scores to normal cumulative percentiles symmetrically', () => {
      expect(zScoreToPercentile(0)).toBeCloseTo(50, 1);
      expect(zScoreToPercentile(1.96)).toBeCloseTo(97.5, 1);
      expect(zScoreToPercentile(-1.96)).toBeCloseTo(2.5, 1);
    });

    it('generates smooth reference curves for visual chart rendering', () => {
      const weightCurves = getGrowthReferenceCurves('Male', 'weight');
      expect(weightCurves.length).toBeGreaterThan(5);
      expect(weightCurves[0].minus2SD).toBeLessThan(weightCurves[0].median);
      expect(weightCurves[0].median).toBeLessThan(weightCurves[0].plus2SD);
    });
  });

  describe('IAP Child Immunization Timetable', () => {
    it('generates full scheduled timetable from birth date', () => {
      const birth = new Date('2026-01-01T00:00:00Z');
      const schedule = generateChildImmunizationSchedule(birth);

      expect(schedule.length).toBe(IAP_RECOMMENDED_VACCINES.length);
      // Birth dose checks
      const bcg = schedule.find((v) => v.vaccineCode === 'BCG');
      expect(bcg).toBeDefined();
      expect(bcg?.dueAgeMonths).toBe(0);

      // 6-week dose checks
      const dtwp1 = schedule.find((v) => v.vaccineCode === 'DTP-1');
      expect(dtwp1).toBeDefined();
      expect(dtwp1?.dueAgeMonths).toBe(1.5);
      expect(dtwp1?.route).toBe('Intramuscular (IM)');
    });
  });

  describe('Statutory Schedule H1 & Narcotics Register', () => {
    it('identifies Schedule H1 regulated antibiotics and narcotics', () => {
      expect(isScheduleH1Drug('Cefixime 200mg')).toBe(true);
      expect(isScheduleH1Drug('Alprazolam 0.5mg')).toBe(true);
      expect(isScheduleH1Drug('Meropenem 1g IV')).toBe(true);
      expect(isScheduleH1Drug('Tramadol Hydrochloride')).toBe(true);
      expect(isScheduleH1Drug('Paracetamol 650mg')).toBe(false);
      expect(isScheduleH1Drug('Vitamin C')).toBe(false);
    });

    it('computes deterministic digital seal for Schedule H1 dispensation', () => {
      const rec = {
        dispenseDate: new Date('2026-10-01T10:00:00Z'),
        patientName: 'Ramesh Patel',
        patientContact: '9876543210',
        prescribingDoctorRegNo: 'MCI-99482',
        drugName: 'Cefixime 200mg',
        batchNumber: 'B-8821',
        quantityDispensed: 10,
        dispensedByPharmacist: 'Pharmacist Sunita',
      };

      const seal1 = computeScheduleH1Seal(rec);
      const seal2 = computeScheduleH1Seal(rec);
      expect(seal1).toBe(seal2);
      expect(seal1).toHaveLength(64);
    });

    it('records Schedule H1 dispensation into SQLite ledger', () => {
      const id = recordScheduleH1Dispensation({
        dispenseDate: new Date(),
        patientName: 'Kavita Sharma',
        patientContact: '9988776655',
        prescribingDoctorName: 'Dr. Nitin Sonare',
        prescribingDoctorRegNo: 'MCI-12345',
        drugName: 'Alprazolam 0.25mg',
        batchNumber: 'ALP-902',
        expiryDate: '2028-06',
        quantityDispensed: 15,
        unit: 'TABLETS',
        dispensedByPharmacist: 'Priya Pharmacist',
      });

      expect(id).toBeGreaterThan(0);
      const row = sqlite.prepare('SELECT * FROM schedule_h1_register WHERE id = ?').get(id) as any;
      expect(row.patient_name).toBe('Kavita Sharma');
      expect(row.verified_seal).toBeDefined();

      // Clean up
      sqlite.prepare('DELETE FROM schedule_h1_register WHERE id = ?').run(id);
    });
  });

  describe('Hospital Wards & Visual Bed Occupancy Management', () => {
    it('retrieves seeded wards and calculated live occupancy', () => {
      const wards = getHospitalWards();
      expect(wards.length).toBeGreaterThanOrEqual(1);

      const icuWard = wards.find((w) => w.type === 'ICU');
      expect(icuWard).toBeDefined();
      expect(icuWard?.totalBeds).toBeGreaterThanOrEqual(4);
    });

    it('updates bed status dynamically and reflects in query', () => {
      const beds = getHospitalBeds();
      expect(beds.length).toBeGreaterThan(0);

      const targetBed = beds[0];
      const origStatus = targetBed.status;

      updateBedStatus(targetBed.id, 'CLEANING');
      const updatedBeds = getHospitalBeds();
      const updated = updatedBeds.find((b) => b.id === targetBed.id);
      expect(updated?.status).toBe('CLEANING');

      // Revert
      updateBedStatus(targetBed.id, origStatus);
    });
  });

  describe('WHO Surgical Safety & PAC Evaluation', () => {
    it('computes deterministic HMAC seal for Pre-Anesthesia Checkup', () => {
      const seal = computePacSeal({
        admissionId: 101,
        patientId: 202,
        asaClass: 'ASA_II',
        mallampatiScore: 2,
        fitnessStatus: 'FIT',
        anesthesiologistName: 'Dr. Rao',
      });

      expect(seal).toHaveLength(64);
    });
  });

  describe('NABH Emergency Crash Cart Audits', () => {
    it('records and retrieves emergency crash cart inspection', () => {
      const id = recordCrashCartAudit({
        auditDate: new Date(),
        shift: 'MORNING',
        cartLocation: 'ICU',
        sealNumber: 'SEAL-2026-991',
        sealIntact: true,
        defibrillatorTestPassed: true,
        laryngoscopeBladesTested: true,
        suctionMachineTested: true,
        oxygenCylinderPressurePsi: 2100,
        ambubagTested: true,
        expiredDrugsFound: false,
        auditedByNurse: 'Sister Priya Nair',
        status: 'VERIFIED_READY',
      });

      expect(id).toBeGreaterThan(0);
      const audits = getRecentCrashCartAudits(5);
      const created = audits.find((a) => a.id === id);
      expect(created?.cartLocation).toBe('ICU');
      expect(created?.defibrillatorTestPassed).toBe(true);

      // Clean up
      sqlite.prepare('DELETE FROM crash_cart_audits WHERE id = ?').run(id);
    });
  });

  describe('Healthcare GST & Dynamic UPI Payments', () => {
    it('exempts OPD consultations and low room rent while applying 5% on room rent > 5,000', () => {
      const items = [
        { description: 'Dr. Consultation OPD', category: 'OPD_CONSULTATION' as const, amount: 800 },
        { description: 'General Ward Stay 2 Days', category: 'ROOM_RENT' as const, amount: 4000, ratePerDay: 2000 },
        { description: 'Super Deluxe Suite 1 Day', category: 'ROOM_RENT' as const, amount: 7500, ratePerDay: 7500 }, // > 5,000 attracts 5% GST
        { description: 'ICU Bed 1 Day', category: 'ICU_BED' as const, amount: 6500, ratePerDay: 6500 }, // ICU is exempt
      ];

      const res = computeHealthcareGst(items);
      expect(res.subtotal).toBe(18800);
      // Only the Super Deluxe Suite (7,500 * 5% = 375) should attract GST
      expect(res.totalGst).toBe(375);
      expect(res.grandTotal).toBe(19175);
    });

    it('generates dynamic Bharat UPI QR with valid VPA and amount', async () => {
      const upi = await generateDynamicUpiQr({
        vpa: 'medscript.hospital@upi',
        merchantName: 'MedScript Hospital',
        amount: 1500.00,
        transactionRef: 'TXN-994821',
      });

      expect(upi.vpa).toBe('medscript.hospital@upi');
      expect(upi.amount).toBe(1500.00);
      expect(upi.qrPayload).toContain('data:image/png;base64');
    });
  });

  describe('Specialist Referral Letters & Tamper-Evident Seals', () => {
    it('generates and verifies digital seal for tertiary specialist referrals', () => {
      const ref = {
        patientId: 55,
        patientName: 'Anil Kumar',
        patientAgeGender: '52/Male',
        referralDate: new Date('2026-10-02T10:00:00Z'),
        urgency: 'URGENT' as const,
        referringDoctorName: 'Dr. Nitin Sonare',
        referringDoctorRegNo: 'MCI-994821',
        targetSpecialty: 'Oncology',
        targetHospitalOrDoctor: 'Tata Memorial Hospital',
        provisionalDiagnosis: 'Colonic adenocarcinoma',
        clinicalSummary: 'Weight loss, altered bowel habits, positive FOBT.',
        vitalSigns: 'BP: 130/80',
        currentMedications: 'None',
        relevantInvestigations: 'Colonoscopy biopsy pending',
        reasonForReferral: 'Staging PET-CT and surgical oncology evaluation.',
      };

      const seal = computeReferralSeal(ref);
      const letter = { ...ref, digitalSeal: seal };

      expect(verifyReferralSeal(letter)).toBe(true);

      // Tampering fails verification
      const tampered = { ...letter, targetSpecialty: 'General Medicine' };
      expect(verifyReferralSeal(tampered)).toBe(false);
    });
  });
});
