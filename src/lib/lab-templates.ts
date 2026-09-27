import { LabResultParameter, LabResultFlag } from '@/types';

export interface LabTemplate {
  testName: string;
  category: string;
  sampleType: string;
  defaultParameters: Array<{
    parameter: string;
    unit: string;
    referenceRange: string;
    defaultValue?: string;
  }>;
}

export const STANDARD_LAB_TEMPLATES: LabTemplate[] = [
  {
    testName: "Complete Blood Count (CBC)",
    category: "Hematology",
    sampleType: "Blood (EDTA)",
    defaultParameters: [
      { parameter: "Hemoglobin (Hb)", unit: "g/dL", referenceRange: "13.0 - 17.0" },
      { parameter: "Total Leukocyte Count (TLC / WBC)", unit: "/cumm", referenceRange: "4,000 - 11,000" },
      { parameter: "Neutrophils", unit: "%", referenceRange: "40 - 75" },
      { parameter: "Lymphocytes", unit: "%", referenceRange: "20 - 45" },
      { parameter: "Eosinophils", unit: "%", referenceRange: "1 - 6" },
      { parameter: "Monocytes", unit: "%", referenceRange: "2 - 10" },
      { parameter: "Basophils", unit: "%", referenceRange: "0 - 1" },
      { parameter: "Platelet Count", unit: "lakhs/cumm", referenceRange: "1.5 - 4.5" },
      { parameter: "RBC Count", unit: "mil/cumm", referenceRange: "4.5 - 5.5" },
      { parameter: "PCV / Packed Cell Volume", unit: "%", referenceRange: "40 - 50" },
      { parameter: "MCV", unit: "fL", referenceRange: "80 - 100" },
      { parameter: "MCH", unit: "pg", referenceRange: "27 - 32" },
      { parameter: "MCHC", unit: "g/dL", referenceRange: "32 - 36" },
      { parameter: "Erythrocyte Sedimentation Rate (ESR)", unit: "mm/1st hr", referenceRange: "0 - 15" },
    ],
  },
  {
    testName: "Lipid Profile (Full)",
    category: "Biochemistry",
    sampleType: "Blood (Serum - Fasting)",
    defaultParameters: [
      { parameter: "Total Cholesterol", unit: "mg/dL", referenceRange: "125 - 200" },
      { parameter: "Triglycerides", unit: "mg/dL", referenceRange: "< 150" },
      { parameter: "HDL Cholesterol (Good)", unit: "mg/dL", referenceRange: "> 40" },
      { parameter: "LDL Cholesterol (Bad)", unit: "mg/dL", referenceRange: "< 100" },
      { parameter: "VLDL Cholesterol", unit: "mg/dL", referenceRange: "5 - 30" },
      { parameter: "Cholesterol / HDL Ratio", unit: "ratio", referenceRange: "3.3 - 4.4" },
    ],
  },
  {
    testName: "Liver Function Test (LFT)",
    category: "Biochemistry",
    sampleType: "Blood (Serum)",
    defaultParameters: [
      { parameter: "Bilirubin - Total", unit: "mg/dL", referenceRange: "0.2 - 1.2" },
      { parameter: "Bilirubin - Direct (Conjugated)", unit: "mg/dL", referenceRange: "0.0 - 0.3" },
      { parameter: "Bilirubin - Indirect", unit: "mg/dL", referenceRange: "0.2 - 0.9" },
      { parameter: "SGOT (AST)", unit: "U/L", referenceRange: "5 - 40" },
      { parameter: "SGPT (ALT)", unit: "U/L", referenceRange: "7 - 56" },
      { parameter: "Alkaline Phosphatase (ALP)", unit: "U/L", referenceRange: "44 - 147" },
      { parameter: "Total Protein", unit: "g/dL", referenceRange: "6.0 - 8.3" },
      { parameter: "Serum Albumin", unit: "g/dL", referenceRange: "3.5 - 5.0" },
      { parameter: "Serum Globulin", unit: "g/dL", referenceRange: "2.0 - 3.5" },
      { parameter: "Albumin / Globulin (A:G) Ratio", unit: "ratio", referenceRange: "1.2 - 2.2" },
    ],
  },
  {
    testName: "Kidney / Renal Function Test (KFT/RFT)",
    category: "Biochemistry",
    sampleType: "Blood (Serum)",
    defaultParameters: [
      { parameter: "Serum Creatinine", unit: "mg/dL", referenceRange: "0.6 - 1.2" },
      { parameter: "Blood Urea", unit: "mg/dL", referenceRange: "15 - 40" },
      { parameter: "Blood Urea Nitrogen (BUN)", unit: "mg/dL", referenceRange: "7 - 20" },
      { parameter: "Serum Uric Acid", unit: "mg/dL", referenceRange: "3.5 - 7.2" },
      { parameter: "Serum Sodium (Na+)", unit: "mEq/L", referenceRange: "135 - 145" },
      { parameter: "Serum Potassium (K+)", unit: "mEq/L", referenceRange: "3.5 - 5.1" },
      { parameter: "Serum Chloride (Cl-)", unit: "mEq/L", referenceRange: "98 - 107" },
    ],
  },
  {
    testName: "Diabetic Workup & Glycemic Control",
    category: "Biochemistry",
    sampleType: "Blood (Fluoride / EDTA)",
    defaultParameters: [
      { parameter: "Fasting Blood Sugar (FBS)", unit: "mg/dL", referenceRange: "70 - 100" },
      { parameter: "Post-Prandial Blood Sugar (PPBS)", unit: "mg/dL", referenceRange: "< 140" },
      { parameter: "HbA1c (Glycated Hemoglobin)", unit: "%", referenceRange: "< 5.7" },
      { parameter: "Average Blood Glucose (eAG)", unit: "mg/dL", referenceRange: "90 - 120" },
      { parameter: "Urine Microalbumin / Creatinine Ratio", unit: "mg/g", referenceRange: "< 30" },
    ],
  },
  {
    testName: "Thyroid Profile (T3, T4, TSH)",
    category: "Thyroid & Hormones",
    sampleType: "Blood (Serum)",
    defaultParameters: [
      { parameter: "Thyroid Stimulating Hormone (TSH)", unit: "uIU/mL", referenceRange: "0.4 - 4.5" },
      { parameter: "Free Triiodothyronine (FT3)", unit: "pg/mL", referenceRange: "2.3 - 4.2" },
      { parameter: "Free Thyroxine (FT4)", unit: "ng/dL", referenceRange: "0.8 - 1.8" },
    ],
  },
  {
    testName: "Urine Routine & Microscopy (R/M)",
    category: "Urine & Stool",
    sampleType: "Mid-stream Fresh Urine",
    defaultParameters: [
      { parameter: "Color", unit: "", referenceRange: "Pale Yellow", defaultValue: "Pale Yellow" },
      { parameter: "Appearance / Clarity", unit: "", referenceRange: "Clear", defaultValue: "Clear" },
      { parameter: "Reaction (pH)", unit: "", referenceRange: "5.0 - 7.5", defaultValue: "6.5" },
      { parameter: "Specific Gravity", unit: "", referenceRange: "1.010 - 1.025", defaultValue: "1.015" },
      { parameter: "Urine Protein / Albumin", unit: "", referenceRange: "Nil", defaultValue: "Nil" },
      { parameter: "Urine Sugar / Glucose", unit: "", referenceRange: "Nil", defaultValue: "Nil" },
      { parameter: "Urine Ketone Bodies", unit: "", referenceRange: "Negative", defaultValue: "Negative" },
      { parameter: "Urine Bile Pigment & Bile Salts", unit: "", referenceRange: "Negative", defaultValue: "Negative" },
      { parameter: "Pus Cells (Leukocytes)", unit: "/HPF", referenceRange: "0 - 4" },
      { parameter: "Red Blood Cells (RBCs)", unit: "/HPF", referenceRange: "Nil / Occasional" },
      { parameter: "Epithelial Cells", unit: "/HPF", referenceRange: "1 - 3" },
      { parameter: "Casts & Crystals", unit: "", referenceRange: "Not Seen", defaultValue: "Not Seen" },
      { parameter: "Bacteria", unit: "", referenceRange: "Nil", defaultValue: "Nil" },
    ],
  },
  {
    testName: "Acute Fever & Infectious Panel",
    category: "Infectious & Serology",
    sampleType: "Blood (Serum / EDTA)",
    defaultParameters: [
      { parameter: "Dengue NS1 Antigen", unit: "", referenceRange: "Negative", defaultValue: "Negative" },
      { parameter: "Dengue IgM Antibodies", unit: "", referenceRange: "Negative", defaultValue: "Negative" },
      { parameter: "Dengue IgG Antibodies", unit: "", referenceRange: "Negative", defaultValue: "Negative" },
      { parameter: "Malarial Parasite (Smear / Rapid Antigen)", unit: "", referenceRange: "Negative", defaultValue: "Negative" },
      { parameter: "Widal Test - S. Typhi 'O'", unit: "titer", referenceRange: "< 1:80" },
      { parameter: "Widal Test - S. Typhi 'H'", unit: "titer", referenceRange: "< 1:80" },
      { parameter: "C-Reactive Protein (CRP - Quantitative)", unit: "mg/L", referenceRange: "< 6.0" },
    ],
  },
  {
    testName: "Serum Electrolytes",
    category: "Biochemistry",
    sampleType: "Blood (Serum)",
    defaultParameters: [
      { parameter: "Sodium (Na+)", unit: "mEq/L", referenceRange: "135 - 145" },
      { parameter: "Potassium (K+)", unit: "mEq/L", referenceRange: "3.5 - 5.1" },
      { parameter: "Chloride (Cl-)", unit: "mEq/L", referenceRange: "98 - 107" },
    ],
  },
  {
    testName: "Serum Calcium & Vitamin Profile",
    category: "Vitamins & Iron",
    sampleType: "Blood (Serum)",
    defaultParameters: [
      { parameter: "Serum Calcium (Total)", unit: "mg/dL", referenceRange: "8.5 - 10.5" },
      { parameter: "Serum 25-OH Vitamin D3", unit: "ng/mL", referenceRange: "30 - 100" },
      { parameter: "Serum Vitamin B12", unit: "pg/mL", referenceRange: "211 - 911" },
      { parameter: "Serum Ferritin", unit: "ng/mL", referenceRange: "30 - 400" },
    ],
  },
  {
    testName: "Cardiac Biomarkers & Screen",
    category: "Radiology & Imaging",
    sampleType: "Serum / ECG",
    defaultParameters: [
      { parameter: "Troponin I (High Sensitivity)", unit: "ng/mL", referenceRange: "< 0.04" },
      { parameter: "CK-MB", unit: "U/L", referenceRange: "< 25" },
      { parameter: "12-Lead ECG Finding", unit: "", referenceRange: "Normal Sinus Rhythm", defaultValue: "Normal Sinus Rhythm, No ST-T changes" },
    ],
  },
];

