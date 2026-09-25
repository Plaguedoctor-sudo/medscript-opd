export interface LabTestItem {
  id: string;
  name: string;
  category: string;
  sampleType?: string; // e.g. "Blood (EDTA)", "Blood (Serum)", "Urine", "Imaging"
  fastingRequired?: boolean;
  commonIndications?: string;
}

export interface LabPanel {
  id: string;
  name: string;
  badge?: string; // e.g. "Most Common", "Chronic", "Fever", "Antenatal"
  category: string;
  description: string;
  tests: string[]; // List of specific tests included
}

export const LAB_CATEGORIES = [
  "All",
  "Panels & Profiles",
  "Hematology",
  "Biochemistry",
  "Thyroid & Hormones",
  "Infectious & Serology",
  "Urine & Stool",
  "Vitamins & Iron",
  "Radiology & Imaging",
] as const;

export const LAB_PANELS: LabPanel[] = [
  {
    id: "panel-diabetic",
    name: "Diabetic Workup Panel",
    badge: "Popular",
    category: "Biochemistry",
    description: "Comprehensive diabetes glycemic control, kidney risk & organ check",
    tests: [
      "Fasting Blood Sugar (FBS)",
      "Post-Prandial Blood Sugar (PPBS)",
      "HbA1c (Glycated Hemoglobin)",
      "Urine Microalbumin / Albumin-to-Creatinine Ratio (ACR)",
      "Serum Creatinine",
    ],
  },
  {
    id: "panel-fever",
    name: "Acute Fever Workup Panel",
    badge: "Acute Care",
    category: "Infectious & Serology",
    description: "Standard acute febrile illness panel (Malaria, Typhoid, Dengue, CBC)",
    tests: [
      "Complete Blood Count (CBC) with Platelets",
      "Erythrocyte Sedimentation Rate (ESR)",
      "Malarial Parasite (Smear / Rapid Card)",
      "Dengue NS1 Antigen & IgM",
      "Widal Slide Agglutination Test",
      "Urine Routine & Microscopy",
    ],
  },
  {
    id: "panel-hypertension",
    name: "Hypertension & Cardiac Workup",
    badge: "Chronic",
    category: "Panels & Profiles",
    description: "Target organ and cardiovascular risk assessment for hypertensive patients",
    tests: [
      "Fasting Lipid Profile",
      "Serum Creatinine",
      "Serum Electrolytes (Na+, K+, Cl-)",
      "12-Lead Electrocardiogram (ECG)",
      "Urine Routine & Microscopy",
      "Fasting Blood Sugar (FBS)",
    ],
  },
  {
    id: "panel-lipid",
    name: "Lipid Profile (Full)",
    badge: "Cardiac",
    category: "Biochemistry",
    description: "Complete cholesterol fractionation (Total Cholesterol, HDL, LDL, VLDL, Triglycerides)",
    tests: [
      "Total Cholesterol",
      "Triglycerides",
      "HDL Cholesterol (Good)",
      "LDL Cholesterol (Bad)",
      "VLDL Cholesterol",
      "Cholesterol / HDL Ratio",
    ],
  },
  {
    id: "panel-thyroid",
    name: "Thyroid Profile (T3, T4, TSH)",
    badge: "Hormones",
    category: "Thyroid & Hormones",
    description: "Screening and management of hypothyroidism and hyperthyroidism",
    tests: [
      "Thyroid Stimulating Hormone (TSH)",
      "Free Triiodothyronine (FT3)",
      "Free Thyroxine (FT4)",
    ],
  },
  {
    id: "panel-kft",
    name: "Kidney / Renal Function Test (KFT/RFT)",
    badge: "Essential",
    category: "Biochemistry",
    description: "Renal clearance, glomerular function, and electrolyte balance",
    tests: [
      "Serum Creatinine",
      "Blood Urea Nitrogen (BUN)",
      "Serum Uric Acid",
      "Serum Electrolytes (Sodium, Potassium, Chloride)",
      "Urine Routine & Microscopy",
    ],
  },
  {
    id: "panel-lft",
    name: "Liver Function Test (LFT)",
    badge: "Essential",
    category: "Biochemistry",
    description: "Hepatic enzymes, bilirubin fractions, and synthesis proteins",
    tests: [
      "Bilirubin Total & Direct/Indirect",
      "SGPT (ALT)",
      "SGOT (AST)",
      "Alkaline Phosphatase (ALP)",
      "Serum Total Protein & Albumin/Globulin Ratio",
      "Gamma-Glutamyl Transferase (GGT)",
    ],
  },
  {
    id: "panel-anc",
    name: "Antenatal Care (ANC) Profile",
    badge: "Antenatal",
    category: "Panels & Profiles",
    description: "Essential first/second-trimester obstetric antenatal screening package",
    tests: [
      "Complete Blood Count (CBC)",
      "Blood Grouping & Rh Factor",
      "Random Blood Sugar (RBS)",
      "HIV I & II Antibodies",
      "HBsAg (Hepatitis B)",
      "VDRL / RPR (Syphilis)",
      "Urine Routine & Microscopy",
      "Obstetric Ultrasound (Pelvis)",
    ],
  },
  {
    id: "panel-arthritis",
    name: "Joint Pain & Arthritis Panel",
    badge: "Rheumatology",
    category: "Infectious & Serology",
    description: "Inflammatory arthritis and rheumatological evaluation",
    tests: [
      "Serum Uric Acid",
      "Rheumatoid Factor (RA Factor)",
      "Anti-Cyclic Citrullinated Peptide (Anti-CCP)",
      "C-Reactive Protein (CRP - Quantitative)",
      "Erythrocyte Sedimentation Rate (ESR)",
    ],
  },
  {
    id: "panel-anemia-vitamins",
    name: "Anemia & Vitamin Deficiency Panel",
    badge: "Nutrition",
    category: "Vitamins & Iron",
    description: "Investigation of chronic fatigue, lethargy, and nutritional deficiencies",
    tests: [
      "Complete Blood Count (CBC) & Hemoglobin",
      "Serum Ferritin",
      "Serum Vitamin B12",
      "Serum 25-Hydroxy Vitamin D3",
      "Iron Profile (Serum Iron, TIBC, % Transferrin Saturation)",
    ],
  },
  {
    id: "panel-abdomen",
    name: "Abdominal & Gastro Panel",
    badge: "Gastro",
    category: "Panels & Profiles",
    description: "Investigation for acute or chronic abdominal pain, dyspepsia, and jaundice",
    tests: [
      "Ultrasound Whole Abdomen & Pelvis (USG)",
      "Liver Function Test (LFT)",
      "Serum Amylase & Lipase",
      "Stool Routine & Occult Blood",
      "Urine Routine",
    ],
  },
  {
    id: "panel-preop",
    name: "Pre-Operative Surgical Clearance",
    badge: "Surgical",
    category: "Panels & Profiles",
    description: "Standard pre-anesthetic and pre-surgical safety investigations",
    tests: [
      "Complete Blood Count (CBC)",
      "Prothrombin Time (PT / INR)",
      "Blood Group & Rh",
      "Random Blood Sugar (RBS)",
      "Serum Creatinine & Blood Urea",
      "Viral Markers (HIV, HBsAg, HCV)",
      "12-Lead Electrocardiogram (ECG)",
      "Chest X-Ray (PA View)",
    ],
  },
  {
    id: "panel-opd-routine",
    name: "Routine OPD Basic Screen",
    badge: "Quick",
    category: "Panels & Profiles",
    description: "Standard general outpatient checkup for non-specific complaints",
    tests: [
      "Complete Blood Count (CBC)",
      "Urine Routine & Microscopy",
      "Random Blood Sugar (RBS)",
      "Serum Creatinine",
      "12-Lead Electrocardiogram (ECG)",
    ],
  },
];

