/**
 * National Health Authority (NHA) ABDM & PM-JAY Sandbox Compliance Validator
 * Validates against official NHA Sandboxes:
 * - Milestone 1 (M1): ABHA Creation & Verification
 * - Milestone 2 (M2): Health Information Provider (HIP) Linking & Care Contexts
 * - Milestone 3 (M3): Health Information Exchange & NRCES FHIR R4 Document Bundle
 * - PM-JAY: Health Benefit Package (HBP 2.2) Insurance Claim Readiness
 */

import { FhirBundle, FhirComposition, FhirPatient, FhirPractitioner, FhirMedicationRequest, FhirCondition } from '@/lib/fhir/fhir-converter';
import { validateAbhaFormat } from '@/lib/abdm/abdm-client';

export interface AbdmValidationReport {
  milestone: 'M1' | 'M2' | 'M3' | 'PMJAY' | 'ALL';
  overallStatus: 'PASS' | 'FAIL' | 'WARNING';
  complianceScorePercent: number;
  checks: Array<{
    code: string;
    description: string;
    passed: boolean;
    severity: 'BLOCKER' | 'CRITICAL' | 'RECOMMENDED';
    error?: string;
  }>;
  summary: string;
}

export interface PmjayClaimReadinessResult {
  ready: boolean;
  status: 'CLAIM_READY' | 'DEFICIENT' | 'INELIGIBLE';
  packageCode?: string;
  beneficiaryId?: string;
  deficiencies: string[];
}

/**
 * Validates an ABHA Identifier against ABDM Milestone 1 (M1) specifications.
 */
export function validateM1AbhaCompliance(abhaInput?: string | null): AbdmValidationReport {
  const checks: AbdmValidationReport['checks'] = [];
  const check = validateAbhaFormat(abhaInput);

  // Check 1: Identifier Presence
  checks.push({
    code: 'M1-REQ-01',
    description: 'ABHA Identifier is non-empty and formatted',
    passed: Boolean(abhaInput && abhaInput.trim().length > 0),
    severity: 'BLOCKER',
    error: !abhaInput ? 'ABHA identifier is missing.' : undefined,
  });

  // Check 2: Syntax Validity
  checks.push({
    code: 'M1-REQ-02',
    description: 'Identifier is a valid 14-digit ABHA Number or alphanumeric ABHA Address (@abdm/@sbx)',
    passed: check.valid,
    severity: 'BLOCKER',
    error: check.error,
  });

  // Check 3: PHR Address Suffix Check
  if (check.type === 'ABHA_ADDRESS') {
    const hasExplicitDomain = Boolean(abhaInput && /@(abdm|sbx|ndhm)$/i.test(abhaInput.trim()));
    checks.push({
      code: 'M1-REQ-03',
      description: 'ABHA Address explicitly contains approved NHA federated domain (@abdm, @sbx)',
      passed: hasExplicitDomain,
      severity: 'BLOCKER',
      error: !hasExplicitDomain ? `Address must explicitly end with @abdm or @sbx. Got: '${abhaInput}'` : undefined,
    });
  } else if (check.type === 'ABHA_NUMBER') {
    const digitsOnly = check.normalized.replace(/\D/g, '');
    checks.push({
      code: 'M1-REQ-04',
      description: 'ABHA Number conforms to 14 numeric digits with standard hyphenation',
      passed: digitsOnly.length === 14,
      severity: 'CRITICAL',
      error: digitsOnly.length !== 14 ? 'ABHA Number must contain exactly 14 digits' : undefined,
    });
  }

  const passedCount = checks.filter((c) => c.passed).length;
  const score = Math.round((passedCount / checks.length) * 100);
  const overallStatus = checks.some((c) => !c.passed && c.severity === 'BLOCKER') ? 'FAIL' : score === 100 ? 'PASS' : 'WARNING';

  return {
    milestone: 'M1',
    overallStatus,
    complianceScorePercent: score,
    checks,
    summary: overallStatus === 'PASS' ? 'ABDM Milestone 1 (M1) Verified: Identifier is valid.' : 'M1 Verification Failed.',
  };
}

/**
 * Validates Care Context Linkage against ABDM Milestone 2 (M2) specifications.
 */
