/**
 * Indian Academy of Pediatrics (IAP) National Immunization Timetable Engine
 * Generates structured, age-appropriate vaccination schedules with clinical routes and sites.
 */

export interface IapVaccineDefinition {
  vaccineName: string;
  vaccineCode: string;
  doseNumber: number;
  dueAgeMonths: number;
  site: string;
  route: 'Intramuscular (IM)' | 'Subcutaneous (SC)' | 'Oral' | 'Intradermal (ID)';
  description: string;
}

export const IAP_RECOMMENDED_VACCINES: IapVaccineDefinition[] = [
  // At Birth
  { vaccineName: 'BCG (Bacille Calmette-Guérin)', vaccineCode: 'BCG', doseNumber: 1, dueAgeMonths: 0, site: 'Left upper arm (deltoid)', route: 'Intradermal (ID)', description: 'Tuberculosis protection' },
  { vaccineName: 'Oral Polio Vaccine (OPV Zero Dose)', vaccineCode: 'OPV-0', doseNumber: 1, dueAgeMonths: 0, site: 'Oral drops', route: 'Oral', description: 'Poliovirus zero dose' },
  { vaccineName: 'Hepatitis B (Birth Dose)', vaccineCode: 'HEP-B-0', doseNumber: 1, dueAgeMonths: 0, site: 'Anterolateral thigh', route: 'Intramuscular (IM)', description: 'Perinatal Hep B prevention within 24h' },

  // 6 Weeks (1.5 Months)
  { vaccineName: 'DTwP / DTaP (Diphtheria, Tetanus, Pertussis 1)', vaccineCode: 'DTP-1', doseNumber: 1, dueAgeMonths: 1.5, site: 'Anterolateral thigh', route: 'Intramuscular (IM)', description: 'Primary triple antigen dose 1' },
  { vaccineName: 'Inactivated Polio Vaccine (IPV 1)', vaccineCode: 'IPV-1', doseNumber: 1, dueAgeMonths: 1.5, site: 'Right anterolateral thigh', route: 'Intramuscular (IM)', description: 'Injectable polio dose 1' },
  { vaccineName: 'Hepatitis B (Dose 1)', vaccineCode: 'HEP-B-1', doseNumber: 2, dueAgeMonths: 1.5, site: 'Anterolateral thigh', route: 'Intramuscular (IM)', description: 'Hep B infant dose 1' },
  { vaccineName: 'Haemophilus influenzae type b (Hib 1)', vaccineCode: 'HIB-1', doseNumber: 1, dueAgeMonths: 1.5, site: 'Anterolateral thigh', route: 'Intramuscular (IM)', description: 'Hib meningitis protection' },
  { vaccineName: 'Rotavirus Vaccine (RV 1)', vaccineCode: 'ROTA-1', doseNumber: 1, dueAgeMonths: 1.5, site: 'Oral drops', route: 'Oral', description: 'Severe diarrhea prevention' },
  { vaccineName: 'Pneumococcal Conjugate Vaccine (PCV 1)', vaccineCode: 'PCV-1', doseNumber: 1, dueAgeMonths: 1.5, site: 'Anterolateral thigh', route: 'Intramuscular (IM)', description: 'Pneumonia and bacteremia protection' },

  // 10 Weeks (2.5 Months)
  { vaccineName: 'DTwP / DTaP 2', vaccineCode: 'DTP-2', doseNumber: 2, dueAgeMonths: 2.5, site: 'Anterolateral thigh', route: 'Intramuscular (IM)', description: 'Primary triple antigen dose 2' },
  { vaccineName: 'Inactivated Polio Vaccine (IPV 2)', vaccineCode: 'IPV-2', doseNumber: 2, dueAgeMonths: 2.5, site: 'Right anterolateral thigh', route: 'Intramuscular (IM)', description: 'Injectable polio dose 2' },
  { vaccineName: 'Hib 2', vaccineCode: 'HIB-2', doseNumber: 2, dueAgeMonths: 2.5, site: 'Anterolateral thigh', route: 'Intramuscular (IM)', description: 'Hib meningitis dose 2' },
  { vaccineName: 'Rotavirus Vaccine 2', vaccineCode: 'ROTA-2', doseNumber: 2, dueAgeMonths: 2.5, site: 'Oral drops', route: 'Oral', description: 'Rotavirus dose 2' },
  { vaccineName: 'PCV 2', vaccineCode: 'PCV-2', doseNumber: 2, dueAgeMonths: 2.5, site: 'Anterolateral thigh', route: 'Intramuscular (IM)', description: 'Pneumococcal dose 2' },

  // 14 Weeks (3.5 Months)
  { vaccineName: 'DTwP / DTaP 3', vaccineCode: 'DTP-3', doseNumber: 3, dueAgeMonths: 3.5, site: 'Anterolateral thigh', route: 'Intramuscular (IM)', description: 'Primary triple antigen dose 3' },
  { vaccineName: 'Inactivated Polio Vaccine (IPV 3)', vaccineCode: 'IPV-3', doseNumber: 3, dueAgeMonths: 3.5, site: 'Right anterolateral thigh', route: 'Intramuscular (IM)', description: 'Injectable polio dose 3' },
  { vaccineName: 'Hib 3', vaccineCode: 'HIB-3', doseNumber: 3, dueAgeMonths: 3.5, site: 'Anterolateral thigh', route: 'Intramuscular (IM)', description: 'Hib meningitis dose 3' },
  { vaccineName: 'Rotavirus Vaccine 3', vaccineCode: 'ROTA-3', doseNumber: 3, dueAgeMonths: 3.5, site: 'Oral drops', route: 'Oral', description: 'Rotavirus dose 3' },
  { vaccineName: 'PCV 3', vaccineCode: 'PCV-3', doseNumber: 3, dueAgeMonths: 3.5, site: 'Anterolateral thigh', route: 'Intramuscular (IM)', description: 'Pneumococcal dose 3' },

  // 6 Months
  { vaccineName: 'Influenza (Flu Dose 1)', vaccineCode: 'FLU-1', doseNumber: 1, dueAgeMonths: 6, site: 'Anterolateral thigh', route: 'Intramuscular (IM)', description: 'Seasonal influenza protection' },
  { vaccineName: 'Typhoid Conjugate Vaccine (TCV)', vaccineCode: 'TCV-1', doseNumber: 1, dueAgeMonths: 6, site: 'Anterolateral thigh', route: 'Intramuscular (IM)', description: 'Enteric fever protection' },

  // 9 Months
  { vaccineName: 'MMR (Measles, Mumps, Rubella 1)', vaccineCode: 'MMR-1', doseNumber: 1, dueAgeMonths: 9, site: 'Right deltoid / thigh', route: 'Subcutaneous (SC)', description: 'Primary MMR vaccine' },
  { vaccineName: 'Oral Polio Vaccine Booster (OPV 1)', vaccineCode: 'OPV-B1', doseNumber: 2, dueAgeMonths: 9, site: 'Oral drops', route: 'Oral', description: 'Polio mucosal immunity booster' },

  // 12 Months (1 Year)
  { vaccineName: 'Hepatitis A (Live/Inactivated Dose 1)', vaccineCode: 'HEP-A-1', doseNumber: 1, dueAgeMonths: 12, site: 'Deltoid muscle', route: 'Intramuscular (IM)', description: 'Infectious hepatitis A dose 1' },
  { vaccineName: 'Japanese Encephalitis (JE 1)', vaccineCode: 'JE-1', doseNumber: 1, dueAgeMonths: 12, site: 'Deltoid / thigh', route: 'Subcutaneous (SC)', description: 'Endemic encephalitis protection' },

  // 15 Months
  { vaccineName: 'MMR 2', vaccineCode: 'MMR-2', doseNumber: 2, dueAgeMonths: 15, site: 'Right deltoid', route: 'Subcutaneous (SC)', description: 'Second MMR dose' },
  { vaccineName: 'Varicella (Chickenpox Dose 1)', vaccineCode: 'VAR-1', doseNumber: 1, dueAgeMonths: 15, site: 'Deltoid', route: 'Subcutaneous (SC)', description: 'Chickenpox primary dose' },
  { vaccineName: 'PCV Booster', vaccineCode: 'PCV-B', doseNumber: 4, dueAgeMonths: 15, site: 'Anterolateral thigh', route: 'Intramuscular (IM)', description: 'Pneumococcal booster' },

  // 16 to 18 Months
  { vaccineName: 'DTwP / DTaP Booster 1', vaccineCode: 'DTP-B1', doseNumber: 4, dueAgeMonths: 18, site: 'Deltoid muscle', route: 'Intramuscular (IM)', description: 'First DTP booster' },
  { vaccineName: 'IPV Booster', vaccineCode: 'IPV-B', doseNumber: 4, dueAgeMonths: 18, site: 'Deltoid muscle', route: 'Intramuscular (IM)', description: 'Polio booster' },
  { vaccineName: 'Hib Booster', vaccineCode: 'HIB-B', doseNumber: 4, dueAgeMonths: 18, site: 'Deltoid muscle', route: 'Intramuscular (IM)', description: 'Hib booster' },

  // 4 to 6 Years
  { vaccineName: 'DTwP / DTaP Booster 2', vaccineCode: 'DTP-B2', doseNumber: 5, dueAgeMonths: 60, site: 'Deltoid muscle', route: 'Intramuscular (IM)', description: 'Pre-school DTP booster' },
  { vaccineName: 'MMR 3', vaccineCode: 'MMR-3', doseNumber: 3, dueAgeMonths: 60, site: 'Deltoid', route: 'Subcutaneous (SC)', description: 'School entry MMR booster' },
  { vaccineName: 'Varicella Dose 2', vaccineCode: 'VAR-2', doseNumber: 2, dueAgeMonths: 60, site: 'Deltoid', route: 'Subcutaneous (SC)', description: 'Chickenpox booster' },

  // 10 to 12 Years
  { vaccineName: 'Tdap / Td (Tetanus, reduced Diphtheria, Pertussis)', vaccineCode: 'TDAP', doseNumber: 6, dueAgeMonths: 120, site: 'Deltoid muscle', route: 'Intramuscular (IM)', description: 'Adolescent booster' },
  { vaccineName: 'HPV (Human Papillomavirus - Dose 1 & 2)', vaccineCode: 'HPV', doseNumber: 1, dueAgeMonths: 120, site: 'Deltoid muscle', route: 'Intramuscular (IM)', description: 'Cervical cancer prevention' },
];

/**
 * Computes scheduled dates based on patient birth date.
 */
export function generateChildImmunizationSchedule(birthDate: Date) {
  const birthMs = birthDate.getTime();
  const msPerMonth = 30.4375 * 24 * 60 * 60 * 1000;

  return IAP_RECOMMENDED_VACCINES.map((v) => {
    const scheduledMs = birthMs + v.dueAgeMonths * msPerMonth;
    return {
      vaccineName: v.vaccineName,
      vaccineCode: v.vaccineCode,
      doseNumber: v.doseNumber,
      dueAgeMonths: v.dueAgeMonths,
      scheduledDate: new Date(scheduledMs),
      site: v.site,
      route: v.route,
      description: v.description,
      status: 'PENDING' as const,
    };
  });
}