export const INDIVIDUAL_LAB_TESTS: LabTestItem[] = [
  // --- Hematology ---
  {
    id: "test-cbc",
    name: "Complete Blood Count (CBC)",
    category: "Hematology",
    sampleType: "Blood (EDTA)",
    commonIndications: "Infection, anemia, platelet count, viral fever",
  },
  {
    id: "test-hb",
    name: "Hemoglobin (Hb%)",
    category: "Hematology",
    sampleType: "Blood (EDTA)",
    commonIndications: "Anemia, pallor, fatigue",
  },
  {
    id: "test-esr",
    name: "Erythrocyte Sedimentation Rate (ESR)",
    category: "Hematology",
    sampleType: "Blood (EDTA/Citrate)",
    commonIndications: "Inflammation, chronic infection, arthralgia",
  },
  {
    id: "test-platelets",
    name: "Platelet Count",
    category: "Hematology",
    sampleType: "Blood (EDTA)",
    commonIndications: "Dengue, bleeding diathesis, thrombocytopenia",
  },
  {
    id: "test-blood-group",
    name: "Blood Grouping & Rh Type",
    category: "Hematology",
    sampleType: "Blood (EDTA)",
    commonIndications: "Antenatal, pre-op, donor matching",
  },
  {
    id: "test-pt-inr",
    name: "Prothrombin Time & INR (PT/INR)",
    category: "Hematology",
    sampleType: "Blood (Citrate)",
    commonIndications: "Warfarin/anticoagulant monitoring, pre-op, liver disease",
  },
  {
    id: "test-peripheral-smear",
    name: "Peripheral Smear Examination",
    category: "Hematology",
    sampleType: "Blood (EDTA)",
    commonIndications: "Malignancy, atypical cells, hemolytic anemia",
  },

  // --- Biochemistry ---
  {
    id: "test-fbs",
    name: "Fasting Blood Sugar (FBS)",
    category: "Biochemistry",
    sampleType: "Blood (Fluoride)",
    fastingRequired: true,
    commonIndications: "Diabetes mellitus screening, fasting hyperglycemia",
  },
  {
    id: "test-ppbs",
    name: "Post-Prandial Blood Sugar (PPBS)",
    category: "Biochemistry",
    sampleType: "Blood (Fluoride)",
    commonIndications: "2-hour post-meal glycemic response in diabetics",
  },
  {
    id: "test-rbs",
    name: "Random Blood Sugar (RBS)",
    category: "Biochemistry",
    sampleType: "Blood (Fluoride/Serum)",
    commonIndications: "Immediate bedside glycemic status",
  },
  {
    id: "test-hba1c",
    name: "HbA1c (Glycated Hemoglobin)",
    category: "Biochemistry",
    sampleType: "Blood (EDTA)",
    commonIndications: "3-month average diabetic control monitoring",
  },
  {
    id: "test-creatinine",
    name: "Serum Creatinine",
    category: "Biochemistry",
    sampleType: "Blood (Serum)",
    commonIndications: "Renal clearance, drug dosing adjustment, hypertension",
  },
  {
    id: "test-blood-urea",
    name: "Blood Urea / BUN",
    category: "Biochemistry",
    sampleType: "Blood (Serum)",
    commonIndications: "Azotemia, dehydration, kidney function",
  },
  {
    id: "test-uric-acid",
    name: "Serum Uric Acid",
    category: "Biochemistry",
    sampleType: "Blood (Serum)",
    commonIndications: "Gout, hyperuricemia, joint swelling (first MTP)",
  },
  {
    id: "test-lipid-profile",
    name: "Fasting Lipid Profile",
    category: "Biochemistry",
    sampleType: "Blood (Serum)",
    fastingRequired: true,
    commonIndications: "Dyslipidemia, CAD, stroke risk, statin initiation",
  },
  {
    id: "test-lft",
    name: "Liver Function Test (LFT)",
    category: "Biochemistry",
    sampleType: "Blood (Serum)",
    commonIndications: "Jaundice, hepatitis, fatty liver, statin/ATT monitoring",
  },
  {
    id: "test-electrolytes",
    name: "Serum Electrolytes (Na+, K+, Cl-)",
    category: "Biochemistry",
    sampleType: "Blood (Serum)",
    commonIndications: "Diuretics, ACEi/ARB therapy, vomiting, diarrhea, weakness",
  },
  {
    id: "test-calcium",
    name: "Serum Calcium & Phosphorus",
    category: "Biochemistry",
    sampleType: "Blood (Serum)",
    commonIndications: "Bone pain, tetany, osteoporosis, hyperparathyroidism",
  },
  {
    id: "test-amylase",
    name: "Serum Amylase & Lipase",
    category: "Biochemistry",
    sampleType: "Blood (Serum)",
    commonIndications: "Acute pancreatitis, severe epigastric pain",
  },

  // --- Thyroid & Hormones ---
  {
    id: "test-tsh",
    name: "Thyroid Stimulating Hormone (TSH)",
    category: "Thyroid & Hormones",
    sampleType: "Blood (Serum)",
    commonIndications: "Hypothyroidism, weight gain, fatigue, thyroxine dosing",
  },
  {
    id: "test-ft3-ft4",
    name: "Free T3 & Free T4",
    category: "Thyroid & Hormones",
    sampleType: "Blood (Serum)",
    commonIndications: "Hyperthyroidism, pituitary disorder, abnormal TSH",
  },
  {
    id: "test-beta-hcg",
    name: "Serum Beta-hCG (Quantitative)",
    category: "Thyroid & Hormones",
    sampleType: "Blood (Serum)",
    commonIndications: "Pregnancy confirmation, ectopic pregnancy, trophoblastic disease",
  },
  {
    id: "test-prolactin",
    name: "Serum Prolactin",
    category: "Thyroid & Hormones",
    sampleType: "Blood (Serum)",
    commonIndications: "Galactorrhea, amenorrhea, pituitary adenoma",
  },

  // --- Infectious & Serology ---
  {
    id: "test-crp",
    name: "C-Reactive Protein (CRP)",
    category: "Infectious & Serology",
    sampleType: "Blood (Serum)",
    commonIndications: "Bacterial infection, inflammatory response, COVID/fever follow-up",
  },
  {
    id: "test-dengue-ns1",
    name: "Dengue NS1 Antigen & IgM/IgG",
    category: "Infectious & Serology",
    sampleType: "Blood (Serum)",
    commonIndications: "Acute febrile illness day 1-5, retro-orbital pain, myalgia",
  },
  {
    id: "test-widal",
    name: "Widal Slide Test (Typhoid)",
    category: "Infectious & Serology",
    sampleType: "Blood (Serum)",
    commonIndications: "Step-ladder continuous fever, enteric fever",
  },
  {
    id: "test-mp-smear",
    name: "Malarial Parasite (Smear & Dual Antigen)",
    category: "Infectious & Serology",
    sampleType: "Blood (EDTA)",
    commonIndications: "High fever with chills and rigors, sweating",
  },
  {
    id: "test-hiv",
    name: "HIV 1 & 2 Rapid Antibody",
    category: "Infectious & Serology",
    sampleType: "Blood (Serum)",
    commonIndications: "Pre-op, antenatal, occupational exposure",
  },
  {
    id: "test-hbsag",
    name: "Hepatitis B Surface Antigen (HBsAg)",
    category: "Infectious & Serology",
    sampleType: "Blood (Serum)",
    commonIndications: "Pre-op, blood transfusion, jaundice, hepatitis B screening",
  },
  {
    id: "test-hcv",
    name: "Anti-HCV Antibody",
    category: "Infectious & Serology",
    sampleType: "Blood (Serum)",
    commonIndications: "Hepatitis C screening, elevated liver enzymes",
  },
  {
    id: "test-ra-factor",
    name: "Rheumatoid Factor (RA Factor)",
    category: "Infectious & Serology",
    sampleType: "Blood (Serum)",
    commonIndications: "Symmetrical small joint morning stiffness, polyarthritis",
  },
  {
    id: "test-anti-ccp",
    name: "Anti-CCP Antibody",
    category: "Infectious & Serology",
    sampleType: "Blood (Serum)",
    commonIndications: "Specific confirmation of Rheumatoid Arthritis",
  },

  // --- Urine & Stool ---
  {
    id: "test-urine-routine",
    name: "Urine Routine & Microscopy (R/M)",
    category: "Urine & Stool",
    sampleType: "Fresh Mid-stream Urine",
    commonIndications: "UTI, proteinuria, hematuria, glycosuria, pus cells",
  },
  {
    id: "test-urine-culture",
    name: "Urine Culture & Antibiotic Sensitivity",
    category: "Urine & Stool",
    sampleType: "Sterile Mid-stream Urine",
    commonIndications: "Recurrent UTI, pyelonephritis, targeted antibiotic selection",
  },
  {
    id: "test-urine-microalbumin",
    name: "Urine Microalbumin / Albumin-Creatinine Ratio (ACR)",
    category: "Urine & Stool",
    sampleType: "Spot Urine",
    commonIndications: "Early diabetic nephropathy, hypertensive renal damage",
  },
  {
    id: "test-stool-routine",
    name: "Stool Routine & Microscopy",
    category: "Urine & Stool",
    sampleType: "Fresh Stool",
    commonIndications: "Diarrhea, dysentery, ova/cysts, parasites",
  },
  {
    id: "test-stool-occult",
    name: "Stool for Occult Blood (FOB)",
    category: "Urine & Stool",
    sampleType: "Fresh Stool",
    commonIndications: "GI bleeding, unexplained iron deficiency anemia, colorectal screen",
  },

  // --- Vitamins & Iron ---
  {
    id: "test-vit-d",
    name: "Serum 25-OH Vitamin D3",
    category: "Vitamins & Iron",
    sampleType: "Blood (Serum)",
    commonIndications: "Generalized body ache, osteoporosis, osteopenia, fatigue",
  },
  {
    id: "test-vit-b12",
    name: "Serum Vitamin B12",
    category: "Vitamins & Iron",
    sampleType: "Blood (Serum)",
    commonIndications: "Peripheral neuropathy, numbness, tingling, vegetarian diet",
  },
  {
    id: "test-ferritin",
    name: "Serum Ferritin",
    category: "Vitamins & Iron",
    sampleType: "Blood (Serum)",
    commonIndications: "Iron store depletion, microcytic hypochromic anemia",
  },
  {
    id: "test-iron-profile",
    name: "Iron Profile (Serum Iron, TIBC, % Transferrin)",
    category: "Vitamins & Iron",
    sampleType: "Blood (Serum)",
    commonIndications: "Detailed iron deficiency vs anemia of chronic disease",
  },

  // --- Radiology & Imaging ---
  {
    id: "test-ecg",
    name: "12-Lead Electrocardiogram (ECG)",
    category: "Radiology & Imaging",
    sampleType: "Diagnostic Procedure",
    commonIndications: "Chest pain, palpitations, hypertension, pre-operative",
  },
  {
    id: "test-xray-chest",
    name: "Chest X-Ray (PA View)",
    category: "Radiology & Imaging",
    sampleType: "Digital X-Ray",
    commonIndications: "Chronic cough, pneumonia, cardiomegaly, dyspnea",
  },
  {
    id: "test-usg-abdomen",
    name: "Ultrasound Whole Abdomen & Pelvis (USG)",
    category: "Radiology & Imaging",
    sampleType: "Ultrasound",
    commonIndications: "Abdominal pain, gallstones, fatty liver, renal calculi, pelvic mass",
  },
  {
    id: "test-usg-kub",
    name: "Ultrasound KUB (Kidney, Ureter, Bladder)",
    category: "Radiology & Imaging",
    sampleType: "Ultrasound",
    commonIndications: "Flank pain, hematuria, renal calculus, benign prostatic hyperplasia",
  },
  {
    id: "test-2d-echo",
    name: "2D Echocardiography with Doppler",
    category: "Radiology & Imaging",
    sampleType: "Ultrasound / Cardiac",
    commonIndications: "Heart failure, murmur, valvular disease, ejection fraction",
  },
  {
    id: "test-xray-knee",
    name: "X-Ray Both Knees (Standing AP & Lateral)",
    category: "Radiology & Imaging",
    sampleType: "Digital X-Ray",
    commonIndications: "Osteoarthritis, joint space narrowing, crepitus",
  },
  {
    id: "test-ct-brain",
    name: "CT Brain Plain",
    category: "Radiology & Imaging",
    sampleType: "Computed Tomography",
    commonIndications: "Head injury, stroke, acute severe headache, neurological deficit",
  },
];

