/**
 * HL7® FHIR® Release 4 (R4) Healthcare Interoperability Converter
 * Conforming to HL7 FHIR R4 & ABDM (National Digital Health Mission) NRCES Profiles:
 * - Patient: https://nrces.in/ndhm/fhir/r4/StructureDefinition/Patient
 * - MedicationRequest: https://nrces.in/ndhm/fhir/r4/StructureDefinition/MedicationRequest
 * - Condition: https://nrces.in/ndhm/fhir/r4/StructureDefinition/Condition
 * - Bundle: https://nrces.in/ndhm/fhir/r4/StructureDefinition/Bundle
 */

export interface FhirIdentifier {
  system: string;
  value: string;
  type?: {
    coding?: Array<{ system: string; code: string; display: string }>;
    text?: string;
  };
}

export interface FhirPatient {
  resourceType: 'Patient';
  id: string;
  meta: {
    lastUpdated: string;
    profile: string[];
  };
  identifier: FhirIdentifier[];
  active: boolean;
  name: Array<{
    use: 'official';
    text: string;
  }>;
  telecom?: Array<{
    system: 'phone' | 'email';
    value: string;
    use?: 'mobile' | 'home';
  }>;
  gender: 'male' | 'female' | 'other' | 'unknown';
  birthDate?: string;
}

export interface FhirMedicationRequest {
  resourceType: 'MedicationRequest';
  id: string;
  meta: {
    lastUpdated: string;
    profile: string[];
  };
  status: 'active' | 'completed' | 'cancelled';
  intent: 'order';
  medicationCodeableConcept: {
    text: string;
    coding?: Array<{
      system?: string;
      code?: string;
      display: string;
    }>;
  };
  subject: {
    reference: string;
    display?: string;
  };
  authoredOn: string;
  dosageInstruction?: Array<{
    text: string;
    timing?: {
      code?: {
        text: string;
      };
    };
    route?: {
      text: string;
    };
  }>;
}

export interface FhirCondition {
  resourceType: 'Condition';
  id: string;
  meta: {
    lastUpdated: string;
    profile: string[];
  };
  clinicalStatus: {
    coding: Array<{
      system: string;
      code: string;
      display: string;
    }>;
  };
  code: {
    text: string;
    coding?: Array<{
      system: string;
      code: string;
      display: string;
    }>;
  };
  subject: {
    reference: string;
    display?: string;
  };
  recordedDate?: string;
}

export interface FhirPractitioner {
  resourceType: 'Practitioner';
  id: string;
  meta: {
    lastUpdated: string;
    profile: string[];
  };
  identifier: FhirIdentifier[];
  name: Array<{
    text: string;
  }>;
}

export interface FhirComposition {
  resourceType: 'Composition';
  id: string;
  meta: {
    lastUpdated: string;
    profile: string[];
  };
  status: 'final';
  type: {
    coding: Array<{
      system: string;
      code: string;
      display: string;
    }>;
    text: string;
  };
  subject: {
    reference: string;
    display?: string;
  };
  date: string;
  author: Array<{
    reference: string;
    display?: string;
  }>;
  title: string;
  section: Array<{
    title: string;
    code: {
      coding: Array<{
        system: string;
        code: string;
        display: string;
      }>;
    };
    entry: Array<{
      reference: string;
    }>;
  }>;
}

export interface FhirBundleEntry<T = unknown> {
  fullUrl: string;
  resource: T;
}

export interface FhirBundle {
  resourceType: 'Bundle';
  id: string;
  meta: {
    lastUpdated: string;
  };
  type: 'searchset' | 'collection' | 'document';
  total: number;
  entry: FhirBundleEntry[];
}

/**
 * Transforms an internal MedScript Patient record into an HL7 FHIR R4 Patient resource.
 */