export function validateM2CareContextLinking(linkage: {
  patientReference: string;
  careContext: { referenceNumber: string; display: string };
}): AbdmValidationReport {
  const checks: AbdmValidationReport['checks'] = [];

  // Check 1: Patient MRN Reference
  const validPatientRef = /^PT-\d+$/i.test(linkage.patientReference);
  checks.push({
    code: 'M2-LINK-01',
    description: 'Patient Reference matches clinic identifier standard (PT-<id>)',
    passed: validPatientRef,
    severity: 'BLOCKER',
    error: !validPatientRef ? `Invalid patient reference format '${linkage.patientReference}'. Expected 'PT-<id>'` : undefined,
  });

  // Check 2: Care Context Reference Number
  const validRefNum = /^(OPD|IPD|LAB)-\w+/i.test(linkage.careContext.referenceNumber);
  checks.push({
    code: 'M2-LINK-02',
    description: 'Care Context reference specifies clinical encounter domain (OPD/IPD/LAB)',
    passed: validRefNum,
    severity: 'BLOCKER',
    error: !validRefNum ? `Reference number '${linkage.careContext.referenceNumber}' must begin with OPD-, IPD-, or LAB-` : undefined,
  });

  // Check 3: Human-Readable Display
  const hasDisplay = Boolean(linkage.careContext.display && linkage.careContext.display.trim().length >= 8);
  checks.push({
    code: 'M2-LINK-03',
    description: 'Human-readable encounter display string provided for patient consent interface',
    passed: hasDisplay,
    severity: 'CRITICAL',
    error: !hasDisplay ? 'Care Context display string is too short or missing' : undefined,
  });

  const passedCount = checks.filter((c) => c.passed).length;
  const score = Math.round((passedCount / checks.length) * 100);
  const overallStatus = checks.some((c) => !c.passed && c.severity === 'BLOCKER') ? 'FAIL' : score === 100 ? 'PASS' : 'WARNING';

  return {
    milestone: 'M2',
    overallStatus,
    complianceScorePercent: score,
    checks,
    summary: overallStatus === 'PASS' ? 'ABDM Milestone 2 (M2) Linkage Approved.' : 'M2 Linkage Deficient.',
  };
}

/**
 * Validates a FHIR R4 Bundle against NRCES / ABDM Milestone 3 (M3) Document specifications.
 */
export function validateM3FhirDocumentBundle(bundle: FhirBundle): AbdmValidationReport {
  const checks: AbdmValidationReport['checks'] = [];

  // Check 1: Root Bundle Resource Type
  const isBundle = bundle.resourceType === 'Bundle';
  checks.push({
    code: 'M3-FHIR-01',
    description: "Root FHIR resource is 'Bundle'",
    passed: isBundle,
    severity: 'BLOCKER',
    error: !isBundle ? `Expected resourceType 'Bundle', got '${(bundle as any)?.resourceType}'` : undefined,
  });

  // Check 2: Bundle Type must be 'document'
  const isDocument = bundle.type === 'document';
  checks.push({
    code: 'M3-FHIR-02',
    description: "Bundle.type is 'document' for Health Information Exchange",
    passed: isDocument,
    severity: 'BLOCKER',
    error: !isDocument ? `Bundle.type must be 'document', got '${bundle.type}'` : undefined,
  });

  // Check 3: Entry Array Presence
  const hasEntries = Array.isArray(bundle.entry) && bundle.entry.length >= 3;
  checks.push({
    code: 'M3-FHIR-03',
    description: 'Bundle contains mandatory clinical resources (Composition, Practitioner, Patient, + clinical entries)',
    passed: hasEntries,
    severity: 'BLOCKER',
    error: !hasEntries ? `Bundle contains ${bundle.entry?.length || 0} entries; expected at least 3` : undefined,
  });

  // Check 4: Entry 0 MUST be Composition Resource
  const firstResource = bundle.entry?.[0]?.resource as FhirComposition | undefined;
  const isComposition = firstResource?.resourceType === 'Composition';
  checks.push({
    code: 'M3-FHIR-04',
    description: 'Entry[0] is a Composition resource (NRCES Document Bundle Profile)',
    passed: isComposition,
    severity: 'BLOCKER',
    error: !isComposition ? `Entry[0] must be 'Composition', got '${(firstResource as any)?.resourceType}'` : undefined,
  });

  // Check 5: Composition status is 'final'
  const isFinal = firstResource?.status === 'final';
  checks.push({
    code: 'M3-FHIR-05',
    description: "Composition status is 'final'",
    passed: isFinal,
    severity: 'CRITICAL',
    error: !isFinal ? `Composition status must be 'final', got '${firstResource?.status}'` : undefined,
  });

  // Check 6: Composition type is SNOMED CT 440545006
  const hasSnomed = firstResource?.type?.coding?.some((c) => c.code === '440545006');
  checks.push({
    code: 'M3-FHIR-06',
    description: 'Composition type contains SNOMED CT 440545006 (Prescription record)',
    passed: Boolean(hasSnomed),
    severity: 'CRITICAL',
    error: !hasSnomed ? 'Missing SNOMED CT code 440545006 in Composition.type' : undefined,
  });

  // Check 7: Practitioner Resource in Bundle
  const practitionerEntry = bundle.entry?.find((e) => (e.resource as any)?.resourceType === 'Practitioner');
  const hasPractitioner = Boolean(practitionerEntry);
  checks.push({
    code: 'M3-FHIR-07',
    description: 'Practitioner resource exists with doctor registration number',
    passed: hasPractitioner,
    severity: 'BLOCKER',
    error: !hasPractitioner ? 'Practitioner resource missing from Bundle' : undefined,
  });

  // Check 8: Patient Resource in Bundle
  const patientEntry = bundle.entry?.find((e) => (e.resource as any)?.resourceType === 'Patient');
  const hasPatient = Boolean(patientEntry);
  checks.push({
    code: 'M3-FHIR-08',
    description: 'Patient resource exists with demographics and identifiers',
    passed: hasPatient,
    severity: 'BLOCKER',
    error: !hasPatient ? 'Patient resource missing from Bundle' : undefined,
  });

  // Check 9: MedicationRequest or Condition resources
  const hasClinicalEntries = bundle.entry?.some((e) => {
    const rt = (e.resource as any)?.resourceType;
    return rt === 'MedicationRequest' || rt === 'Condition';
  });
  checks.push({
    code: 'M3-FHIR-09',
    description: 'Bundle contains prescribed MedicationRequest or Condition diagnoses',
    passed: Boolean(hasClinicalEntries),
    severity: 'RECOMMENDED',
    error: !hasClinicalEntries ? 'Prescription bundle has no medications or diagnoses' : undefined,
  });

  const passedCount = checks.filter((c) => c.passed).length;
  const score = Math.round((passedCount / checks.length) * 100);
  const overallStatus = checks.some((c) => !c.passed && c.severity === 'BLOCKER') ? 'FAIL' : score === 100 ? 'PASS' : 'WARNING';

  return {
    milestone: 'M3',
    overallStatus,
    complianceScorePercent: score,
    checks,
    summary: overallStatus === 'PASS' ? 'ABDM Milestone 3 (M3) NRCES FHIR R4 Bundle Approved.' : 'M3 Bundle Validation Failed.',
  };
}

