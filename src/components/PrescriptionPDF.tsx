'use client'

import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer';
import { ClinicSettings, Medication, Patient, Prescription } from '@/types';

const styles = StyleSheet.create({
  page: {
    padding: 36,
    fontSize: 9.5,
    fontFamily: 'Helvetica',
    color: '#1e293b',
    lineHeight: 1.4,
  },
  header: {
    borderBottomWidth: 2,
    borderBottomColor: '#2563eb',
    borderBottomStyle: 'solid',
    paddingBottom: 12,
    marginBottom: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  doctorInfo: {
    flexDirection: 'column',
    maxWidth: '45%',
  },
  drName: {
    fontSize: 16,
    fontFamily: 'Helvetica-Bold',
    color: '#1e40af',
    marginBottom: 2,
  },
  drQualifications: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: '#334155',
    marginBottom: 2,
  },
  drReg: {
    fontSize: 8.5,
    color: '#64748b',
  },
  logoContainer: {
    width: 65,
    height: 65,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    maxWidth: 60,
    maxHeight: 60,
    objectFit: 'contain',
  },
  clinicInfo: {
    textAlign: 'right',
    maxWidth: '45%',
  },
  clinicName: {
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
    color: '#0f172a',
    marginBottom: 2,
  },
  clinicAddress: {
    fontSize: 8.5,
    color: '#475569',
    marginBottom: 1,
  },
  clinicContact: {
    fontSize: 8.5,
    color: '#475569',
  },
  patientBar: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderStyle: 'solid',
    borderRadius: 4,
    padding: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  patientBarCol: {
    flexDirection: 'column',
    gap: 2,
  },
  patientName: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: '#0f172a',
  },
  patientMeta: {
    fontSize: 8.5,
    color: '#475569',
  },
  vitalsBar: {
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    borderStyle: 'solid',
    borderRadius: 4,
    padding: 6,
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 12,
  },
  vitalItem: {
    fontSize: 8.5,
    color: '#1e3a8a',
  },
  vitalLabel: {
    fontFamily: 'Helvetica-Bold',
  },
  clinicalSection: {
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: '#1e40af',
    marginBottom: 3,
    borderBottomWidth: 0.5,
    borderBottomColor: '#cbd5e1',
    borderBottomStyle: 'solid',
    paddingBottom: 2,
  },
  sectionContent: {
    fontSize: 9,
    color: '#334155',
  },
  rxHeaderTitle: {
    fontSize: 13,
    fontFamily: 'Helvetica-Bold',
    color: '#1e40af',
    marginTop: 8,
    marginBottom: 4,
  },
  rxTable: {
    marginTop: 4,
    marginBottom: 12,
  },
  rxHeaderRow: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#cbd5e1',
    borderStyle: 'solid',
    paddingVertical: 5,
    paddingHorizontal: 4,
  },
  rxHeaderCell: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 8.5,
    color: '#334155',
  },
  rxRow: {
    flexDirection: 'row',
    paddingVertical: 6,
    paddingHorizontal: 4,
    borderBottomWidth: 0.5,
    borderBottomColor: '#e2e8f0',
    borderStyle: 'solid',
  },
  colNum: { width: '5%' },
  colMed: { width: '38%' },
  colStrength: { width: '14%' },
  colDosage: { width: '15%' },
  colTiming: { width: '16%' },
  colDuration: { width: '12%' },
  medName: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 9.5,
    color: '#0f172a',
  },
  twoColSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 16,
    marginTop: 4,
  },
  twoColLeft: {
    flex: 1,
  },
  twoColRight: {
    width: '45%',
  },
  signatureContainer: {
    marginTop: 20,
    alignItems: 'flex-end',
  },
  signatureLine: {
    width: 140,
    borderTopWidth: 1,
    borderTopColor: '#64748b',
    borderTopStyle: 'solid',
    marginTop: 40,
    paddingTop: 4,
    textAlign: 'center',
    fontSize: 8.5,
    fontFamily: 'Helvetica-Bold',
    color: '#334155',
  },
  footer: {
    position: 'absolute',
    bottom: 24,
    left: 36,
    right: 36,
    borderTopWidth: 0.5,
    borderTopColor: '#e2e8f0',
    borderTopStyle: 'solid',
    paddingTop: 6,
    flexDirection: 'row',
    justifyContent: 'space-between',
    fontSize: 7.5,
    color: '#94a3b8',
  },
});

interface PrescriptionPDFProps {
  prescription: Prescription;
  patient: Patient;
  settings: ClinicSettings;
}

