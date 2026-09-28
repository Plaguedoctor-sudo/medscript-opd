import { describe, it, expect } from 'vitest';
import { checkDrugAllergies } from '../allergy-checker';
import { Medication } from '@/types';

describe('Allergy Conflict Engine', () => {
  it('detects Penicillin allergy with Amoxicillin brand/generic', () => {
    const meds: Medication[] = [
      {
        name: 'Moxikind-CV 625',
        genericName: 'Amoxicillin + Clavulanic Acid',
        strength: '625mg',
        dosage: '1-0-1',
        timing: 'After food',
        duration: '5 days',
      },
    ];

    const conflicts = checkDrugAllergies('Penicillin allergy since childhood', meds);
    expect(conflicts.length).toBeGreaterThan(0);
    expect(conflicts[0].severity).toBe('CRITICAL');
    expect(conflicts[0].matchedMedication).toContain('Moxikind-CV');
  });

  it('detects NSAID allergy with Diclofenac/Ibuprofen', () => {
    const meds: Medication[] = [
      {
        name: 'Voveran 50',
        genericName: 'Diclofenac Sodium',
        strength: '50mg',
        dosage: '1-0-1',
        timing: 'After food',
        duration: '3 days',
      },
    ];

    const conflicts = checkDrugAllergies('Known allergy to NSAIDs and pain killers', meds);
    expect(conflicts.length).toBeGreaterThan(0);
    expect(conflicts[0].severity).toBe('CRITICAL');
  });

  it('returns empty array when no allergies exist or no conflict found', () => {
    const meds: Medication[] = [
      {
        name: 'Azithral 500',
        genericName: 'Azithromycin',
        strength: '500mg',
        dosage: '1-0-0',
        timing: 'Before food',
        duration: '3 days',
      },
    ];

    expect(checkDrugAllergies('', meds)).toEqual([]);
    expect(checkDrugAllergies('Penicillin', meds)).toEqual([]);
  });
});
