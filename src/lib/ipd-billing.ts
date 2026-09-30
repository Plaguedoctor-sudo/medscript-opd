import {
  IpdAdmission,
  IpdRound,
  IpdClinicalService,
  LabReport,
  IpdDeposit,
  InvoiceItem,
  IpdBillingBreakdown,
  Invoice,
} from '@/types';

export interface IpdTariffConfig {
  bedTariffByWard?: Record<string, number>;
  defaultBedTariff?: number;
  dailyNursingRate?: number;
  doctorRoundRate?: number;
  serviceRates?: Record<string, number>;
  labRates?: Record<string, number>;
}

export const DEFAULT_WARD_TARIFFS: Record<string, number> = {
  'General Male Ward': 800,
  'General Female Ward': 800,
  'General Ward': 800,
  'General': 800,
  'Semi-Private Rooms': 1500,
  'Semi-Private Room': 1500,
  'Semi-Private': 1500,
  'Deluxe Private Rooms': 2500,
  'Deluxe Room': 2500,
  'Private Room': 2500,
  'Private': 2500,
  'Intensive Care Unit (ICU)': 4500,
  'ICU': 4500,
  'Emergency / Day Care': 1200,
  'Emergency / Triage': 1200,
  'Emergency': 1200,
};

export const DEFAULT_SERVICE_RATES: Record<string, number> = {
  OXYGEN_THERAPY: 300,
  SUCTIONING: 200,
  DRAINAGE_CARE: 250,
  NEBULIZATION: 150,
  CATHETER_CARE: 300,
  WOUND_DRESSING: 250,
  OTHER: 200,
};

export const DEFAULT_LAB_RATES: Record<string, number> = {
  'complete blood count': 300,
  cbc: 300,
  'liver function test': 650,
  lft: 650,
  'renal function test': 550,
  'kidney function test': 550,
  rft: 550,
  kft: 550,
  'lipid profile': 600,
  'urine routine': 150,
  'urine examination': 150,
  urine: 150,
  'thyroid profile': 500,
  tsh: 250,
  'blood glucose': 80,
  rbs: 80,
  fbs: 80,
  electrolytes: 400,
  'serum electrolytes': 400,
  widal: 200,
  dengue: 800,
  crp: 400,
};

export const DEFAULT_DAILY_NURSING_CARE = 350;
export const DEFAULT_DOCTOR_ROUND_RATE = 400;
export const DEFAULT_FALLBACK_BED_TARIFF = 800;

/**
 * Calculates length of inpatient stay in days.
 * Minimum length of stay is 1 day.
 */
export function calculateLengthOfStayDays(
  admissionDate: Date | string | number,
  dischargeDate?: Date | string | number | null
): number {
  const start = new Date(admissionDate).getTime();
  const end = dischargeDate ? new Date(dischargeDate).getTime() : Date.now();

  if (isNaN(start)) return 1;

  const diffMs = Math.max(0, end - start);
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  return Math.max(1, diffDays);
}

/**
 * Resolves standard bed tariff per day for a given ward and room type.
 */
export function resolveBedTariff(
  ward?: string | null,
  roomType?: string | null,
  customTariffs?: Record<string, number>
): number {
  const tariffs = { ...DEFAULT_WARD_TARIFFS, ...(customTariffs || {}) };

  if (ward && tariffs[ward] !== undefined) {
    return tariffs[ward];
  }

  if (roomType && tariffs[roomType] !== undefined) {
    return tariffs[roomType];
  }

  // Fuzzy match
  const normalizedWard = (ward || '').toLowerCase();
  if (normalizedWard.includes('icu') || normalizedWard.includes('intensive')) return 4500;
  if (normalizedWard.includes('deluxe') || normalizedWard.includes('private')) return 2500;
  if (normalizedWard.includes('semi')) return 1500;
  if (normalizedWard.includes('emergency') || normalizedWard.includes('triage') || normalizedWard.includes('day care'))
    return 1200;

  return DEFAULT_FALLBACK_BED_TARIFF;
}

/**
 * Resolves pricing for a clinical procedure / nursing service.
 */
export function resolveServiceFee(
  serviceType?: string | null,
  serviceName?: string | null,
  customRates?: Record<string, number>
): number {
  const rates = { ...DEFAULT_SERVICE_RATES, ...(customRates || {}) };

  if (serviceType && rates[serviceType] !== undefined) {
    return rates[serviceType];
  }

  const nameKey = (serviceName || '').toUpperCase().replace(/\s+/g, '_');
  if (rates[nameKey] !== undefined) {
    return rates[nameKey];
  }

  return 200;
}

/**
 * Resolves standard test fee for a lab report.
 */
export function resolveLabFee(
  testName?: string | null,
  category?: string | null,
  customRates?: Record<string, number>
): number {
  const rates = { ...DEFAULT_LAB_RATES, ...(customRates || {}) };
  const cleanName = (testName || '').toLowerCase().trim();

  for (const [key, price] of Object.entries(rates)) {
    if (cleanName.includes(key.toLowerCase())) {
      return price;
    }
  }

  if (category && category.toLowerCase().includes('pathology')) return 350;
  if (category && category.toLowerCase().includes('biochemistry')) return 450;
  if (category && category.toLowerCase().includes('microbiology')) return 400;

  return 300;
}

/**
 * Calculates total net advance deposits collected for an admission.
 * ADVANCE (+) + TOP_UP (+) - REFUND (-)
 */
export function calculateNetDeposits(deposits: IpdDeposit[]): number {
  if (!Array.isArray(deposits) || deposits.length === 0) return 0;

  let total = 0;
  for (const dep of deposits) {
    const amt = Number(dep.amount) || 0;
    if (dep.type === 'REFUND') {
      total -= amt;
    } else {
      total += amt;
    }
  }
  return Math.max(0, total);
}

