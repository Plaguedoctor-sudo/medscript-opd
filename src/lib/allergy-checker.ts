export interface AllergyConflict {
  allergen: string;
  matchedMedication: string;
  severity: 'CRITICAL' | 'HIGH' | 'MODERATE';
  mechanism: string;
  recommendation: string;
}

interface DrugAllergyClass {
  classId: string;
  aliases: string[]; // Patterns in patient allergy string
  drugKeywords: string[]; // Patterns in medicine brand/generic name
  severity: 'CRITICAL' | 'HIGH';
  mechanism: string;
  recommendation: string;
}

const ALLERGY_CLASSES: DrugAllergyClass[] = [
  {
    classId: 'PENICILLINS',
    aliases: ['penicillin', 'penicillins', 'amox', 'amoxicillin', 'ampicillin', 'augmentin', 'beta-lactam', 'betalactam'],
    drugKeywords: [
      'amoxicillin',
      'ampicillin',
      'augmentin',
      'penicillin',
      'piperacillin',
      'cloxacillin',
      'amox',
      'co-amoxiclav',
      'moxikind',
      'novamox',
      'bactoclav',
    ],
    severity: 'CRITICAL',
    mechanism: 'Type 1 IgE-mediated anaphylaxis / angioedema risk',
    recommendation: 'Strictly avoid penicillins. Consider macrolides (e.g. Azithromycin) or fluoroquinolones.',
  },
  {
    classId: 'CEPHALOSPORINS',
    aliases: ['cephalosporin', 'cephalosporins', 'ceftriaxone', 'cefixime', 'cefpodoxime', 'cefuroxime', 'monocef'],
    drugKeywords: [
      'ceftriaxone',
      'cefixime',
      'cefpodoxime',
      'cefuroxime',
      'cephalexin',
      'cefepime',
      'cefotaxime',
      'monocef',
      'zifi',
      'taxim',
      'ceftum',
    ],
    severity: 'CRITICAL',
    mechanism: 'Cross-reactive beta-lactam cephalosporin hypersensitivity',
    recommendation: 'Contraindicated if previous severe penicillin/cephalosporin anaphylaxis.',
  },
  {
    classId: 'NSAIDS',
    aliases: ['nsaid', 'nsaids', 'diclofenac', 'ibuprofen', 'aceclofenac', 'aspirin', 'painkiller', 'pain killers', 'voveran'],
    drugKeywords: [
      'diclofenac',
      'ibuprofen',
      'aceclofenac',
      'naproxen',
      'piroxicam',
      'mefenamic',
      'indomethacin',
      'ketorolac',
      'aspirin',
      'voveran',
      'zerodol',
      'combiflam',
      'meftal',
      'hifenac',
      'etoricoxib',
    ],
    severity: 'CRITICAL',
    mechanism: 'COX-1 inhibition leading to bronchospasm, urticaria, or anaphylactoid reaction',
    recommendation: 'Avoid non-steroidal anti-inflammatory agents. Consider Paracetamol (if tolerated) or Tramadol.',
  },
  {
    classId: 'SULFA',
    aliases: ['sulfa', 'sulfonamide', 'sulfamethoxazole', 'bactrim', 'septran', 'cotrimoxazole'],
    drugKeywords: [
      'sulfamethoxazole',
      'cotrimoxazole',
      'septran',
      'bactrim',
      'sulfasalazine',
      'dapsone',
      'silver sulfadiazine',
    ],
    severity: 'CRITICAL',
    mechanism: 'Sulfonamide arylamine hypersensitivity (Stevens-Johnson syndrome / toxic epidermal necrolysis risk)',
    recommendation: 'Strictly avoid sulfonamides and cotrimoxazole formulations.',
  },
  {
    classId: 'PARACETAMOL',
    aliases: ['paracetamol', 'acetaminophen', 'dolo', 'calpol', 'crocin'],
    drugKeywords: ['paracetamol', 'acetaminophen', 'dolo', 'calpol', 'crocin', 'pacimol', 'sumo'],
    severity: 'HIGH',
    mechanism: 'Acetaminophen idiosyncratic hepatic or cutaneous hypersensitivity',
    recommendation: 'Avoid paracetamol products. Consider non-cross-reactive analgesia.',
  },
  {
    classId: 'FLUOROQUINOLONES',
    aliases: ['ciprofloxacin', 'quinolone', 'fluoroquinolone', 'levofloxacin', 'ofloxacin'],
    drugKeywords: ['ciprofloxacin', 'levofloxacin', 'ofloxacin', 'norfloxacin', 'moxifloxacin', 'ciro', 'levomac', 'zanocin'],
    severity: 'HIGH',
    mechanism: 'Fluoroquinolone tendonitis and systemic allergic reaction',
    recommendation: 'Avoid quinolone class antibiotics.',
  },
  {
    classId: 'MACROLIDES',
    aliases: ['azithromycin', 'erythromycin', 'clarithromycin', 'macrolide', 'zithromax', 'azee'],
    drugKeywords: ['azithromycin', 'clarithromycin', 'erythromycin', 'roxitromycin', 'azee', 'zithro', 'klacid'],
    severity: 'HIGH',
    mechanism: 'Macrolide antibiotic hypersensitivity / QT prolongation risk',
    recommendation: 'Avoid macrolide class antibiotics.',
  },
];

/**
 * Checks if a prescribed medication conflicts with any documented patient allergies.
 */
export function checkDrugAllergyConflict(
  patientAllergies: string | null | undefined,
  medicationName: string
): AllergyConflict | null {
  if (!patientAllergies || !patientAllergies.trim() || !medicationName || !medicationName.trim()) {
    return null;
  }

  const cleanAllergies = patientAllergies.toLowerCase();
  const cleanMed = medicationName.toLowerCase();

  for (const allergyClass of ALLERGY_CLASSES) {
    // Check if patient's allergy string mentions this allergy class
    const patientHasThisAllergy = allergyClass.aliases.some((alias) =>
      cleanAllergies.includes(alias)
    );

    if (patientHasThisAllergy) {
      // Check if prescribed medication contains any keywords of this class
      const medicineMatches = allergyClass.drugKeywords.some((kw) =>
        cleanMed.includes(kw)
      );

      if (medicineMatches) {
        return {
          allergen: allergyClass.classId,
          matchedMedication: medicationName,
          severity: allergyClass.severity,
          mechanism: allergyClass.mechanism,
          recommendation: allergyClass.recommendation,
        };
      }
    }
  }

  // Fallback: Direct substring match (e.g. patient is allergic to "aspirin" and doctor prescribes "Aspirin 75mg")
  const allergyTokens = cleanAllergies
    .split(/[,;\n/]+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 3);

  for (const token of allergyTokens) {
    if (cleanMed.includes(token)) {
      return {
        allergen: token.toUpperCase(),
        matchedMedication: medicationName,
        severity: 'HIGH',
        mechanism: `Direct match with patient's documented allergy "${token}"`,
        recommendation: `Confirm safety or choose alternative non-allergic molecule.`,
      };
    }
  }

  return null;
}
