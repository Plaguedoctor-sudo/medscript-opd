import { getSecurityConfig, isAuthenticated } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { LoginForm } from './LoginForm';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string }>;
}) {
  const { securityEnabled, doctorName, clinicName } = await getSecurityConfig();
  const authenticated = await isAuthenticated();
  const params = await searchParams;
  const redirectTarget = params?.redirect || '/';

  // If security is disabled, or doctor is already authenticated, go to dashboard
  if (!securityEnabled || authenticated) {
    redirect(redirectTarget);
  }

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col justify-center items-center p-4">
      <LoginForm doctorName={doctorName} clinicName={clinicName} />
      <div className="mt-6 text-center text-xs text-slate-400">
        MedScript OPD • Secure Clinical Outpatient Management
      </div>
    </div>
  );
}