/**
 * Core calculation function that generates the complete IPD billing breakdown
 * including itemized charges, deposit reconciliation, and pre-constructed invoice items.
 */
export function calculateIpdBillBreakdown(params: {
  admission: Pick<
    IpdAdmission,
    | 'id'
    | 'patientId'
    | 'admissionNo'
    | 'ward'
    | 'roomType'
    | 'bedNo'
    | 'admissionDate'
    | 'dischargeDate'
    | 'attendingDoctor'
  >;
  rounds?: IpdRound[];
  clinicalServices?: IpdClinicalService[];
  labReports?: LabReport[];
  deposits?: IpdDeposit[];
  config?: IpdTariffConfig;
  existingInvoice?: Invoice | null;
}): IpdBillingBreakdown {
  const { admission, rounds = [], clinicalServices = [], labReports = [], deposits = [], config, existingInvoice } = params;

  const lengthOfStayDays = calculateLengthOfStayDays(admission.admissionDate, admission.dischargeDate);
  const bedTariffPerDay = resolveBedTariff(admission.ward, admission.roomType, config?.bedTariffByWard);
  const bedChargesTotal = bedTariffPerDay * lengthOfStayDays;

  const nursingCarePerDay = config?.dailyNursingRate ?? DEFAULT_DAILY_NURSING_CARE;
  const nursingChargesTotal = nursingCarePerDay * lengthOfStayDays;

  const doctorRoundRate = config?.doctorRoundRate ?? DEFAULT_DOCTOR_ROUND_RATE;
  // Count doctor visits; if 0 rounds recorded, default to 1 visit per day of stay
  const doctorRoundsCount = rounds.length > 0 ? rounds.length : lengthOfStayDays;
  const doctorRoundsTotal = doctorRoundRate * doctorRoundsCount;

  // Procedure / Nursing service items
  let clinicalServicesTotal = 0;
  const procedureLineItems: InvoiceItem[] = clinicalServices.map((svc, idx) => {
    const fee = resolveServiceFee(svc.serviceType, svc.serviceName, config?.serviceRates);
    clinicalServicesTotal += fee;
    return {
      id: `proc_${svc.id || idx + 1}`,
      description: `${svc.serviceName || 'Inpatient Clinical Procedure'} (${svc.nurseName ? 'Nurse ' + svc.nurseName : 'Staff'})`,
      category: 'Procedure',
      quantity: 1,
      unitPrice: fee,
      total: fee,
    };
  });

  // Lab report items
  let labTestsTotal = 0;
  const labLineItems: InvoiceItem[] = labReports.map((lab, idx) => {
    const fee = resolveLabFee(lab.testName, lab.category, config?.labRates);
    labTestsTotal += fee;
    return {
      id: `lab_${lab.id || idx + 1}`,
      description: `${lab.testName || 'Lab Investigation'} [Report #${lab.reportNo}]`,
      category: 'Lab Test',
      quantity: 1,
      unitPrice: fee,
      total: fee,
    };
  });

  // Base inpatient line items
  const suggestedItems: InvoiceItem[] = [
    {
      id: 'bed_charges',
      description: `${admission.ward || 'Inpatient Ward'} Bed Charges (${lengthOfStayDays} Day${lengthOfStayDays > 1 ? 's' : ''}, Bed ${admission.bedNo || 'Assigned'})`,
      category: 'Procedure',
      quantity: lengthOfStayDays,
      unitPrice: bedTariffPerDay,
      total: bedChargesTotal,
    },
    {
      id: 'nursing_charges',
      description: `Inpatient Nursing & Bedside Monitoring Care (${lengthOfStayDays} Day${lengthOfStayDays > 1 ? 's' : ''})`,
      category: 'Procedure',
      quantity: lengthOfStayDays,
      unitPrice: nursingCarePerDay,
      total: nursingChargesTotal,
    },
    {
      id: 'doctor_rounds',
      description: `Attending Physician Ward Rounds (${doctorRoundsCount} Visit${doctorRoundsCount > 1 ? 's' : ''} - ${admission.attendingDoctor || 'Consultant'})`,
      category: 'Consultation',
      quantity: doctorRoundsCount,
      unitPrice: doctorRoundRate,
      total: doctorRoundsTotal,
    },
    ...procedureLineItems,
    ...labLineItems,
  ];

  const grossTotal = bedChargesTotal + nursingChargesTotal + doctorRoundsTotal + clinicalServicesTotal + labTestsTotal;
  const totalDepositsPaid = calculateNetDeposits(deposits);

  const netPayable = Math.max(0, grossTotal - totalDepositsPaid);
  const refundDue = Math.max(0, totalDepositsPaid - grossTotal);

  return {
    admissionId: admission.id,
    patientId: admission.patientId,
    admissionNo: admission.admissionNo,
    ward: admission.ward,
    roomType: admission.roomType || 'General',
    bedNo: admission.bedNo,
    admissionDate: new Date(admission.admissionDate),
    dischargeDate: admission.dischargeDate ? new Date(admission.dischargeDate) : null,
    lengthOfStayDays,
    bedTariffPerDay,
    bedChargesTotal,
    nursingCarePerDay,
    nursingChargesTotal,
    doctorRoundRate,
    doctorRoundsCount,
    doctorRoundsTotal,
    clinicalServicesTotal,
    labTestsTotal,
    grossTotal,
    totalDepositsPaid,
    netPayable,
    refundDue,
    suggestedItems,
    deposits,
    existingInvoice: existingInvoice || null,
  };
}