/**
 * Find best matching template by test name
 */
export function findLabTemplate(testName: string): LabTemplate | null {
  const clean = testName.trim().toLowerCase();
  for (const t of STANDARD_LAB_TEMPLATES) {
    if (t.testName.toLowerCase().includes(clean) || clean.includes(t.testName.toLowerCase())) {
      return t;
    }
  }
  // Try matching keywords
  if (clean.includes("cbc") || clean.includes("hemogram") || clean.includes("blood count")) {
    return STANDARD_LAB_TEMPLATES[0];
  }
  if (clean.includes("lipid") || clean.includes("cholesterol")) {
    return STANDARD_LAB_TEMPLATES[1];
  }
  if (clean.includes("lft") || clean.includes("liver")) {
    return STANDARD_LAB_TEMPLATES[2];
  }
  if (clean.includes("kft") || clean.includes("rft") || clean.includes("renal") || clean.includes("kidney")) {
    return STANDARD_LAB_TEMPLATES[3];
  }
  if (clean.includes("sugar") || clean.includes("glucose") || clean.includes("diabet") || clean.includes("hba1c")) {
    return STANDARD_LAB_TEMPLATES[4];
  }
  if (clean.includes("thyroid") || clean.includes("tsh")) {
    return STANDARD_LAB_TEMPLATES[5];
  }
  if (clean.includes("urine") && (clean.includes("routine") || clean.includes("r/m"))) {
    return STANDARD_LAB_TEMPLATES[6];
  }
  if (clean.includes("fever") || clean.includes("dengue") || clean.includes("typhoid") || clean.includes("widal")) {
    return STANDARD_LAB_TEMPLATES[7];
  }
  if (clean.includes("electrolyte") || clean.includes("sodium") || clean.includes("potassium")) {
    return STANDARD_LAB_TEMPLATES[8];
  }
  if (clean.includes("vitamin") || clean.includes("calcium") || clean.includes("b12") || clean.includes("vit d")) {
    return STANDARD_LAB_TEMPLATES[9];
  }
  return null;
}

