import { getSecurityConfig, isAuthenticated } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { LoginForm } from './LoginForm';
import { getStaffUsers } from './actions';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string; switch?: string }>;
}) {
  const { securityEnabled, doctorName, clinicName } = await getSecurityConfig();
  const authenticated = await isAuthenticated();
  const params = await searchParams;
  const redirectTarget = params?.redirect || '/';
  const isSwitchingAccount = params?.switch === 'true';

  // If already authenticated and not explicitly switching accounts, go to destination
  if (authenticated && !isSwitchingAccount && securityEnabled) {
    redirect(redirectTarget);
  }

  const staffUsers = await getStaffUsers();

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col justify-center items-center p-4">
      <LoginForm
        doctorName={doctorName}
        clinicName={clinicName}
        initialStaffUsers={staffUsers}
      />
      <div className="mt-6 text-center text-xs text-slate-400">
        MedScript OPD • Multi-Role Sovereign Hospital Information Management System
      </div>
    </div>
  );
}
