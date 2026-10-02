import { describe, it, expect } from 'vitest';
import {
  validateM1AbhaCompliance,
  validateM2CareContextLinking,
  validateM3FhirDocumentBundle,
  validatePmjayClaimReadiness,
  runFullAbdmSandboxSuite,
} from '@/lib/abdm/abdm-sandbox-validator';
import { prescriptionToAbdmDocumentBundle, FhirBundle } from '@/lib/fhir/fhir-converter';
import { generateAbdmCareContext } from '@/lib/abdm/abdm-client';

describe('ABDM & PM-JAY Sandbox Compliance Validation', () => {
  const samplePatient = {
    id: 101,
    regNo: 'PT-101',
    name: 'Rameshwar Patil',
    age: 48,
    gender: 'male',
    phone: '9876543210',
    abhaId: '14-8899-3322-1100',
    abhaAddress: 'rameshwar.patil@abdm',
  };

  const samplePrescription = {
    id: 501,
    patientId: 101,
    diagnosis: 'Type 2 Diabetes Mellitus [ICD-10: E11.9]',
    medications: JSON.stringify([
      {
        name: 'Metformin',
        genericName: 'Metformin Hydrochloride',
        dosage: '500 mg',
        timing: 'Twice daily',
        duration: '30 days',
        instruction: 'After food',
      },
    ]),
    advice: 'Diet control, regular walking 30 mins daily',
    createdAt: new Date('2026-10-02T10:00:00Z'),
  };

  const sampleDoctor = {
    name: 'Dr. Nitin Sonare',
    regNumber: 'MCI-98765',
  };

  describe('Milestone 1 (M1): ABHA Identifier Verification', () => {
    it('validates 14-digit ABHA Number with 100% compliance', () => {
      const res = validateM1AbhaCompliance('14-8899-3322-1100');
      expect(res.overallStatus).toBe('PASS');
      expect(res.complianceScorePercent).toBe(100);
      expect(res.checks.every((c) => c.passed)).toBe(true);
    });

    it('validates federated ABHA Address (@abdm or @sbx)', () => {
      const res1 = validateM1AbhaCompliance('rameshwar.patil@abdm');
      expect(res1.overallStatus).toBe('PASS');

      const res2 = validateM1AbhaCompliance('patient.test@sbx');
      expect(res2.overallStatus).toBe('PASS');
    });

    it('fails compliance on invalid or missing ABHA identifiers', () => {
      const resEmpty = validateM1AbhaCompliance('');
      expect(resEmpty.overallStatus).toBe('FAIL');

      const resInvalid = validateM1AbhaCompliance('invalid_abha');
      expect(resInvalid.overallStatus).toBe('FAIL');
    });
  });

  describe('Milestone 2 (M2): Care Context Linkage', () => {
    it('validates compliant OPD and IPD care context references', () => {
      const linkage = generateAbdmCareContext(101, 'OPD', 501);
      const res = validateM2CareContextLinking(linkage);
      expect(res.overallStatus).toBe('PASS');
      expect(res.complianceScorePercent).toBe(100);
    });

    it('rejects invalid patient references or missing encounter domains', () => {
      const res = validateM2CareContextLinking({
        patientReference: 'INVALID-ID',
        careContext: {
          referenceNumber: 'WRONG-REF',
          display: 'Short',
        },
      });
      expect(res.overallStatus).toBe('FAIL');
      expect(res.checks.some((c) => !c.passed && c.code === 'M2-LINK-01')).toBe(true);
    });
  });

  describe('Milestone 3 (M3): NRCES FHIR R4 Document Bundle', () => {
    it('generates 100% compliant Document Bundle with Entry[0] Composition and Practitioner', () => {
      const bundle = prescriptionToAbdmDocumentBundle({
        prescription: samplePrescription,
        patient: samplePatient,
        doctor: sampleDoctor,
      });

      const res = validateM3FhirDocumentBundle(bundle);
      expect(res.overallStatus).toBe('PASS');
      expect(res.complianceScorePercent).toBe(100);
      expect(bundle.type).toBe('document');
      expect((bundle.entry[0].resource as any).resourceType).toBe('Composition');

      const comp = bundle.entry[0].resource as any;
      expect(comp.type.coding[0].code).toBe('440545006'); // SNOMED Prescription record
      expect(comp.status).toBe('final');

      const practitioner = bundle.entry.find((e) => (e.resource as any)?.resourceType === 'Practitioner');
      expect(practitioner).toBeDefined();

      const patient = bundle.entry.find((e) => (e.resource as any)?.resourceType === 'Patient');
      expect(patient).toBeDefined();

      const medReq = bundle.entry.find((e) => (e.resource as any)?.resourceType === 'MedicationRequest');
      expect(medReq).toBeDefined();

      const condition = bundle.entry.find((e) => (e.resource as any)?.resourceType === 'Condition');
      expect(condition).toBeDefined();
    });

    it('rejects bundle when Entry[0] is not a Composition resource', () => {
      const invalidBundle: FhirBundle = {
        resourceType: 'Bundle',
        id: 'bundle-invalid',
        meta: { lastUpdated: new Date().toISOString() },
        type: 'collection',
        total: 1,
        entry: [
          {
            fullUrl: 'http://example.com/Patient/1',
            resource: { resourceType: 'Patient' } as any,
          },
        ],
      };

      const res = validateM3FhirDocumentBundle(invalidBundle);
      expect(res.overallStatus).toBe('FAIL');
      expect(res.checks.some((c) => c.code === 'M3-FHIR-04' && !c.passed)).toBe(true);
    });
  });

  describe('PM-JAY Claim Readiness & End-to-End Suite', () => {
    it('validates claim readiness for PM-JAY pre-authorization', () => {
      const bundle = prescriptionToAbdmDocumentBundle({
        prescription: samplePrescription,
        patient: samplePatient,
        doctor: sampleDoctor,
      });

      const claim = validatePmjayClaimReadiness({
        patient: samplePatient,
        prescription: samplePrescription,
        bundle,
        packageCode: 'MG001',
      });

      expect(claim.ready).toBe(true);
      expect(claim.status).toBe('CLAIM_READY');
      expect(claim.deficiencies).toHaveLength(0);
    });

    it('detects deficiencies when diagnosis lacks ICD-10 code', () => {
      const bundle = prescriptionToAbdmDocumentBundle({
        prescription: {
          ...samplePrescription,
          diagnosis: 'General malaise without ICD-10',
        },
        patient: samplePatient,
        doctor: sampleDoctor,
      });

      const claim = validatePmjayClaimReadiness({
        patient: samplePatient,
        prescription: {
          ...samplePrescription,
          diagnosis: 'General malaise without ICD-10',
        },
        bundle,
      });

      expect(claim.ready).toBe(false);
      expect(claim.status).toBe('DEFICIENT');
      expect(claim.deficiencies.some((d) => d.includes('ICD-10'))).toBe(true);
    });

    it('executes full ABDM Sandbox Suite with all milestones passing', () => {
      const bundle = prescriptionToAbdmDocumentBundle({
        prescription: samplePrescription,
        patient: samplePatient,
        doctor: sampleDoctor,
      });
      const careContext = generateAbdmCareContext(samplePatient.id, 'OPD', samplePrescription.id);

      const suite = runFullAbdmSandboxSuite({
        patient: samplePatient,
        prescription: samplePrescription,
        doctor: sampleDoctor,
        bundle,
        careContext,
      });

      expect(suite.allPassed).toBe(true);
      expect(suite.m1.overallStatus).toBe('PASS');
      expect(suite.m2.overallStatus).toBe('PASS');
      expect(suite.m3.overallStatus).toBe('PASS');
      expect(suite.pmjay.ready).toBe(true);
    });
  });
});