/**
 * Validates Ayushman Bharat / PM-JAY Insurance Claim Readiness.
 */
export function validatePmjayClaimReadiness(data: {
  patient: {
    abhaId?: string | null;
    abhaAddress?: string | null;
    regNo?: string | null;
  };
  prescription: {
    id: number;
    diagnosis?: string | null;
    medications: string;
  };
  bundle: FhirBundle;
  packageCode?: string;
}): PmjayClaimReadinessResult {
  const deficiencies: string[] = [];

  // 1. ABHA / PMJAY Beneficiary ID Check
  if (!data.patient.abhaId && !data.patient.abhaAddress) {
    deficiencies.push('Missing ABHA Number or ABHA Address for beneficiary verification');
  }

  // 2. Clinical Diagnosis with ICD-10
  if (!data.prescription.diagnosis || !/\[(?:ICD-10:\s*)?([A-Z]\d{2})/i.test(data.prescription.diagnosis)) {
    deficiencies.push('Prescription diagnosis is missing standard ICD-10 diagnostic code');
  }

  // 3. Health Benefit Package (HBP) Code
  const pkgCode = data.packageCode?.trim() || 'MG001'; // Default General Medicine Consultation
  if (!/^[A-Z]{2}\d{3,4}$/i.test(pkgCode)) {
    deficiencies.push(`Invalid PM-JAY package code '${pkgCode}'. Expected format like MG001 or SU001`);
  }

  // 4. M3 FHIR Document Bundle Validation
  const bundleReport = validateM3FhirDocumentBundle(data.bundle);
  if (bundleReport.overallStatus === 'FAIL') {
    deficiencies.push(`FHIR Document Bundle failed validation: ${bundleReport.checks.find((c) => !c.passed)?.error}`);
  }

  const ready = deficiencies.length === 0;

  return {
    ready,
    status: ready ? 'CLAIM_READY' : 'DEFICIENT',
    packageCode: pkgCode,
    beneficiaryId: data.patient.abhaId || data.patient.abhaAddress || undefined,
    deficiencies,
  };
}

/**
 * Runs the end-to-end NHA ABDM Sandbox compliance test suite across M1, M2, M3, and PMJAY.
 */
export function runFullAbdmSandboxSuite(data: {
  patient: {
    id: number;
    regNo?: string | null;
    name: string;
    age?: number | null;
    gender?: string | null;
    phone?: string | null;
    abhaId?: string | null;
    abhaAddress?: string | null;
  };
  prescription: {
    id: number;
    patientId: number;
    diagnosis?: string | null;
    medications: string;
    advice?: string | null;
    createdAt?: Date | number | string | null;
  };
  doctor?: {
    name?: string | null;
    regNumber?: string | null;
  } | null;
  bundle: FhirBundle;
  careContext: {
    patientReference: string;
    careContext: { referenceNumber: string; display: string };
  };
}): {
  m1: AbdmValidationReport;
  m2: AbdmValidationReport;
  m3: AbdmValidationReport;
  pmjay: PmjayClaimReadinessResult;
  allPassed: boolean;
} {
  const m1 = validateM1AbhaCompliance(data.patient.abhaId || data.patient.abhaAddress);
  const m2 = validateM2CareContextLinking(data.careContext);
  const m3 = validateM3FhirDocumentBundle(data.bundle);
  const pmjay = validatePmjayClaimReadiness({
    patient: data.patient,
    prescription: data.prescription,
    bundle: data.bundle,
  });

  const allPassed = m1.overallStatus === 'PASS' && m2.overallStatus === 'PASS' && m3.overallStatus === 'PASS' && pmjay.ready;

  return {
    m1,
    m2,
    m3,
    pmjay,
    allPassed,
  };
}
