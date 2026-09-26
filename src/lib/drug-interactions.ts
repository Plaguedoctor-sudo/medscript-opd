/**
 * Clinical Drug-Drug Interaction (DDI) Checker Engine
 * Evaluates prescription medications for clinical contraindications,
 * synergistic toxicities, QTc prolongation, chelation, and bleeding risks.
 */

import { Medication } from '@/types';

export type InteractionSeverity = 'CRITICAL' | 'HIGH' | 'MODERATE' | 'CAUTION';

export interface DrugInteraction {
  id: string;
  drugA: string;
  drugB: string;
  severity: InteractionSeverity;
  title: string;
  mechanism: string;
  recommendation: string;
}

interface InteractionRule {
  id: string;
  matchA: RegExp;
  matchB: RegExp;
  severity: InteractionSeverity;
  title: string;
  mechanism: string;
  recommendation: string;
}

const INTERACTION_RULES: InteractionRule[] = [
  // 1. Aspirin + NSAIDs
  {
    id: 'aspirin-nsaid',
    matchA: /aspirin|ecosprin/i,
    matchB: /ibuprofen|diclofenac|aceclofenac|naproxen|mefenamic/i,
    severity: 'HIGH',
    title: 'Aspirin + NSAID: Synergistic Gastric Ulceration & Reduced Cardioprotection',
    mechanism: 'NSAIDs block Aspirin access to COX-1 platelet binding sites, blunting cardioprotective antiplatelet effect, while synergistically increasing GI bleeding risk.',
    recommendation: 'Avoid concurrent NSAID therapy. If mandatory, take immediate-release Aspirin at least 2 hours before the NSAID, and prescribe a PPI (Pantoprazole).',
  },

  // 2. Dual Antiplatelet / Anticoagulant Risk (Aspirin + Clopidogrel)
  {
    id: 'aspirin-clopidogrel',
    matchA: /aspirin|ecosprin/i,
    matchB: /clopidogrel|clopilet|deplatt/i,
    severity: 'MODERATE',
    title: 'Dual Antiplatelet Therapy (DAPT): Increased Bleeding Risk',
    mechanism: 'Additive inhibition of platelet aggregation increases the risk of major systemic and gastrointestinal hemorrhage.',
    recommendation: 'Ensure indication justifies DAPT (e.g. post-PCI/ACS). Co-prescribe gastroprotection (PPI) and counsel patient to report signs of bleeding.',
  },

  // 3. Clopidogrel + Omeprazole
  {
    id: 'clopidogrel-omeprazole',
    matchA: /clopidogrel|clopilet|deplatt/i,
    matchB: /omeprazole(?!.*panto)/i,
    severity: 'MODERATE',
    title: 'Clopidogrel + Omeprazole: Reduced Antiplatelet Efficacy',
    mechanism: 'Omeprazole strongly inhibits CYP2C19, significantly reducing metabolic activation of Clopidogrel to its active antiplatelet form.',
    recommendation: 'Switch gastroprotective agent to Pantoprazole or Rabeprazole, which exhibit significantly less CYP2C19 inhibition.',
  },

  // 4. ACEi / ARB + NSAID (Renal Triad component)
  {
    id: 'raas-nsaid',
    matchA: /telmisartan|losartan|enalapril|ramipril/i,
    matchB: /ibuprofen|diclofenac|aceclofenac|naproxen|mefenamic/i,
    severity: 'HIGH',
    title: 'ACEi/ARB + NSAID: Nephrotoxicity & Loss of BP Control',
    mechanism: 'NSAIDs constrict the afferent renal arteriole while ACEi/ARBs dilate the efferent arteriole, sharply dropping glomerular filtration rate (GFR).',
    recommendation: 'Avoid prolonged concurrent NSAIDs in hypertensive/diabetic patients. Use Paracetamol for analgesia; monitor serum creatinine and BP.',
  },

  // 5. ACEi / ARB + Spironolactone / Potassium Sparing
  {
    id: 'raas-potassium',
    matchA: /telmisartan|losartan|enalapril|ramipril/i,
    matchB: /spironolactone|eplerenone|potassium/i,
    severity: 'CRITICAL',
    title: 'ACEi/ARB + Potassium-Sparing Diuretic: Severe Hyperkalemia Risk',
    mechanism: 'Concurrent blockade of aldosterone axis synergistically suppresses renal potassium excretion, risking life-threatening hyperkalemic arrhythmias.',
    recommendation: 'Regularly monitor serum potassium (target < 5.0 mEq/L) and renal function. Counsel against potassium dietary supplements or salt substitutes.',
  },

  // 6. Fluoroquinolones + Polyvalent Cation Chelation (Calcium / Iron / Zinc)
  {
    id: 'quinolone-cation',
    matchA: /ciprofloxacin|ofloxacin|levofloxacin|moxifloxacin/i,
    matchB: /calcium|shelcal|ferrous|iron|zinc|sucralfate|antacid/i,
    severity: 'HIGH',
    title: 'Fluoroquinolone + Polyvalent Cations: Chelation & Reduced Absorption',
    mechanism: 'Divalent and trivalent cations form insoluble chelate complexes with quinolone antibiotics in the gut lumen, reducing absorption by up to 80%.',
    recommendation: 'Administer the fluoroquinolone antibiotic at least 2 hours before or 4-6 hours after calcium, iron, zinc, or sucralfate.',
  },

  // 7. QTc Prolongation Risk (Macrolide / Quinolone + Ondansetron)
  {
    id: 'qtc-macrolide-ondansetron',
    matchA: /azithromycin|moxifloxacin|ciprofloxacin|clarithromycin/i,
    matchB: /ondansetron|emset|zofran/i,
    severity: 'HIGH',
    title: 'Macrolide/Quinolone + Ondansetron: Cumulative QTc Prolongation Risk',
    mechanism: 'Additive cardiac hERG potassium channel blockade prolongs ventricular repolarization, predisposing to Torsades de Pointes or arrhythmia.',
    recommendation: 'Exercise caution in patients with baseline prolonged QT, cardiac disease, or electrolyte imbalance. Use lowest effective antiemetic dose.',
  },

  // 8. Beta Blocker + Calcium Channel Blocker (Bradycardia / AV Block)
  {
    id: 'betablocker-ccb',
    matchA: /metoprolol|atenolol|bisoprolol|carvedilol/i,
    matchB: /verapamil|diltiazem/i,
    severity: 'CRITICAL',
    title: 'Beta-Blocker + Non-Dihydropyridine CCB: Severe Bradycardia & AV Block',
    mechanism: 'Synergistic negative inotropic and dromotropic cardiac depression can precipitate complete heart block, acute heart failure, and cardiogenic shock.',
    recommendation: 'Combination is contraindicated in routine primary care OPD. If rate control required, switch CCB to Dihydropyridine (Amlodipine) with monitoring.',
  },

  // 9. Tramadol + Serotonergic Agents
  {
    id: 'tramadol-serotonin',
    matchA: /tramadol|ultram/i,
    matchB: /escitalopram|sertraline|fluoxetine|linezolid|duloxetine/i,
    severity: 'CRITICAL',
    title: 'Tramadol + Serotonergic Drug: Serotonin Syndrome & Seizure Risk',
    mechanism: 'Tramadol inhibits serotonin and norepinephrine reuptake; combined with SSRIs or MAOIs/Linezolid, it can induce severe Serotonin Syndrome.',
    recommendation: 'Avoid combination. Consider alternative non-serotonergic analgesics (Paracetamol, topical analgesics). Monitor for hyperreflexia, tremor, fever.',
  },

  // 10. Levothyroxine + Multivalent Minerals (Calcium / Iron)
  {
    id: 'thyroxine-minerals',
    matchA: /levothyroxine|thyronorm|eltroxin/i,
    matchB: /calcium|shelcal|ferrous|iron|feronia/i,
    severity: 'MODERATE',
    title: 'Levothyroxine + Calcium/Iron: Decreased Thyroid Absorption',
    mechanism: 'Calcium carbonate and iron salts physically bind levothyroxine in the stomach, leading to treatment failure and uncontrolled hypothyroidism.',
    recommendation: 'Levothyroxine must be taken on an empty stomach 30-60 minutes before breakfast; schedule Calcium/Iron at least 4 hours later.',
  },

  // 11. Sulfonylurea + Quinolone (Hypoglycemia Risk)
  {
    id: 'sulfonylurea-quinolone',
    matchA: /glimepiride|gliclazide|glipizide/i,
    matchB: /ciprofloxacin|levofloxacin|ofloxacin/i,
    severity: 'MODERATE',
    title: 'Sulfonylurea + Fluoroquinolone: Unpredictable Dysglycemia / Severe Hypoglycemia',
    mechanism: 'Fluoroquinolones stimulate pancreatic beta-cell potassium ATP channel closure, amplifying sulfonylurea-induced insulin secretion.',
    recommendation: 'Instruct diabetic patient to monitor blood glucose closely. Have oral carbohydrates / glucose readily available.',
  },

  // 12. Multiple Paracetamol duplicate risk
  {
    id: 'paracetamol-duplicate',
    matchA: /paracetamol|acetaminophen|calpol|dolo/i,
    matchB: /paracetamol|acetaminophen|calpol|dolo/i,
    severity: 'HIGH',
    title: 'Paracetamol Duplicate Therapy: Acute Hepatotoxicity Risk',
    mechanism: 'Combining multiple combination products containing Paracetamol (e.g. Dolo + Tramadol/APAP or Aceclo-Para) risks exceeding safe 4g daily maximum.',
    recommendation: 'Verify total daily elemental Paracetamol does not exceed 3-4 grams to avoid acute hepatic necrosis.',
  },
];

