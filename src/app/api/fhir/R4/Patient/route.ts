import { NextResponse } from 'next/server';
import { isAuthenticated, getCurrentUserRole } from '@/lib/auth';
import { db } from '@/db';
import { patients } from '@/db/schema';
import { eq, like, or } from 'drizzle-orm';
import { patientToFhir, FhirBundle } from '@/lib/fhir/fhir-converter';
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
            diagnostics: 'Authentication required to access FHIR R4 Patient resources.',
          },
        ],
      },
      { status: 401 }
    );
  }

  const url = new URL(request.url);
  const idParam = url.searchParams.get('_id') || url.searchParams.get('id');
  const identifierParam = url.searchParams.get('identifier');
  const nameParam = url.searchParams.get('name');

  try {
    let rows: typeof patients.$inferSelect[] = [];

    if (idParam) {
      const cleanId = parseInt(idParam.replace(/^pt-/, ''), 10);
      if (!isNaN(cleanId)) {
        rows = await db.select().from(patients).where(eq(patients.id, cleanId)).limit(1);
      }
    } else if (identifierParam) {
      rows = await db
        .select()
        .from(patients)
        .where(
          or(
            eq(patients.regNo, identifierParam),
            eq(patients.abhaId, identifierParam),
            eq(patients.phone, identifierParam)
          )
        )
        .limit(20);
    } else if (nameParam) {
      rows = await db
        .select()
        .from(patients)
        .where(like(patients.name, `%${nameParam}%`))
        .limit(20);
    } else {
      // Default: recent 20 patients
      rows = await db.select().from(patients).limit(20);
    }

    const fhirPatients = rows.map((p) => patientToFhir(p));

    await logAuditEvent({
      action: 'PATIENT_VIEWED',
      actorRole: role ? role.toUpperCase() : 'DOCTOR',
      details: `FHIR R4 Patient search executed (${rows.length} resources returned)`,
      status: 'SUCCESS',
    });

    const bundle: FhirBundle = {
      resourceType: 'Bundle',
      id: `bundle-patients-${Date.now()}`,
      meta: {
        lastUpdated: new Date().toISOString(),
      },
      type: 'searchset',
      total: fhirPatients.length,
      entry: fhirPatients.map((p) => ({
        fullUrl: `https://medscript.org/fhir/R4/Patient/${p.id}`,
        resource: p,
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