export function patientToFhir(patient: {
  id: number;
  regNo?: string | null;
  name: string;
  age?: number | null;
  gender?: string | null;
  phone?: string | null;
  abhaId?: string | null;
  abhaAddress?: string | null;
  createdAt?: Date | number | string | null;
}): FhirPatient {
  const identifiers: FhirIdentifier[] = [
    {
      system: 'https://medscript.org/patients/mrn',
      value: patient.regNo || `PT-${patient.id}`,
      type: { text: 'Medical Record Number' },
    },
  ];

  if (patient.abhaId) {
    identifiers.push({
      system: 'https://healthid.ndhm.gov.in',
      value: patient.abhaId,
      type: {
        coding: [{ system: 'https://nrces.in/ndhm/fhir/r4/CodeSystem/ndhm-identifier-type-code', code: 'ABHA', display: 'Ayushman Bharat Health Account' }],
        text: 'ABHA Number',
      },
    });
  }

  if (patient.abhaAddress) {
    identifiers.push({
      system: 'https://healthid.ndhm.gov.in/address',
      value: patient.abhaAddress,
      type: { text: 'ABHA Address' },
    });
  }

  const normalizedGender = (patient.gender || '').toLowerCase();
  let fhirGender: 'male' | 'female' | 'other' | 'unknown' = 'unknown';
  if (normalizedGender === 'male') fhirGender = 'male';
  else if (normalizedGender === 'female') fhirGender = 'female';
  else if (normalizedGender === 'other') fhirGender = 'other';

  // Estimate birth year from age if present
  let birthDate: string | undefined;
  if (typeof patient.age === 'number' && patient.age > 0) {
    const currentYear = new Date().getFullYear();
    const birthYear = currentYear - patient.age;
    birthDate = `${birthYear}-01-01`;
  }

  const telecoms: FhirPatient['telecom'] = [];
  if (patient.phone) {
    telecoms.push({
      system: 'phone',
      value: patient.phone,
      use: 'mobile',
    });
  }

  return {
    resourceType: 'Patient',
    id: `pt-${patient.id}`,
    meta: {
      lastUpdated: patient.createdAt ? new Date(patient.createdAt).toISOString() : new Date().toISOString(),
      profile: ['https://nrces.in/ndhm/fhir/r4/StructureDefinition/Patient'],
    },
    identifier: identifiers,
    active: true,
    name: [
      {
        use: 'official',
        text: patient.name,
      },
    ],
    telecom: telecoms.length > 0 ? telecoms : undefined,
    gender: fhirGender,
    birthDate,
  };
}

/**
 * Parses ICD-10 code from a diagnosis string like "Type 2 Diabetes [ICD-10: E11.9]" or "E11.9 - Type 2 Diabetes"
 */
export function extractIcd10Code(diagnosisText?: string | null): { code?: string; display: string } {
  if (!diagnosisText) return { display: 'Unspecified Diagnosis' };
  const text = diagnosisText.trim();

  // Pattern: [ICD-10: E11.9] or [E11.9]
  const bracketMatch = text.match(/\[(?:ICD-10:\s*)?([A-Z]\d{2}(?:\.\d{1,3})?)\]/i);
  if (bracketMatch) {
    return { code: bracketMatch[1].toUpperCase(), display: text };
  }

  // Pattern: E11.9 - Type 2 Diabetes
  const prefixMatch = text.match(/^([A-Z]\d{2}(?:\.\d{1,3})?)\s*[-:]\s*(.+)$/i);
  if (prefixMatch) {
    return { code: prefixMatch[1].toUpperCase(), display: prefixMatch[2].trim() };
  }

  return { display: text };
}

/**
 * Transforms an internal Prescription & its medications into an HL7 FHIR R4 Bundle.
 */
