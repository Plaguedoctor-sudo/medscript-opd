import { describe, it, expect } from 'vitest';
import {
  calculateLengthOfStayDays,
  resolveBedTariff,
  resolveServiceFee,
  resolveLabFee,
  calculateNetDeposits,
  calculateIpdBillBreakdown,
  DEFAULT_DAILY_NURSING_CARE,
  DEFAULT_DOCTOR_ROUND_RATE,
} from '../ipd-billing';
import { IpdDeposit, IpdClinicalService, LabReport, IpdRound } from '@/types';

describe('IPD Billing Calculation Engine', () => {
  describe('calculateLengthOfStayDays', () => {
    it('returns at least 1 day for same-day admission and discharge', () => {
      const now = new Date('2026-09-30T10:00:00Z');
      const discharge = new Date('2026-09-30T16:00:00Z');
      expect(calculateLengthOfStayDays(now, discharge)).toBe(1);
    });

    it('calculates 3 days for a 3-day admission accurately', () => {
      const start = new Date('2026-09-25T10:00:00Z');
      const end = new Date('2026-09-28T10:00:00Z');
      expect(calculateLengthOfStayDays(start, end)).toBe(3);
    });

    it('rounds up partial days to the next full day', () => {
      const start = new Date('2026-09-25T10:00:00Z');
      const end = new Date('2026-09-26T14:00:00Z'); // 28 hours = 2 days
      expect(calculateLengthOfStayDays(start, end)).toBe(2);
    });

    it('returns at least 1 for currently admitted patient without discharge date', () => {
      const start = new Date(Date.now() - 3600 * 1000); // 1 hour ago
      expect(calculateLengthOfStayDays(start, null)).toBe(1);
    });
  });

  describe('resolveBedTariff', () => {
    it('resolves General Ward to standard 800/day', () => {
      expect(resolveBedTariff('General Male Ward')).toBe(800);
      expect(resolveBedTariff('General Ward')).toBe(800);
    });

    it('resolves ICU to 4500/day', () => {
      expect(resolveBedTariff('Intensive Care Unit (ICU)')).toBe(4500);
      expect(resolveBedTariff('ICU Ward')).toBe(4500);
    });

    it('resolves Semi-Private to 1500/day and Deluxe/Private to 2500/day', () => {
      expect(resolveBedTariff('Semi-Private Rooms')).toBe(1500);
      expect(resolveBedTariff('Deluxe Private Rooms')).toBe(2500);
    });

    it('falls back gracefully for unknown ward types', () => {
      expect(resolveBedTariff('Special Ward X')).toBe(800);
    });
  });

  describe('resolveServiceFee & resolveLabFee', () => {
    it('resolves Oxygen Therapy and Nebulization correctly', () => {
      expect(resolveServiceFee('OXYGEN_THERAPY')).toBe(300);
      expect(resolveServiceFee('NEBULIZATION')).toBe(150);
      expect(resolveServiceFee('CATHETER_CARE')).toBe(300);
    });

    it('resolves common lab test fees', () => {
      expect(resolveLabFee('Complete Blood Count (CBC)')).toBe(300);
      expect(resolveLabFee('Liver Function Test')).toBe(650);
      expect(resolveLabFee('Renal Function Test (RFT)')).toBe(550);
      expect(resolveLabFee('Urine Routine')).toBe(150);
    });
  });

  describe('calculateNetDeposits', () => {
    it('sums advance and top-ups and subtracts refunds', () => {
      const deposits: IpdDeposit[] = [
        {
          id: 1,
          admissionId: 10,
          patientId: 5,
          receiptNo: 'DEP-1',
          amount: 5000,
          paymentMethod: 'Cash',
          type: 'ADVANCE',
          createdAt: new Date(),
        },
        {
          id: 2,
          admissionId: 10,
          patientId: 5,
          receiptNo: 'DEP-2',
          amount: 2000,
          paymentMethod: 'UPI',
          type: 'TOP_UP',
          createdAt: new Date(),
        },
        {
          id: 3,
          admissionId: 10,
          patientId: 5,
          receiptNo: 'DEP-3',
          amount: 500,
          paymentMethod: 'Cash',
          type: 'REFUND',
          createdAt: new Date(),
        },
      ];

      expect(calculateNetDeposits(deposits)).toBe(6500); // 5000 + 2000 - 500
    });

    it('handles empty deposit lists', () => {
      expect(calculateNetDeposits([])).toBe(0);
    });
  });

  describe('calculateIpdBillBreakdown', () => {
    it('produces an accurate end-to-end breakdown and invoice items', () => {
      const admission = {
        id: 1,
        patientId: 101,
        admissionNo: 'IPD-20260925-01',
        ward: 'Semi-Private Room',
        roomType: 'Semi-Private',
        bedNo: 'SP-02',
        admissionDate: new Date('2026-09-25T09:00:00Z'),
        dischargeDate: new Date('2026-09-28T09:00:00Z'), // 3 days
        attendingDoctor: 'Dr. Nitin Sonare',
      };

      const rounds: IpdRound[] = [
        {
          id: 1,
          admissionId: 1,
          roundDate: new Date('2026-09-25T11:00:00Z'),
          doctorOrStaff: 'Dr. Nitin Sonare',
          role: 'DOCTOR',
          notes: 'Patient stable',
          createdAt: new Date(),
        },
        {
          id: 2,
          admissionId: 1,
          roundDate: new Date('2026-09-26T11:00:00Z'),
          doctorOrStaff: 'Dr. Nitin Sonare',
          role: 'DOCTOR',
          notes: 'Improving',
          createdAt: new Date(),
        },
      ];

      const clinicalServices: IpdClinicalService[] = [
        {
          id: 1,
          admissionId: 1,
          patientId: 101,
          serviceType: 'OXYGEN_THERAPY',
          serviceName: 'Oxygen Therapy via Nasal Cannula',
          performedAt: new Date(),
          nurseName: 'Sister Priya',
          attendingDoctorName: 'Dr. Nitin Sonare',
          status: 'COMPLETED',
        },
        {
          id: 2,
          admissionId: 1,
          patientId: 101,
          serviceType: 'WOUND_DRESSING',
          serviceName: 'Aseptic Surgical Wound Dressing',
          performedAt: new Date(),
          nurseName: 'Sister Priya',
          attendingDoctorName: 'Dr. Nitin Sonare',
          status: 'COMPLETED',
        },
      ];

      const labReports: LabReport[] = [
        {
          id: 10,
          reportNo: 'LAB-001',
          patientId: 101,
          testName: 'Complete Blood Count (CBC)',
          category: 'Pathology',
          status: 'COMPLETED',
          results: '[]',
          createdAt: new Date(),
        },
      ];

      const deposits: IpdDeposit[] = [
        {
          id: 1,
          admissionId: 1,
          patientId: 101,
          receiptNo: 'DEP-001',
          amount: 4000,
          paymentMethod: 'UPI',
          type: 'ADVANCE',
          createdAt: new Date(),
        },
      ];

      const breakdown = calculateIpdBillBreakdown({
        admission,
        rounds,
        clinicalServices,
        labReports,
        deposits,
      });

      expect(breakdown.lengthOfStayDays).toBe(3);
      expect(breakdown.bedTariffPerDay).toBe(1500);
      expect(breakdown.bedChargesTotal).toBe(4500); // 3 * 1500
      expect(breakdown.nursingChargesTotal).toBe(3 * DEFAULT_DAILY_NURSING_CARE); // 3 * 350 = 1050
      expect(breakdown.doctorRoundsCount).toBe(2);
      expect(breakdown.doctorRoundsTotal).toBe(2 * DEFAULT_DOCTOR_ROUND_RATE); // 2 * 400 = 800
      expect(breakdown.clinicalServicesTotal).toBe(300 + 250); // 550
      expect(breakdown.labTestsTotal).toBe(300); // 300

      // Gross Total: 4500 + 1050 + 800 + 550 + 300 = 7200
      expect(breakdown.grossTotal).toBe(7200);
      expect(breakdown.totalDepositsPaid).toBe(4000);
      expect(breakdown.netPayable).toBe(3200); // 7200 - 4000
      expect(breakdown.refundDue).toBe(0);

      // Verify suggested invoice line items
      expect(breakdown.suggestedItems.length).toBe(6); // Bed (1) + Nursing (1) + Doctor (1) + Procedures (2) + Lab (1) = 6
      expect(breakdown.suggestedItems[0].category).toBe('Procedure');
      expect(breakdown.suggestedItems[0].total).toBe(4500);
    });

    it('calculates refund due when advance deposit exceeds total inpatient bill', () => {
      const admission = {
        id: 2,
        patientId: 102,
        admissionNo: 'IPD-20260928-02',
        ward: 'General Ward',
        roomType: 'General',
        bedNo: 'GW-01',
        admissionDate: new Date('2026-09-28T08:00:00Z'),
        dischargeDate: new Date('2026-09-28T16:00:00Z'), // 1 day
        attendingDoctor: 'Dr. Nitin Sonare',
      };

      const deposits: IpdDeposit[] = [
        {
          id: 5,
          admissionId: 2,
          patientId: 102,
          receiptNo: 'DEP-100',
          amount: 5000,
          paymentMethod: 'Cash',
          type: 'ADVANCE',
          createdAt: new Date(),
        },
      ];

      const breakdown = calculateIpdBillBreakdown({
        admission,
        deposits,
      });

      expect(breakdown.lengthOfStayDays).toBe(1);
      // Bed: 800 + Nursing: 350 + Doctor: 400 = 1550
      expect(breakdown.grossTotal).toBe(1550);
      expect(breakdown.totalDepositsPaid).toBe(5000);
      expect(breakdown.netPayable).toBe(0);
      expect(breakdown.refundDue).toBe(3450); // 5000 - 1550 = 3450 refund
    });
  });
});