/**
 * Smart search across lab panels and individual tests
 */
export function searchLabLibrary(query: string, categoryFilter: string = "All"): {
  panels: LabPanel[];
  tests: LabTestItem[];
} {
  const q = query.trim().toLowerCase();

  const filteredPanels = LAB_PANELS.filter((panel) => {
    if (categoryFilter !== "All" && categoryFilter !== "Panels & Profiles" && panel.category !== categoryFilter) {
      return false;
    }
    if (!q) return true;
    return (
      panel.name.toLowerCase().includes(q) ||
      panel.description.toLowerCase().includes(q) ||
      panel.tests.some((t) => t.toLowerCase().includes(q))
    );
  });

  const filteredTests = INDIVIDUAL_LAB_TESTS.filter((test) => {
    if (categoryFilter !== "All" && categoryFilter !== test.category) {
      return false;
    }
    if (!q) return true;
    return (
      test.name.toLowerCase().includes(q) ||
      test.category.toLowerCase().includes(q) ||
      (test.commonIndications && test.commonIndications.toLowerCase().includes(q))
    );
  });

  return {
    panels: filteredPanels,
    tests: filteredTests,
  };
}

/**
 * Helper to smartly merge new tests into an existing comma/newline delimited labTests string,
 * avoiding duplicate test entries.
 */
export function appendLabTests(currentTestsString: string, testsToAdd: string[]): string {
  // Parse existing tests (split by comma or newline)
  const existingTests = currentTestsString
    .split(/,|\n/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  const existingNormalized = new Set(existingTests.map((s) => s.toLowerCase()));

  const added: string[] = [];
  for (const t of testsToAdd) {
    const trimmed = t.trim();
    if (!trimmed) continue;
    if (!existingNormalized.has(trimmed.toLowerCase())) {
      existingNormalized.add(trimmed.toLowerCase());
      added.push(trimmed);
    }
  }

  const combined = [...existingTests, ...added];
  return combined.join(", ");
}
