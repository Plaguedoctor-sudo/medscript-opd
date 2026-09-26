/**
 * ICD-10-CM Clinical Diagnostic Database for OPD & Primary Care
 * Provides comprehensive standardized ICD-10 codes, descriptions, and categories.
 */

export interface ICD10Diagnosis {
  code: string;
  description: string;
  category: string;
  synonyms?: string[];
}

export const ICD10_DATABASE: ICD10Diagnosis[] = [
  // Respiratory
  {
    code: "J00",
    description: "Acute nasopharyngitis [Common cold]",
    category: "Respiratory",
    synonyms: ["common cold", "coryza", "runny nose", "rhinorrhea"],
  },
  {
    code: "J06.9",
    description: "Acute upper respiratory infection, unspecified (URTI)",
    category: "Respiratory",
    synonyms: ["urti", "uri", "upper respiratory tract infection", "throat infection"],
  },
  {
    code: "J02.9",
    description: "Acute pharyngitis, unspecified",
    category: "Respiratory",
    synonyms: ["sore throat", "pharyngitis"],
  },
  {
    code: "J03.90",
    description: "Acute tonsillitis, unspecified",
    category: "Respiratory",
    synonyms: ["tonsillitis", "inflamed tonsils"],
  },
  {
    code: "J01.90",
    description: "Acute sinusitis, unspecified",
    category: "Respiratory",
    synonyms: ["sinusitis", "sinus infection"],
  },
  {
    code: "J20.9",
    description: "Acute bronchitis, unspecified",
    category: "Respiratory",
    synonyms: ["chest cold", "acute bronchitis"],
  },
  {
    code: "J45.909",
    description: "Unspecified asthma, uncomplicated",
    category: "Respiratory",
    synonyms: ["asthma", "bronchial asthma", "wheezing"],
  },
  {
    code: "J44.9",
    description: "Chronic obstructive pulmonary disease (COPD), unspecified",
    category: "Respiratory",
    synonyms: ["copd", "chronic bronchitis", "emphysema"],
  },
  {
    code: "J18.9",
    description: "Pneumonia, unspecified organism",
    category: "Respiratory",
    synonyms: ["chest infection", "pneumonia", "consolidation"],
  },
  {
    code: "J30.9",
    description: "Allergic rhinitis, unspecified",
    category: "Respiratory",
    synonyms: ["hay fever", "allergic rhinitis", "sneezing", "nasal allergy"],
  },
  {
    code: "R05",
    description: "Cough, unspecified",
    category: "Respiratory",
    synonyms: ["cough", "dry cough", "wet cough"],
  },

  // Cardiovascular
  {
    code: "I10",
    description: "Essential (primary) hypertension",
    category: "Cardiovascular",
    synonyms: ["htn", "high blood pressure", "hypertension", "bp high"],
  },
  {
    code: "I25.10",
    description: "Atherosclerotic heart disease of native coronary artery (CAD)",
    category: "Cardiovascular",
    synonyms: ["cad", "coronary artery disease", "ischemic heart disease", "ihd"],
  },
  {
    code: "I20.9",
    description: "Angina pectoris, unspecified",
    category: "Cardiovascular",
    synonyms: ["chest pain", "cardiac chest pain", "angina"],
  },
  {
    code: "I50.9",
    description: "Heart failure, unspecified",
    category: "Cardiovascular",
    synonyms: ["chf", "congestive heart failure", "cardiac failure"],
  },
  {
    code: "I48.91",
    description: "Unspecified atrial fibrillation",
    category: "Cardiovascular",
    synonyms: ["afib", "a-fib", "arrhythmia", "irregular heartbeat"],
  },
  {
    code: "I87.2",
    description: "Venous insufficiency (chronic) (peripheral)",
    category: "Cardiovascular",
    synonyms: ["varicose veins", "venous stasis", "leg swelling"],
  },

  // Endocrine & Metabolic
  {
    code: "E11.9",
    description: "Type 2 diabetes mellitus without complications",
    category: "Endocrine & Metabolic",
    synonyms: ["t2dm", "diabetes", "type 2 diabetes", "sugar", "high sugar"],
  },
  {
    code: "E11.65",
    description: "Type 2 diabetes mellitus with hyperglycemia",
    category: "Endocrine & Metabolic",
    synonyms: ["uncontrolled diabetes", "high blood sugar", "hyperglycemia"],
  },
  {
    code: "E10.9",
    description: "Type 1 diabetes mellitus without complications",
    category: "Endocrine & Metabolic",
    synonyms: ["t1dm", "insulin dependent diabetes"],
  },
  {
    code: "E03.9",
    description: "Hypothyroidism, unspecified",
    category: "Endocrine & Metabolic",
    synonyms: ["thyroid low", "hypothyroid", "elevated tsh"],
  },
  {
    code: "E05.90",
    description: "Thyrotoxicosis / Hyperthyroidism without thyrotoxic crisis",
    category: "Endocrine & Metabolic",
    synonyms: ["hyperthyroid", "overactive thyroid"],
  },
  {
    code: "E78.5",
    description: "Hyperlipidemia, unspecified / Dyslipidemia",
    category: "Endocrine & Metabolic",
    synonyms: ["high cholesterol", "cholesterol", "dyslipidemia", "hypercholesterolemia"],
  },
  {
    code: "E66.9",
    description: "Obesity, unspecified",
    category: "Endocrine & Metabolic",
    synonyms: ["obese", "overweight", "high bmi"],
  },
  {
    code: "E79.0",
    description: "Hyperuricemia without signs of arthritis and tophaceous disease",
    category: "Endocrine & Metabolic",
    synonyms: ["high uric acid", "gout screening"],
  },

  // Gastrointestinal
  {
    code: "A09",
    description: "Infectious gastroenteritis and colitis, unspecified",
    category: "Gastrointestinal",
    synonyms: ["gastroenteritis", "food poisoning", "loose stools", "diarrhea", "vomiting"],
  },
  {
    code: "K21.9",
    description: "Gastro-esophageal reflux disease without esophagitis (GERD)",
    category: "Gastrointestinal",
    synonyms: ["gerd", "acid reflux", "heartburn", "hyperacidity"],
  },
  {
    code: "K29.70",
    description: "Gastritis, unspecified, without bleeding",
    category: "Gastrointestinal",
    synonyms: ["gastritis", "acidity", "indigestion", "dyspepsia", "epigastric burning"],
  },
  {
    code: "K30",
    description: "Functional dyspepsia",
    category: "Gastrointestinal",
    synonyms: ["indigestion", "bloating", "burping", "dyspepsia"],
  },
  {
    code: "K58.9",
    description: "Irritable bowel syndrome without diarrhea (IBS)",
    category: "Gastrointestinal",
    synonyms: ["ibs", "irritable bowel", "spastic colon"],
  },
  {
    code: "K59.00",
    description: "Constipation, unspecified",
    category: "Gastrointestinal",
    synonyms: ["constipation", "irregular bowels"],
  },
  {
    code: "K64.9",
    description: "Hemorrhoids, unspecified",
    category: "Gastrointestinal",
    synonyms: ["piles", "hemorrhoids", "bleeding per rectum"],
  },
  {
    code: "K76.0",
    description: "Fatty (change of) liver, not elsewhere classified (NAFLD)",
    category: "Gastrointestinal",
    synonyms: ["fatty liver", "nafld", "grade 1 fatty liver"],
  },
  {
    code: "K02.9",
    description: "Dental caries, unspecified",
    category: "Gastrointestinal",
    synonyms: ["tooth decay", "tooth ache", "cavity"],
  },
  {
    code: "K12.0",
    description: "Recurrent aphthous stomatitis",
    category: "Gastrointestinal",
    synonyms: ["mouth ulcer", "aphthous ulcer", "canker sore"],
  },

  // Infectious Disease
  {
    code: "B34.9",
    description: "Viral infection, unspecified / Viral fever",
    category: "Infectious Disease",
    synonyms: ["viral fever", "viral infection", "viral pyrexia", "flu"],
  },
  {
    code: "R50.9",
    description: "Fever, unspecified (Pyrexia of unknown origin)",
    category: "Infectious Disease",
    synonyms: ["fever", "pyrexia", "hyperthermia", "high temp"],
  },
  {
    code: "A01.00",
    description: "Typhoid fever, unspecified",
    category: "Infectious Disease",
    synonyms: ["enteric fever", "typhoid", "salmonella"],
  },
  {
    code: "A90",
    description: "Dengue fever [classical dengue]",
    category: "Infectious Disease",
    synonyms: ["dengue", "breakbone fever", "low platelets"],
  },
  {
    code: "B54",
    description: "Unspecified malaria",
    category: "Infectious Disease",
    synonyms: ["malaria", "plasmodium", "chills and rigor"],
  },
  {
    code: "B01.9",
    description: "Varicella without complication [Chickenpox]",
    category: "Infectious Disease",
    synonyms: ["chickenpox", "varicella"],
  },
  {
    code: "B02.9",
    description: "Zoster without complications [Herpes Zoster]",
    category: "Infectious Disease",
    synonyms: ["shingles", "herpes zoster"],
  },

  // Genitourinary & Renal
  {
    code: "N39.0",
    description: "Urinary tract infection, site not specified (UTI)",
    category: "Genitourinary",
    synonyms: ["uti", "urine infection", "burning urination", "dysuria"],
  },
  {
    code: "N20.0",
    description: "Calculus of kidney (Nephrolithiasis)",
    category: "Genitourinary",
    synonyms: ["kidney stone", "renal calculus", "flank pain"],
  },
  {
    code: "N40.0",
    description: "Benign prostatic hyperplasia without lower urinary tract symptoms",
    category: "Genitourinary",
    synonyms: ["bph", "enlarged prostate", "prostate"],
  },
  {
    code: "N92.6",
    description: "Irregular menstruation, unspecified",
    category: "Genitourinary",
    synonyms: ["irregular periods", "menstrual irregularity", "oligomenorrhea"],
  },
  {
    code: "N94.6",
    description: "Dysmenorrhea, unspecified",
    category: "Genitourinary",
    synonyms: ["painful periods", "menstrual cramps", "dysmenorrhea"],
  },
  {
    code: "N76.0",
    description: "Acute vaginitis / Vaginal discharge",
    category: "Genitourinary",
    synonyms: ["vaginitis", "leukorrhea", "vaginal discharge"],
  },

  // Musculoskeletal & Joint
  {
    code: "M54.5",
    description: "Low back pain (Lumbago)",
    category: "Musculoskeletal",
    synonyms: ["back pain", "lumbago", "lumbar spondylosis", "slip disc"],
  },
  {
    code: "M54.2",
    description: "Cervicalgia (Neck pain)",
    category: "Musculoskeletal",
    synonyms: ["neck pain", "cervical spondylosis", "stiff neck"],
  },
  {
    code: "M17.9",
    description: "Osteoarthritis of knee, unspecified",
    category: "Musculoskeletal",
    synonyms: ["knee pain", "oa knee", "osteoarthritis", "joint wear"],
  },
  {
    code: "M79.1",
    description: "Myalgia (Muscle pain)",
    category: "Musculoskeletal",
    synonyms: ["body ache", "muscle pain", "myalgia", "generalized ache"],
  },
  {
    code: "M25.50",
    description: "Pain in unspecified joint (Arthralgia)",
    category: "Musculoskeletal",
    synonyms: ["joint pain", "arthralgia", "polyarthralgia"],
  },
  {
    code: "M10.9",
    description: "Gout, unspecified",
    category: "Musculoskeletal",
    synonyms: ["gouty arthritis", "gout", "acute podagra", "big toe pain"],
  },
  {
    code: "M06.9",
    description: "Rheumatoid arthritis, unspecified",
    category: "Musculoskeletal",
    synonyms: ["ra", "rheumatoid", "morning stiffness"],
  },
  {
    code: "M81.0",
    description: "Age-related osteoporosis without current pathological fracture",
    category: "Musculoskeletal",
    synonyms: ["osteoporosis", "weak bones", "low bone density"],
  },
  {
    code: "M77.10",
    description: "Lateral epicondylitis, unspecified elbow [Tennis elbow]",
    category: "Musculoskeletal",
    synonyms: ["tennis elbow", "lateral epicondylitis", "elbow pain"],
  },
  {
    code: "M72.2",
    description: "Plantar fascial fibromatosis [Plantar fasciitis]",
    category: "Musculoskeletal",
    synonyms: ["heel pain", "plantar fasciitis"],
  },

  // Neurological & Psychiatric
  {
    code: "G43.909",
    description: "Migraine, unspecified, not intractable, without status migrainosus",
    category: "Neurology",
    synonyms: ["migraine", "hemicrania", "one sided headache", "vascular headache"],
  },
  {
    code: "G44.209",
    description: "Tension-type headache, unspecified",
    category: "Neurology",
    synonyms: ["tension headache", "stress headache", "tight band headache"],
  },
  {
    code: "R51",
    description: "Headache, unspecified",
    category: "Neurology",
    synonyms: ["headache", "cephalgia"],
  },
  {
    code: "R42",
    description: "Dizziness and giddiness (Vertigo)",
    category: "Neurology",
    synonyms: ["vertigo", "dizziness", "spinning", "lightheadedness", "bppv"],
  },
  {
    code: "G47.00",
    description: "Insomnia, unspecified",
    category: "Neurology",
    synonyms: ["sleeplessness", "insomnia", "poor sleep"],
  },
  {
    code: "F41.9",
    description: "Anxiety disorder, unspecified",
    category: "Psychiatry",
    synonyms: ["anxiety", "panic", "nervousness", "palpitations"],
  },
  {
    code: "F32.9",
    description: "Major depressive disorder, single episode, unspecified",
    category: "Psychiatry",
    synonyms: ["depression", "low mood", "sadness"],
  },

  // Dermatology
  {
    code: "L20.9",
    description: "Atopic dermatitis, unspecified (Eczema)",
    category: "Dermatology",
    synonyms: ["eczema", "atopic dermatitis", "skin allergy", "itchy skin"],
  },
  {
    code: "L50.9",
    description: "Urticaria, unspecified (Hives)",
    category: "Dermatology",
    synonyms: ["urticaria", "hives", "rash", "wheals"],
  },
  {
    code: "B35.9",
    description: "Dermatophytosis, unspecified (Fungal infection / Tinea)",
    category: "Dermatology",
    synonyms: ["ringworm", "tinea", "fungal infection", "itching"],
  },
  {
    code: "L70.0",
    description: "Acne vulgaris",
    category: "Dermatology",
    synonyms: ["acne", "pimples", "facial breakouts"],
  },
  {
    code: "L08.9",
    description: "Local infection of the skin and subcutaneous tissue, unspecified",
    category: "Dermatology",
    synonyms: ["boil", "furuncle", "folliculitis", "skin infection", "pyoderma"],
  },
  {
    code: "B86",
    description: "Scabies",
    category: "Dermatology",
    synonyms: ["scabies", "night itching", "burrows"],
  },
  {
    code: "L23.9",
    description: "Allergic contact dermatitis, unspecified cause",
    category: "Dermatology",
    synonyms: ["contact dermatitis", "cosmetic allergy", "cement allergy"],
  },

  // ENT & Ophthalmology
  {
    code: "H10.9",
    description: "Unspecified conjunctivitis (Pink eye)",
    category: "Eye & ENT",
    synonyms: ["conjunctivitis", "red eye", "pink eye", "eye discharge"],
  },
  {
    code: "H00.019",
    description: "Hordeolum externum [Stye] of unspecified eyelid",
    category: "Eye & ENT",
    synonyms: ["stye", "eyelid boil", "hordeolum"],
  },
  {
    code: "H66.90",
    description: "Otitis media, unspecified",
    category: "Eye & ENT",
    synonyms: ["ear infection", "ear discharge", "middle ear infection"],
  },
  {
    code: "H60.90",
    description: "Otitis externa, unspecified",
    category: "Eye & ENT",
    synonyms: ["swimmer's ear", "ear canal infection", "ear pain"],
  },
  {
    code: "H93.19",
    description: "Tinnitus, unspecified ear",
    category: "Eye & ENT",
    synonyms: ["ringing in ear", "tinnitus", "buzzing ear"],
  },
  {
    code: "R04.0",
    description: "Epistaxis (Nosebleed)",
    category: "Eye & ENT",
    synonyms: ["nose bleed", "epistaxis"],
  },

  // General, Nutrition & Systemic
  {
    code: "D50.9",
    description: "Iron deficiency anemia, unspecified",
    category: "General & Nutrition",
    synonyms: ["anemia", "low hemoglobin", "iron deficiency", "fatigue"],
  },
  {
    code: "E55.9",
    description: "Vitamin D deficiency, unspecified",
    category: "General & Nutrition",
    synonyms: ["vitamin d deficiency", "low vit d", "hypovitaminosis d"],
  },
  {
    code: "E53.8",
    description: "Deficiency of other specified B group vitamins (Vitamin B12 deficiency)",
    category: "General & Nutrition",
    synonyms: ["b12 deficiency", "vitamin b12", "neuropathy", "tingling"],
  },
  {
    code: "R53.83",
    description: "Other fatigue (Generalized weakness / Malaise)",
    category: "General & Nutrition",
    synonyms: ["weakness", "lethargy", "fatigue", "tiredness", "malaise"],
  },
  {
    code: "R10.9",
    description: "Unspecified abdominal pain",
    category: "General & Nutrition",
    synonyms: ["stomach ache", "belly pain", "abdominal cramps"],
  },
  {
    code: "R11.2",
    description: "Nausea with vomiting, unspecified",
    category: "General & Nutrition",
    synonyms: ["nausea", "vomiting", "emesis"],
  },
  {
    code: "Z00.00",
    description: "General adult medical examination without abnormal findings",
    category: "General & Preventive",
    synonyms: ["general checkup", "health screening", "routine checkup", "fitness"],
  },
  {
    code: "Z23",
    description: "Encounter for immunization",
    category: "General & Preventive",
    synonyms: ["vaccination", "immunization", "flu shot", "tetanus"],
  },
];

/**
 * Searches the ICD-10 database by code, description, category, or clinical synonyms.
 */
export function searchICD10(query: string, limit = 12): ICD10Diagnosis[] {
  if (!query || !query.trim()) {
    return ICD10_DATABASE.slice(0, limit);
  }

  const q = query.trim().toLowerCase();

  return ICD10_DATABASE.filter((item) => {
    if (item.code.toLowerCase().includes(q)) return true;
    if (item.description.toLowerCase().includes(q)) return true;
    if (item.category.toLowerCase().includes(q)) return true;
    if (item.synonyms?.some((s) => s.toLowerCase().includes(q))) return true;
    return false;
  }).slice(0, limit);
}

/**
 * Formats an ICD-10 diagnosis into a standardized clinical string:
 * "[I10] Essential (primary) hypertension"
 */
export function formatICD10Diagnosis(diag: ICD10Diagnosis): string {
  return `[${diag.code}] ${diag.description}`;
}
