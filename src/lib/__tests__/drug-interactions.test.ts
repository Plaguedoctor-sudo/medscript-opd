import { describe, it, expect } from 'vitest';
import { checkDrugInteractions } from '../drug-interactions';
import { Medication } from '@/types';

describe('Drug Interaction Engine', () => {
  it('detects CRITICAL hyperkalemia risk between ARB (Telmisartan) and Spironolactone', () => {
    const meds: Medication[] = [
      {
        name: 'Telmisartan 40',
        genericName: 'Telmisartan',
        strength: '40mg',
        dosage: '1-0-0',
        timing: 'Morning',
        duration: '30 days',
      },
      {
        name: 'Aldactone 25',
        genericName: 'Spironolactone',
        strength: '25mg',
        dosage: '1-0-0',
        timing: 'Morning',
        duration: '30 days',
      },
    ];

    const interactions = checkDrugInteractions(meds);
    expect(interactions.length).toBeGreaterThan(0);
    const critical = interactions.find((i) => i.severity === 'CRITICAL');
    expect(critical).toBeDefined();
    expect(critical?.title).toContain('Hyperkalemia');
  });

  it('detects interaction between Quinolone and Calcium/Iron chelation', () => {
    const meds: Medication[] = [
      {
        name: 'Cifran 500',
        genericName: 'Ciprofloxacin',
        strength: '500mg',
        dosage: '1-0-1',
        timing: 'After food',
        duration: '5 days',
      },
      {
        name: 'Shelcal 500',
        genericName: 'Calcium + Vitamin D3',
        strength: '500mg',
        dosage: '0-0-1',
        timing: 'After food',
        duration: '30 days',
      },
    ];

    const interactions = checkDrugInteractions(meds);
    expect(interactions.length).toBeGreaterThan(0);
    expect(interactions[0].title).toContain('Chelation');
  });

  it('returns empty list when medications do not interact', () => {
    const meds: Medication[] = [
      {
        name: 'Paracetamol 650',
        genericName: 'Paracetamol',
        strength: '650mg',
        dosage: '1-0-1',
        timing: 'SOS',
        duration: '3 days',
      },
      {
        name: 'Pantocid 40',
        genericName: 'Pantoprazole',
        strength: '40mg',
        dosage: '1-0-0',
        timing: 'Before food',
        duration: '5 days',
      },
    ];

    const interactions = checkDrugInteractions(meds);
    expect(interactions).toEqual([]);
  });
});