export const PrescriptionPDF = ({ prescription, patient, settings }: PrescriptionPDFProps) => {
  let medications: Medication[] = [];
  try {
    medications = JSON.parse(prescription.medications || '[]');
  } catch {
    medications = [];
  }

  const hasVitals =
    prescription.bp || prescription.pulse || prescription.weight || prescription.temp || prescription.spo2;

  const formatDateSafe = (dateVal: string | Date | null | undefined) => {
    if (!dateVal) return '';
    try {
      if (typeof dateVal === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateVal)) {
        const [y, m, d] = dateVal.split('-').map(Number);
        const date = new Date(y, m - 1, d);
        return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
      }
      const d = new Date(dateVal);
      if (isNaN(d.getTime())) return String(dateVal);
      return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    } catch {
      return String(dateVal);
    }
  };

  const dateFormatted = prescription.createdAt
    ? formatDateSafe(prescription.createdAt)
    : new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });

  // Safe check for @react-pdf/renderer compatible image (PNG and JPEG only; WebP causes 'Network error while fetching resources')
  const isSafePdfLogo =
    typeof settings.logoUrl === 'string' &&
    settings.logoUrl.length > 30 &&
    !settings.logoUrl.startsWith('data:image/webp') &&
    (settings.logoUrl.startsWith('data:image/png') ||
      settings.logoUrl.startsWith('data:image/jpeg') ||
      settings.logoUrl.startsWith('data:image/jpg') ||
      settings.logoUrl.startsWith('http://') ||
      settings.logoUrl.startsWith('https://'));

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.doctorInfo}>
            <Text style={styles.drName}>{settings.doctorName || 'Doctor Name'}</Text>
            <Text style={styles.drQualifications}>{settings.qualifications || ''}</Text>
            <Text style={styles.drReg}>Reg. No: {settings.regNumber || 'N/A'}</Text>
          </View>

          {isSafePdfLogo && (
            <View style={styles.logoContainer}>
              {/* eslint-disable-next-line jsx-a11y/alt-text */}
              <Image src={settings.logoUrl!} style={styles.logo} />
            </View>
          )}

          <View style={styles.clinicInfo}>
            <Text style={styles.clinicName}>{settings.clinicName || 'Clinic Name'}</Text>
            <Text style={styles.clinicAddress}>{settings.address || ''}</Text>
            <Text style={styles.clinicContact}>Contact: {settings.contact || 'N/A'}</Text>
          </View>
        </View>

        {/* Patient Bar */}
        <View style={styles.patientBar}>
          <View style={styles.patientBarCol}>
            <Text style={styles.patientName}>{patient.name}</Text>
            <Text style={styles.patientMeta}>
              Age: {patient.age}y &nbsp;|&nbsp; Gender: {patient.gender}
              {patient.regNo ? ` | Reg. No: ${patient.regNo}` : ''}
              {patient.phone ? ` | Phone: ${patient.phone}` : ''}
              {patient.abhaId ? ` | ABHA ID: ${patient.abhaId}` : ''}
            </Text>
          </View>
          <View style={[styles.patientBarCol, { alignItems: 'flex-end' }]}>
            <Text style={[styles.patientMeta, { fontFamily: 'Helvetica-Bold', color: '#0f172a' }]}>
              Prescription #{prescription.id}
            </Text>
            <Text style={styles.patientMeta}>Date: {dateFormatted}</Text>
          </View>
        </View>

        {/* Vitals */}
        {hasVitals && (
          <View style={styles.vitalsBar}>
            {prescription.weight && (
              <Text style={styles.vitalItem}>
                <Text style={styles.vitalLabel}>Weight: </Text>
                {prescription.weight} kg
              </Text>
            )}
            {prescription.bp && (
              <Text style={styles.vitalItem}>
                <Text style={styles.vitalLabel}>BP: </Text>
                {prescription.bp} mmHg
              </Text>
            )}
            {prescription.pulse && (
              <Text style={styles.vitalItem}>
                <Text style={styles.vitalLabel}>Pulse: </Text>
                {prescription.pulse} bpm
              </Text>
            )}
            {prescription.temp && (
              <Text style={styles.vitalItem}>
                <Text style={styles.vitalLabel}>Temp: </Text>
                {prescription.temp.includes("°") ? prescription.temp : `${prescription.temp} °C`}
              </Text>
            )}
            {prescription.spo2 && (
              <Text style={styles.vitalItem}>
                <Text style={styles.vitalLabel}>SPO2: </Text>
                {prescription.spo2}%
              </Text>
            )}
          </View>
        )}

        {/* Clinical Info: Complaints & History */}
        {(prescription.chiefComplaints || prescription.clinicalHistory) && (
          <View style={styles.clinicalSection}>
            {prescription.chiefComplaints && (
              <View style={{ marginBottom: 4 }}>
                <Text style={styles.sectionTitle}>Chief Complaints</Text>
                <Text style={styles.sectionContent}>{prescription.chiefComplaints}</Text>
              </View>
            )}
            {prescription.clinicalHistory && (
              <View style={{ marginBottom: 4 }}>
                <Text style={styles.sectionTitle}>Clinical History</Text>
                <Text style={styles.sectionContent}>{prescription.clinicalHistory}</Text>
              </View>
            )}
          </View>
        )}

        {/* Diagnosis */}
        {prescription.diagnosis && (
          <View style={styles.clinicalSection}>
            <Text style={styles.sectionTitle}>Diagnosis</Text>
            <Text style={[styles.sectionContent, { fontFamily: 'Helvetica-Bold', color: '#1e3a8a' }]}>
              {prescription.diagnosis}
            </Text>
          </View>
        )}

        {/* Rx Section */}
        <Text style={styles.rxHeaderTitle}>℞ Prescribed Medications</Text>
        <View style={styles.rxTable}>
          <View style={styles.rxHeaderRow}>
            <Text style={[styles.rxHeaderCell, styles.colNum]}>#</Text>
            <Text style={[styles.rxHeaderCell, styles.colMed]}>Medicine Name</Text>
            <Text style={[styles.rxHeaderCell, styles.colStrength]}>Strength</Text>
            <Text style={[styles.rxHeaderCell, styles.colDosage]}>Dosage</Text>
            <Text style={[styles.rxHeaderCell, styles.colTiming]}>Timing</Text>
            <Text style={[styles.rxHeaderCell, styles.colDuration]}>Duration</Text>
          </View>
          {medications.length === 0 ? (
            <View style={styles.rxRow}>
              <Text style={{ fontSize: 9, color: '#94a3b8', fontStyle: 'italic' }}>
                No medications prescribed.
              </Text>
            </View>
          ) : (
            medications.map((med, i) => (
              <View key={i} style={styles.rxRow}>
                <Text style={[styles.sectionContent, styles.colNum]}>{i + 1}</Text>
                <View style={styles.colMed}>
                  <Text style={styles.medName}>
                    {med.prefix ? `${med.prefix} ` : ''}{med.name}
                  </Text>
                  {med.genericName ? (
                    <Text style={{ fontSize: 7.5, color: '#475569', fontStyle: 'italic', marginTop: 1 }}>
                      ({med.genericName.toUpperCase()})
                    </Text>
                  ) : null}
                  {med.instruction ? (
                    <Text style={{ fontSize: 7, color: '#64748b', fontStyle: 'italic', marginTop: 1 }}>
                      {med.instruction}
                    </Text>
                  ) : null}
                </View>
                <Text style={[styles.sectionContent, styles.colStrength]}>{med.strength || '-'}</Text>
                <Text style={[styles.sectionContent, styles.colDosage]}>{med.dosage || '-'}</Text>
                <Text style={[styles.sectionContent, styles.colTiming]}>{med.timing || '-'}</Text>
                <Text style={[styles.sectionContent, styles.colDuration]}>{med.duration || '-'}</Text>
              </View>
            ))
          )}
        </View>

        {/* Advice & Follow Up */}
        <View style={styles.twoColSection}>
          <View style={styles.twoColLeft}>
            {prescription.advice && (
              <View style={{ marginBottom: 8 }}>
                <Text style={styles.sectionTitle}>Advice / Diet Instructions</Text>
                <Text style={styles.sectionContent}>{prescription.advice}</Text>
              </View>
            )}
            {prescription.labTests && (
              <View style={{ marginBottom: 8 }}>
                <Text style={styles.sectionTitle}>Investigations Recommended</Text>
                <Text style={styles.sectionContent}>{prescription.labTests}</Text>
              </View>
            )}
            {prescription.followUpDate && (
              <View style={{ marginTop: 6 }}>
                <Text style={{ fontSize: 9.5, fontFamily: 'Helvetica-Bold', color: '#1e40af' }}>
                  Next Follow-up Date: {formatDateSafe(prescription.followUpDate)}
                </Text>
              </View>
            )}
          </View>

          {/* Doctor Signature Block */}
          <View style={styles.twoColRight}>
            <View style={styles.signatureContainer}>
              <View style={styles.signatureLine}>
                <Text>{settings.doctorName || 'Authorized Signatory'}</Text>
                <Text style={{ fontSize: 7.5, color: '#64748b' }}>{"Doctor's Signature / Seal"}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text>
            {`MedScript OPD • Digital Rx Seal: ${prescription.signatureHash ? `MS-${prescription.signatureHash.slice(0, 4).toUpperCase()}-${prescription.signatureHash.slice(4, 8).toUpperCase()}-${prescription.signatureHash.slice(8, 12).toUpperCase()}` : `RX-${prescription.id}`} • Valid Electronic Prescription`}
          </Text>
          <Text>Page 1 of 1</Text>
        </View>
      </Page>
    </Document>
  );
};