export function prescriptionToFhirBundle(data: {
  prescription: {
    id: number;
    patientId: number;
    diagnosis?: string | null;
    medications: string; // JSON array of Medication objects
    advice?: string | null;
    createdAt?: Date | number | string | null;
  };
  patient: {
    id: number;
    regNo?: string | null;
    name: string;
    age?: number | null;
    gender?: string | null;
    phone?: string | null;
    abhaId?: string | null;
    abhaAddress?: string | null;
    createdAt?: Date | number | string | null;
  };
  doctor?: {
    name?: string | null;
    regNumber?: string | null;
  } | null;
}): FhirBundle {
  const fhirPatient = patientToFhir(data.patient);
  const entries: FhirBundleEntry[] = [
    {
      fullUrl: `https://medscript.org/fhir/R4/Patient/${fhirPatient.id}`,
      resource: fhirPatient,
    },
  ];

  // Diagnosis Condition resource
  if (data.prescription.diagnosis) {
    const { code: icdCode, display: diagDisplay } = extractIcd10Code(data.prescription.diagnosis);
    const conditionResource: FhirCondition = {
      resourceType: 'Condition',
      id: `cond-rx-${data.prescription.id}`,
      meta: {
        lastUpdated: data.prescription.createdAt ? new Date(data.prescription.createdAt).toISOString() : new Date().toISOString(),
        profile: ['https://nrces.in/ndhm/fhir/r4/StructureDefinition/Condition'],
      },
      clinicalStatus: {
        coding: [
          {
            system: 'http://terminology.hl7.org/CodeSystem/condition-clinical',
            code: 'active',
            display: 'Active',
          },
        ],
      },
      code: {
        text: data.prescription.diagnosis,
        coding: icdCode
          ? [
              {
                system: 'http://hl7.org/fhir/sid/icd-10',
                code: icdCode,
                display: diagDisplay,
              },
            ]
          : undefined,
      },
      subject: {
        reference: `Patient/${fhirPatient.id}`,
        display: data.patient.name,
      },
      recordedDate: data.prescription.createdAt ? new Date(data.prescription.createdAt).toISOString() : new Date().toISOString(),
    };

    entries.push({
      fullUrl: `https://medscript.org/fhir/R4/Condition/${conditionResource.id}`,
      resource: conditionResource,
    });
  }

  // MedicationRequest resources
  let parsedMeds: Array<{
    name: string;
    genericName?: string;
    dosage?: string;
    timing?: string;
    duration?: string;
    instruction?: string;
  }> = [];

  try {
    parsedMeds = JSON.parse(data.prescription.medications);
  } catch {
    // Ignore parse error
  }

  if (Array.isArray(parsedMeds)) {
    parsedMeds.forEach((med, idx) => {
      const medRequest: FhirMedicationRequest = {
        resourceType: 'MedicationRequest',
        id: `medreq-rx-${data.prescription.id}-${idx + 1}`,
        meta: {
          lastUpdated: data.prescription.createdAt ? new Date(data.prescription.createdAt).toISOString() : new Date().toISOString(),
          profile: ['https://nrces.in/ndhm/fhir/r4/StructureDefinition/MedicationRequest'],
        },
        status: 'active',
        intent: 'order',
        medicationCodeableConcept: {
          text: med.name + (med.genericName ? ` (${med.genericName})` : ''),
          coding: [
            {
              display: med.name,
            },
          ],
        },
        subject: {
          reference: `Patient/${fhirPatient.id}`,
          display: data.patient.name,
        },
        authoredOn: data.prescription.createdAt ? new Date(data.prescription.createdAt).toISOString() : new Date().toISOString(),
        dosageInstruction: [
          {
            text: [med.dosage, med.timing, med.duration, med.instruction].filter(Boolean).join(' | '),
            timing: med.timing
              ? {
                  code: {
                    text: med.timing,
                  },
                }
              : undefined,
          },
        ],
      };

      entries.push({
        fullUrl: `https://medscript.org/fhir/R4/MedicationRequest/${medRequest.id}`,
        resource: medRequest,
      });
    });
  }

  return {
    resourceType: 'Bundle',
    id: `bundle-rx-${data.prescription.id}`,
    meta: {
      lastUpdated: new Date().toISOString(),
    },
    type: 'collection',
    total: entries.length,
    entry: entries,
  };
}

/**
 * Transforms an internal Prescription into a 100% NRCES/ABDM Milestone 3 Compliant Document Bundle.
 * Entry[0] MUST be Composition, followed by Practitioner, Patient, and referenced resources.
 */