/**
 * Creates default LabResultParameter array from a template or a test name
 */
export function createDefaultParameters(testName: string): LabResultParameter[] {
  const template = findLabTemplate(testName);
  if (template) {
    return template.defaultParameters.map((p, index) => ({
      id: `param-${index}-${Date.now()}`,
      parameter: p.parameter,
      value: p.defaultValue || "",
      unit: p.unit,
      referenceRange: p.referenceRange,
      flag: 'NORMAL' as LabResultFlag,
    }));
  }
  // Fallback single parameter for arbitrary/unmatched tests
  return [
    {
      id: `param-0-${Date.now()}`,
      parameter: testName,
      value: "",
      unit: "",
      referenceRange: "Normal / Negative",
      flag: 'NORMAL' as LabResultFlag,
    },
  ];
}

/**
 * Smart automatic clinical evaluation of a numeric or qualitative lab value against its reference range
 */
export function evaluateLabValue(valueStr: string, rangeStr: string): LabResultFlag {
  if (!valueStr || !valueStr.trim()) return 'NORMAL';
  const val = valueStr.trim().toLowerCase();
  const range = (rangeStr || '').trim().toLowerCase();

  // Qualitative checks
  if (range.includes("negative") || range.includes("nil")) {
    if (val.includes("positive") || val.includes("reactive") || val.includes("detected") || val === "present") {
      return 'HIGH';
    }
    return 'NORMAL';
  }

  // Parse numeric value
  // Remove commas e.g. 11,000 -> 11000
  const cleanValNum = parseFloat(val.replace(/,/g, ''));
  if (isNaN(cleanValNum)) {
    return 'NORMAL';
  }

  // Range formats:
  // "13.0 - 17.0" or "13 - 17" or "4,000 - 11,000"
  const dashMatch = range.match(/([\d,.]+)\s*-\s*([\d,.]+)/);
  if (dashMatch) {
    const min = parseFloat(dashMatch[1].replace(/,/g, ''));
    const max = parseFloat(dashMatch[2].replace(/,/g, ''));
    if (!isNaN(min) && !isNaN(max)) {
      if (cleanValNum < min) return 'LOW';
      if (cleanValNum > max) return 'HIGH';
      return 'NORMAL';
    }
  }

  // "< 150" or "<= 150"
  const lessThanMatch = range.match(/<=\s*([\d,.]+)|<\s*([\d,.]+)/);
  if (lessThanMatch) {
    const max = parseFloat((lessThanMatch[1] || lessThanMatch[2]).replace(/,/g, ''));
    if (!isNaN(max)) {
      if (cleanValNum > max) return 'HIGH';
      return 'NORMAL';
    }
  }

  // "> 40" or ">= 40"
  const greaterThanMatch = range.match(/>=\s*([\d,.]+)|>\s*([\d,.]+)/);
  if (greaterThanMatch) {
    const min = parseFloat((greaterThanMatch[1] || greaterThanMatch[2]).replace(/,/g, ''));
    if (!isNaN(min)) {
      if (cleanValNum < min) return 'LOW';
      return 'NORMAL';
    }
  }

  return 'NORMAL';
}
