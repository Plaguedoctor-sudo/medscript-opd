import { notFound } from 'next/navigation';
import { requireAuth, getCurrentUserRole, getSecurityConfig } from '@/lib/auth';
import { getInvoiceDetails } from '../actions';
import { InvoiceView } from './InvoiceView';
import { getSecurityAlerts } from '@/lib/security-engine';
import Link from 'next/link';
import { ChevronLeft, Receipt, Users, BarChart3, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { UserRoleBadge } from '@/components/UserRoleBadge';
import { SecurityAlertBell } from '@/components/SecurityAlertBell';
import { LockDeskButton } from '@/components/LockDeskButton';
import { PrivacyShield } from '@/components/PrivacyShield';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function InvoicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAuth('/billing');
  const resolvedParams = await params;
  const invoiceId = parseInt(resolvedParams.id, 10);

  if (isNaN(invoiceId)) {
    notFound();
  }

  const [invoiceData, { securityEnabled }, role, securityAlertsData] = await Promise.all([
    getInvoiceDetails(invoiceId),
    getSecurityConfig(),
    getCurrentUserRole(),
    getSecurityAlerts({ unacknowledgedOnly: false, limit: 30 }),
  ]);

  if (!invoiceData) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-slate-50 print:bg-white print:min-h-0">
      {/* Top Navbar (Hidden when printing) */}
      <nav className="print:hidden bg-white border-b shadow-2xs sticky top-0 z-10">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/billing" className="flex items-center gap-2 text-slate-600 hover:text-slate-900 transition-colors">
              <ChevronLeft className="w-5 h-5" />
            </Link>
            <Link href="/" className="flex items-center gap-2.5">
              <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center shadow-2xs">
                <Receipt className="text-white w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-bold text-slate-900 tracking-tight">MedScript OPD</span>
                  <span className="text-xs bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full font-semibold border border-emerald-200">
                    Receipt #{invoiceData.invoice.invoiceNo}
                  </span>
                </div>
              </div>
            </Link>
          </div>

          <div className="flex items-center gap-2.5">
            <UserRoleBadge role={role} securityEnabled={securityEnabled} />
            <PrivacyShield />
            <SecurityAlertBell initialStats={securityAlertsData} />
            <Link href="/billing">
              <Button variant="ghost" size="sm" className="gap-1.5 text-xs text-emerald-700 bg-emerald-50">
                <Receipt className="w-4 h-4" /> Billing
              </Button>
            </Link>
            <Link href="/patients">
              <Button variant="ghost" size="sm" className="gap-1.5 text-xs text-slate-600">
                <Users className="w-4 h-4" /> Patients
              </Button>
            </Link>
            <Link href="/reports">
              <Button variant="ghost" size="sm" className="gap-1.5 text-xs text-slate-600">
                <BarChart3 className="w-4 h-4 text-blue-600" /> Reports
              </Button>
            </Link>
            <Link href="/settings">
              <Button variant="ghost" size="sm" className="gap-1.5 text-xs text-slate-600">
                <Settings className="w-4 h-4" /> Settings
              </Button>
            </Link>
            {securityEnabled && <LockDeskButton />}
          </div>
        </div>
      </nav>

      <main className="container mx-auto px-4 py-8 max-w-4xl print:p-0 print:m-0 print:max-w-none">
        <InvoiceView
          invoice={invoiceData.invoice}
          patient={invoiceData.patient}
          settings={invoiceData.settings}
          prescriptionDetails={invoiceData.prescriptionDetails}
        />
      </main>
    </div>
  );
}