/**
 * Scans a list of prescribed medications for pairwise interactions.
 */
export function checkDrugInteractions(medications: Medication[]): DrugInteraction[] {
  if (!medications || medications.length < 2) return [];

  const detected: DrugInteraction[] = [];
  const seenPairs = new Set<string>();

  for (let i = 0; i < medications.length; i++) {
    for (let j = i + 1; j < medications.length; j++) {
      const medA = medications[i];
      const medB = medications[j];

      // Combine name + genericName for comprehensive text matching
      const textA = `${medA.name} ${medA.genericName || ''}`.trim();
      const textB = `${medB.name} ${medB.genericName || ''}`.trim();

      if (!textA || !textB) continue;

      for (const rule of INTERACTION_RULES) {
        // Special case for duplicate paracetamol: only trigger if two distinct entries match
        if (rule.id === 'paracetamol-duplicate') {
          if (rule.matchA.test(textA) && rule.matchB.test(textB)) {
            const pairKey = `${rule.id}-${i}-${j}`;
            if (!seenPairs.has(pairKey)) {
              seenPairs.add(pairKey);
              detected.push({
                id: rule.id,
                drugA: medA.name,
                drugB: medB.name,
                severity: rule.severity,
                title: rule.title,
                mechanism: rule.mechanism,
                recommendation: rule.recommendation,
              });
            }
          }
          continue;
        }

        // Check A -> B or B -> A
        const matchForward = rule.matchA.test(textA) && rule.matchB.test(textB);
        const matchReverse = rule.matchA.test(textB) && rule.matchB.test(textA);

        if (matchForward || matchReverse) {
          const pairKey = [textA, textB, rule.id].sort().join('::');
          if (!seenPairs.has(pairKey)) {
            seenPairs.add(pairKey);
            detected.push({
              id: rule.id,
              drugA: matchForward ? medA.name : medB.name,
              drugB: matchForward ? medB.name : medA.name,
              severity: rule.severity,
              title: rule.title,
              mechanism: rule.mechanism,
              recommendation: rule.recommendation,
            });
          }
        }
      }
    }
  }

  // Sort: CRITICAL first, then HIGH, then MODERATE
  const order: Record<InteractionSeverity, number> = {
    CRITICAL: 1,
    HIGH: 2,
    MODERATE: 3,
    CAUTION: 4,
  };

  return detected.sort((a, b) => order[a.severity] - order[b.severity]);
}