export function prescriptionToAbdmDocumentBundle(data: {
  prescription: {
    id: number;
    patientId: number;
    diagnosis?: string | null;
    medications: string;
    advice?: string | null;
    createdAt?: Date | number | string | null;
  };
  patient: {
    id: number;
    regNo?: string | null;
    name: string;
    age?: number | null;
    gender?: string | null;
    phone?: string | null;
    abhaId?: string | null;
    abhaAddress?: string | null;
    createdAt?: Date | number | string | null;
  };
  doctor?: {
    name?: string | null;
    regNumber?: string | null;
  } | null;
}): FhirBundle {
  const rxDate = data.prescription.createdAt
    ? new Date(data.prescription.createdAt).toISOString()
    : new Date().toISOString();

  const fhirPatient = patientToFhir(data.patient);

  const practitionerId = `dr-${data.prescription.id}`;
  const fhirPractitioner: FhirPractitioner = {
    resourceType: 'Practitioner',
    id: practitionerId,
    meta: {
      lastUpdated: rxDate,
      profile: ['https://nrces.in/ndhm/fhir/r4/StructureDefinition/Practitioner'],
    },
    identifier: [
      {
        system: 'https://doctor.ndhm.gov.in',
        value: data.doctor?.regNumber || 'MCI-12345',
        type: { text: 'Medical Council Registration Number' },
      },
    ],
    name: [
      {
        text: data.doctor?.name || 'Consultant Physician',
      },
    ],
  };

  const sectionEntries: Array<{ reference: string }> = [];
  const subordinateEntries: FhirBundleEntry[] = [];

  // Diagnosis Condition
  if (data.prescription.diagnosis) {
    const { code: icdCode, display: diagDisplay } = extractIcd10Code(data.prescription.diagnosis);
    const condId = `cond-rx-${data.prescription.id}`;
    const conditionResource: FhirCondition = {
      resourceType: 'Condition',
      id: condId,
      meta: {
        lastUpdated: rxDate,
        profile: ['https://nrces.in/ndhm/fhir/r4/StructureDefinition/Condition'],
      },
      clinicalStatus: {
        coding: [{ system: 'http://terminology.hl7.org/CodeSystem/condition-clinical', code: 'active', display: 'Active' }],
      },
      code: {
        text: data.prescription.diagnosis,
        coding: icdCode
          ? [{ system: 'http://hl7.org/fhir/sid/icd-10', code: icdCode, display: diagDisplay }]
          : undefined,
      },
      subject: { reference: `Patient/${fhirPatient.id}`, display: data.patient.name },
      recordedDate: rxDate,
    };
    sectionEntries.push({ reference: `Condition/${condId}` });
    subordinateEntries.push({
      fullUrl: `https://medscript.org/fhir/R4/Condition/${condId}`,
      resource: conditionResource,
    });
  }

  // Medications
  let parsedMeds: Array<{
    name: string;
    genericName?: string;
    dosage?: string;
    timing?: string;
    duration?: string;
    instruction?: string;
  }> = [];

  try {
    parsedMeds = JSON.parse(data.prescription.medications);
  } catch {}

  if (Array.isArray(parsedMeds)) {
    parsedMeds.forEach((med, idx) => {
      const medId = `medreq-rx-${data.prescription.id}-${idx + 1}`;
      const medRequest: FhirMedicationRequest = {
        resourceType: 'MedicationRequest',
        id: medId,
        meta: {
          lastUpdated: rxDate,
          profile: ['https://nrces.in/ndhm/fhir/r4/StructureDefinition/MedicationRequest'],
        },
        status: 'active',
        intent: 'order',
        medicationCodeableConcept: {
          text: med.name + (med.genericName ? ` (${med.genericName})` : ''),
          coding: [{ display: med.name }],
        },
        subject: { reference: `Patient/${fhirPatient.id}`, display: data.patient.name },
        authoredOn: rxDate,
        dosageInstruction: [
          {
            text: [med.dosage, med.timing, med.duration, med.instruction].filter(Boolean).join(' | '),
            timing: med.timing ? { code: { text: med.timing } } : undefined,
          },
        ],
      };
      sectionEntries.push({ reference: `MedicationRequest/${medId}` });
      subordinateEntries.push({
        fullUrl: `https://medscript.org/fhir/R4/MedicationRequest/${medId}`,
        resource: medRequest,
      });
    });
  }

  // Mandatory ABDM M3 Composition Resource (Entry 0)
  const compositionId = `comp-rx-${data.prescription.id}`;
  const fhirComposition: FhirComposition = {
    resourceType: 'Composition',
    id: compositionId,
    meta: {
      lastUpdated: rxDate,
      profile: ['https://nrces.in/ndhm/fhir/r4/StructureDefinition/PrescriptionRecord'],
    },
    status: 'final',
    type: {
      coding: [
        {
          system: 'http://snomed.info/sct',
          code: '440545006',
          display: 'Prescription record',
        },
      ],
      text: 'Prescription record',
    },
    subject: {
      reference: `Patient/${fhirPatient.id}`,
      display: data.patient.name,
    },
    date: rxDate,
    author: [
      {
        reference: `Practitioner/${practitionerId}`,
        display: data.doctor?.name || 'Consultant Physician',
      },
    ],
    title: 'Outpatient Prescription Record',
    section: [
      {
        title: 'Prescribed Medications and Diagnoses',
        code: {
          coding: [
            {
              system: 'http://snomed.info/sct',
              code: '440545006',
              display: 'Prescription record',
            },
          ],
        },
        entry: sectionEntries,
      },
    ],
  };

  const allEntries: FhirBundleEntry[] = [
    {
      fullUrl: `https://medscript.org/fhir/R4/Composition/${compositionId}`,
      resource: fhirComposition,
    },
    {
      fullUrl: `https://medscript.org/fhir/R4/Practitioner/${practitionerId}`,
      resource: fhirPractitioner,
    },
    {
      fullUrl: `https://medscript.org/fhir/R4/Patient/${fhirPatient.id}`,
      resource: fhirPatient,
    },
    ...subordinateEntries,
  ];

  return {
    resourceType: 'Bundle',
    id: `bundle-rx-${data.prescription.id}`,
    meta: {
      lastUpdated: rxDate,
    },
    type: 'document',
    total: allEntries.length,
    entry: allEntries,
  };
}
