import { NextResponse } from 'next/server';
import { isAuthenticated, getCurrentUserRole, canDo } from '@/lib/auth';
import { db } from '@/db';
import { prescriptions, patients } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import { prescriptionToFhirBundle, FhirBundle, FhirMedicationRequest } from '@/lib/fhir/fhir-converter';
import { logAuditEvent } from '@/lib/audit';

export async function GET(request: Request) {
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
            diagnostics: 'Authentication required to access FHIR R4 MedicationRequest resources.',
          },
        ],
      },
      { status: 401 }
    );
  }

  if (!canDo(role, 'prescription:view')) {
    await logAuditEvent({
      action: 'PRESCRIPTION_VIEWED',
      actorRole: role.toUpperCase(),
      details: 'Unauthorized FHIR MedicationRequest access blocked (role lacks prescription:view)',
      status: 'FAILURE',
    });
    return NextResponse.json(
      {
        resourceType: 'OperationOutcome',
        issue: [
          {
            severity: 'error',
            code: 'forbidden',
            diagnostics: 'Forbidden: Insufficient privileges to query medication requests.',
          },
        ],
      },
      { status: 403 }
    );
  }

  const url = new URL(request.url);
  const patientParam = url.searchParams.get('patient');
  const idParam = url.searchParams.get('_id');

  try {
    let matchedPrescriptions: typeof prescriptions.$inferSelect[] = [];

    if (patientParam) {
      const cleanPatientId = parseInt(patientParam.replace(/^pt-/, ''), 10);
      if (!isNaN(cleanPatientId)) {
        matchedPrescriptions = await db
          .select()
          .from(prescriptions)
          .where(eq(prescriptions.patientId, cleanPatientId))
          .orderBy(desc(prescriptions.createdAt))
          .limit(20);
      }
    } else if (idParam) {
      const cleanRxId = parseInt(idParam.replace(/^rx-/, ''), 10);
      if (!isNaN(cleanRxId)) {
        matchedPrescriptions = await db
          .select()
          .from(prescriptions)
          .where(eq(prescriptions.id, cleanRxId))
          .limit(1);
      }
    } else {
      matchedPrescriptions = await db
        .select()
        .from(prescriptions)
        .orderBy(desc(prescriptions.createdAt))
        .limit(20);
    }

    const allMedRequests: FhirMedicationRequest[] = [];

    for (const rx of matchedPrescriptions) {
      const patient = await db.query.patients.findFirst({
        where: eq(patients.id, rx.patientId),
      });

      if (patient) {
        const bundle = prescriptionToFhirBundle({
          prescription: rx,
          patient,
        });

        for (const entry of bundle.entry) {
          if ((entry.resource as { resourceType?: string }).resourceType === 'MedicationRequest') {
            allMedRequests.push(entry.resource as FhirMedicationRequest);
          }
        }
      }
    }

    await logAuditEvent({
      action: 'PRESCRIPTION_VIEWED',
      actorRole: role ? role.toUpperCase() : 'DOCTOR',
      details: `FHIR R4 MedicationRequest search executed (${allMedRequests.length} resources returned)`,
      status: 'SUCCESS',
    });

    const bundle: FhirBundle = {
      resourceType: 'Bundle',
      id: `bundle-medreq-${Date.now()}`,
      meta: {
        lastUpdated: new Date().toISOString(),
      },
      type: 'searchset',
      total: allMedRequests.length,
      entry: allMedRequests.map((mr) => ({
        fullUrl: `https://medscript.org/fhir/R4/MedicationRequest/${mr.id}`,
        resource: mr,
      })),
    };

    return NextResponse.json(bundle, {
      status: 200,
      headers: {
        'Content-Type': 'application/fhir+json; charset=utf-8',
        'X-FHIR-Version': '4.0.1',
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
