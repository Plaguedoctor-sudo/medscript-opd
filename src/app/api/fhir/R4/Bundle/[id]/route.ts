import { NextResponse } from 'next/server';
import { isAuthenticated, getCurrentUserRole } from '@/lib/auth';
import { db } from '@/db';
import { prescriptions, patients, clinicSettings } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { prescriptionToFhirBundle } from '@/lib/fhir/fhir-converter';
import { logAuditEvent } from '@/lib/audit';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authed = await isAuthenticated();
  const role = await getCurrentUserRole();

  if (!authed) {
    return NextResponse.json(
      {
        resourceType: 'OperationOutcome',
        issue: [
          {
            severity: 'error',
            code: 'login',
            diagnostics: 'Authentication required to access FHIR R4 Consultation Bundle.',
          },
        ],
      },
      { status: 401 }
    );
  }

  const { id } = await params;
  const prescriptionId = parseInt(id.replace(/^bundle-rx-/, '').replace(/^rx-/, ''), 10);

  if (isNaN(prescriptionId)) {
    return NextResponse.json(
      {
        resourceType: 'OperationOutcome',
        issue: [
          {
            severity: 'error',
            code: 'invalid',
            diagnostics: 'Invalid Prescription Bundle ID.',
          },
        ],
      },
      { status: 400 }
    );
  }

  try {
    const rx = await db.query.prescriptions.findFirst({
      where: eq(prescriptions.id, prescriptionId),
    });

    if (!rx) {
      return NextResponse.json(
        {
          resourceType: 'OperationOutcome',
          issue: [
            {
              severity: 'error',
              code: 'not-found',
              diagnostics: `Prescription #${prescriptionId} not found.`,
            },
          ],
        },
        { status: 404 }
      );
    }

    const patient = await db.query.patients.findFirst({
      where: eq(patients.id, rx.patientId),
    });

    if (!patient) {
      return NextResponse.json(
        {
          resourceType: 'OperationOutcome',
          issue: [
            {
              severity: 'error',
              code: 'not-found',
              diagnostics: `Patient #${rx.patientId} not found for this prescription.`,
            },
          ],
        },
        { status: 404 }
      );
    }

    const settings = await db.query.clinicSettings.findFirst({
      where: eq(clinicSettings.id, 1),
    });

    const bundle = prescriptionToFhirBundle({
      prescription: rx,
      patient,
      doctor: settings
        ? {
            name: settings.doctorName,
            regNumber: settings.regNumber,
          }
        : null,
    });

    await logAuditEvent({
      action: 'DATA_EXPORT_CONSULTATIONS',
      actorRole: role ? role.toUpperCase() : 'DOCTOR',
      details: `HL7 FHIR R4 Bundle exported for Prescription #${prescriptionId} (Patient: ${patient.name})`,
      status: 'SUCCESS',
    });

    return NextResponse.json(bundle, {
      status: 200,
      headers: {
        'Content-Type': 'application/fhir+json; charset=utf-8',
        'X-FHIR-Version': '4.0.1',
        'Content-Disposition': `inline; filename="fhir-bundle-rx-${prescriptionId}.json"`,
      },
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown FHIR internal error';
    return NextResponse.json(
      {
        resourceType: 'OperationOutcome',
        issue: [
          {
            severity: 'fatal',
            code: 'exception',
            diagnostics: errorMsg,
          },
        ],
      },
      { status: 500 }
    );
  }
}
