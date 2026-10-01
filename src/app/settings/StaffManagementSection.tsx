'use client';

import React, { useState, useTransition } from 'react';
import { SafeStaffUser, UserRole } from '@/types';
import {
  createStaffUser,
  updateStaffUser,
  toggleStaffUserStatus,
  deleteStaffUser,
} from '@/app/login/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from '@/components/ui/dialog';
import { toast } from '@/components/ui/toast';
import {
  Users,
  UserPlus,
  ShieldAlert,
  Stethoscope,
  HeartPulse,
  ClipboardList,
  FlaskConical,
  Edit,
  Trash2,
  KeyRound,
  CheckCircle2,
  XCircle,
  Loader2,
  Pill,
  Wrench,
} from 'lucide-react';
import { UserRoleBadge } from '@/components/UserRoleBadge';

interface StaffManagementSectionProps {
  initialStaffUsers: SafeStaffUser[];
  currentRole: UserRole;
}

export function StaffManagementSection({
  initialStaffUsers,
  currentRole,
}: StaffManagementSectionProps) {
  const [users, setUsers] = useState<SafeStaffUser[]>(initialStaffUsers);
  const [isAddingOpen, setIsAddingOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<SafeStaffUser | null>(null);
  const [isPending, startTransition] = useTransition();

  // New user form state
  const [newLoginId, setNewLoginId] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('doctor');
  const [newSubRole, setNewSubRole] = useState('');
  const [newDepartment, setNewDepartment] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newQualifications, setNewQualifications] = useState('');
  const [newRegNumber, setNewRegNumber] = useState('');

  // Edit user state
  const [editName, setEditName] = useState('');
  const [editRole, setEditRole] = useState<UserRole>('doctor');
  const [editSubRole, setEditSubRole] = useState('');
  const [editDepartment, setEditDepartment] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editQualifications, setEditQualifications] = useState('');
  const [editRegNumber, setEditRegNumber] = useState('');
  const [editNewPassword, setEditNewPassword] = useState('');

  const isAdmin = currentRole === 'admin_doctor';

  const resetNewForm = () => {
    setNewLoginId('');
    setNewPassword('');
    setNewName('');
    setNewRole('doctor');
    setNewSubRole('');
    setNewDepartment('');
    setNewPhone('');
    setNewEmail('');
    setNewQualifications('');
    setNewRegNumber('');
  };

  const handleOpenEdit = (user: SafeStaffUser) => {
    setEditingUser(user);
    setEditName(user.name);
    setEditRole(user.role);
    setEditSubRole(user.subRole || '');
    setEditDepartment(user.department || '');
    setEditPhone(user.phone || '');
    setEditEmail(user.email || '');
    setEditQualifications(user.qualifications || '');
    setEditRegNumber(user.regNumber || '');
    setEditNewPassword('');
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLoginId.trim() || !newPassword.trim() || !newName.trim()) {
      toast.show({
        title: 'Missing Required Fields',
        description: 'Login ID, Password, and Full Name are mandatory.',
        type: 'error',
      });
      return;
    }

    startTransition(async () => {
      const res = await createStaffUser({
        loginId: newLoginId,
        password: newPassword,
        name: newName,
        role: newRole,
        subRole: newSubRole || undefined,
        department: newDepartment || undefined,
        phone: newPhone || undefined,
        email: newEmail || undefined,
        qualifications: newQualifications || undefined,
        regNumber: newRegNumber || undefined,
      });

      if (res.success) {
        toast.show({
          title: 'Staff Profile Created',
          description: `Account for ${newName} (${newLoginId}) has been registered.`,
          type: 'success',
        });
        setIsAddingOpen(false);
        resetNewForm();
        window.location.reload();
      } else {
        toast.show({
          title: 'Creation Failed',
          description: res.error || 'Failed to create staff member.',
          type: 'error',
        });
      }
    });
  };

  const handleUpdateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    startTransition(async () => {
      const res = await updateStaffUser(editingUser.id, {
        name: editName,
        role: editRole,
        subRole: editSubRole || undefined,
        department: editDepartment || undefined,
        phone: editPhone || undefined,
        email: editEmail || undefined,
        qualifications: editQualifications || undefined,
        regNumber: editRegNumber || undefined,
        newPassword: editNewPassword.trim() || undefined,
      });

      if (res.success) {
        toast.show({
          title: 'Profile Updated',
          description: `Details for ${editName} have been saved.`,
          type: 'success',
        });
        setEditingUser(null);
        window.location.reload();
      } else {
        toast.show({
          title: 'Update Failed',
          description: res.error || 'Failed to update profile.',
          type: 'error',
        });
      }
    });
  };

  const handleToggleStatus = (user: SafeStaffUser) => {
    const nextStatus = !user.isActive;
    startTransition(async () => {
      const res = await toggleStaffUserStatus(user.id, nextStatus);
      if (res.success) {
        toast.show({
          title: nextStatus ? 'Account Activated' : 'Account Deactivated',
          description: `${user.name} is now ${nextStatus ? 'active' : 'inactive'}.`,
          type: 'info',
        });
        setUsers((prev) =>
          prev.map((u) => (u.id === user.id ? { ...u, isActive: nextStatus } : u))
        );
      } else {
        toast.show({
          title: 'Action Failed',
          description: res.error || 'Failed to change status.',
          type: 'error',
        });
      }
    });
  };

  const handleDelete = (user: SafeStaffUser) => {
    if (!confirm(`Are you sure you want to permanently delete staff account '${user.name}' (${user.loginId})?`)) {
      return;
    }

    startTransition(async () => {
      const res = await deleteStaffUser(user.id);
      if (res.success) {
        toast.show({
          title: 'Staff Deleted',
          description: `Account for ${user.name} removed.`,
          type: 'info',
        });
        setUsers((prev) => prev.filter((u) => u.id !== user.id));
      } else {
        toast.show({
          title: 'Delete Failed',
          description: res.error || 'Could not delete user.',
          type: 'error',
        });
      }
    });
  };

  const getRoleIcon = (role: UserRole) => {
    switch (role) {
      case 'admin_doctor':
        return <ShieldAlert className="w-4 h-4 text-purple-600" />;
      case 'doctor':
        return <Stethoscope className="w-4 h-4 text-indigo-600" />;
      case 'nurse':
        return <HeartPulse className="w-4 h-4 text-rose-600" />;
      case 'lab_technician':
        return <FlaskConical className="w-4 h-4 text-cyan-600" />;
      case 'pharmacist':
        return <Pill className="w-4 h-4 text-emerald-600" />;
      case 'manager':
        return <Wrench className="w-4 h-4 text-blue-600" />;
      case 'receptionist':
      default:
        return <ClipboardList className="w-4 h-4 text-amber-600" />;
    }
  };

  return (
    <Card className="border border-slate-200 shadow-xs">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <div>
          <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Users className="w-5 h-5 text-indigo-600" /> Staff Profiles & Individual Logins
          </CardTitle>
          <CardDescription className="text-xs text-slate-500 mt-0.5">
            Manage individual accounts for Doctors, Nurses, Pharmacists, Managers, Receptionists, and Lab Technicians with role-based access authorities.
          </CardDescription>
        </div>

        {isAdmin && (
          <Dialog open={isAddingOpen} onOpenChange={setIsAddingOpen}>
            <DialogTrigger
              render={
                <Button size="sm" className="gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs">
                  <UserPlus className="w-3.5 h-3.5" /> Add Staff Member
                </Button>
              }
            />
            <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
              <form onSubmit={handleCreateSubmit}>
                <DialogHeader>
                  <DialogTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <UserPlus className="w-4 h-4 text-indigo-600" /> Register New Staff Account
                  </DialogTitle>
                  <DialogDescription className="text-xs text-slate-500">
                    Assign a unique Login ID, secure password, and role permissions.
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-3 py-3 text-xs">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs font-semibold">Full Name *</Label>
                      <Input
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        placeholder="e.g. Dr. Anand Verma"
                        required
                        className="h-8 text-xs"
                      />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs font-semibold">Role Category *</Label>
                      <select
                        value={newRole}
                        onChange={(e) => setNewRole(e.target.value as UserRole)}
                        className="w-full h-8 px-2.5 rounded-lg border border-slate-300 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-semibold"
                      >
                        <option value="admin_doctor">Admin Doctor (Full Authorities)</option>
                        <option value="doctor">Doctor (Consulting Physician)</option>
                        <option value="nurse">Nurse (Inpatient Care & Vitals)</option>
                        <option value="pharmacist">Pharmacist (Drug Dispensing & Verification)</option>
                        <option value="manager">Hospital Manager (Stores, Assets & Facility)</option>
                        <option value="receptionist">Receptionist (Front Desk & Billing)</option>
                        <option value="lab_technician">Lab Technician (Pathology & Diagnostics)</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs font-semibold">Login ID (Username) *</Label>
                      <Input
                        value={newLoginId}
                        onChange={(e) => setNewLoginId(e.target.value)}
                        placeholder="e.g. dr.anand, nurse.kavita"
                        required
                        className="h-8 text-xs font-mono"
                      />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs font-semibold">Password *</Label>
                      <Input
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Min 8 chars, letters & numbers"
                        required
                        className="h-8 text-xs font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs font-semibold">Designation / Subcategory</Label>
                      <Input
                        value={newSubRole}
                        onChange={(e) => setNewSubRole(e.target.value)}
                        placeholder="e.g. Senior Pediatrician, Staff Nurse"
                        className="h-8 text-xs"
                      />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs font-semibold">Department / Ward</Label>
                      <Input
                        value={newDepartment}
                        onChange={(e) => setNewDepartment(e.target.value)}
                        placeholder="e.g. OPD, IPD Ward, Pathology"
                        className="h-8 text-xs"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs font-semibold">Qualifications</Label>
                      <Input
                        value={newQualifications}
                        onChange={(e) => setNewQualifications(e.target.value)}
                        placeholder="e.g. MBBS, MD, B.Sc Nursing, DMLT"
                        className="h-8 text-xs"
                      />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs font-semibold">Medical Reg / License No</Label>
                      <Input
                        value={newRegNumber}
                        onChange={(e) => setNewRegNumber(e.target.value)}
                        placeholder="e.g. MCI-12345"
                        className="h-8 text-xs font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs font-semibold">Phone Number</Label>
                      <Input
                        value={newPhone}
                        onChange={(e) => setNewPhone(e.target.value)}
                        placeholder="+91 98765 43210"
                        className="h-8 text-xs"
                      />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs font-semibold">Email Address</Label>
                      <Input
                        type="email"
                        value={newEmail}
                        onChange={(e) => setNewEmail(e.target.value)}
                        placeholder="doctor@clinic.com"
                        className="h-8 text-xs"
                      />
                    </div>
                  </div>
                </div>

                <DialogFooter className="pt-2">
                  <DialogClose render={<Button type="button" variant="outline" size="sm" />}>
                    Cancel
                  </DialogClose>
                  <Button
                    type="submit"
                    disabled={isPending}
                    size="sm"
                    className="bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5"
                  >
                    {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserPlus className="w-3.5 h-3.5" />}
                    Create Profile
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </CardHeader>

      <CardContent>
        {/* Staff Table */}
        <div className="divide-y divide-slate-200 border border-slate-200 rounded-xl overflow-hidden bg-white">
          {users.map((staff) => (
            <div
              key={staff.id}
              className={`p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors ${
                !staff.isActive ? 'bg-slate-50/80 opacity-75' : 'hover:bg-slate-50/50'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center shrink-0 mt-0.5">
                  {getRoleIcon(staff.role)}
                </div>

                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-xs text-slate-900">{staff.name}</span>
                    <UserRoleBadge role={staff.role} securityEnabled={true} />
                    {!staff.passwordUpdatedAt && (
                      <span
                        className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300 flex items-center gap-1"
                        title="Staff account is still configured with an un-rotated factory default password"
                      >
                        ⚠️ Default Password
                      </span>
                    )}
                    {!staff.isActive && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-200">
                        Deactivated
                      </span>
                    )}
                  </div>

                  <div className="text-[11px] text-slate-500 mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span>
                      Login ID: <strong className="font-mono text-slate-700">{staff.loginId}</strong>
                    </span>
                    {staff.subRole && <span>• {staff.subRole}</span>}
                    {staff.department && <span>• {staff.department}</span>}
                    {staff.qualifications && <span>• {staff.qualifications}</span>}
                    {staff.regNumber && <span>• Reg: {staff.regNumber}</span>}
                  </div>
                </div>
              </div>

              {isAdmin && (
                <div className="flex items-center gap-1.5 self-end sm:self-center">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleOpenEdit(staff)}
                    className="h-7 text-xs text-slate-600 hover:text-indigo-600 gap-1 px-2"
                  >
                    <Edit className="w-3.5 h-3.5" /> Edit
                  </Button>

                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleToggleStatus(staff)}
                    className={`h-7 text-xs gap-1 px-2 ${
                      staff.isActive
                        ? 'text-amber-600 hover:text-amber-800'
                        : 'text-emerald-600 hover:text-emerald-800'
                    }`}
                  >
                    {staff.isActive ? (
                      <>
                        <XCircle className="w-3.5 h-3.5" /> Deactivate
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5" /> Activate
                      </>
                    )}
                  </Button>

                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(staff)}
                    className="h-7 w-7 text-slate-400 hover:text-red-600 p-0"
                    title="Delete Staff Member"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Edit Staff Modal */}
        {editingUser && (
          <Dialog open={Boolean(editingUser)} onOpenChange={(open) => !open && setEditingUser(null)}>
            <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
              <form onSubmit={handleUpdateSubmit}>
                <DialogHeader>
                  <DialogTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <Edit className="w-4 h-4 text-indigo-600" /> Edit Profile & Reset Password
                  </DialogTitle>
                  <DialogDescription className="text-xs text-slate-500">
                    Modifying account for <strong className="text-slate-800">{editingUser.name}</strong> ({editingUser.loginId})
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-3 py-3 text-xs">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs font-semibold">Full Name *</Label>
                      <Input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        required
                        className="h-8 text-xs"
                      />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs font-semibold">Role *</Label>
                      <select
                        value={editRole}
                        onChange={(e) => setEditRole(e.target.value as UserRole)}
                        className="w-full h-8 px-2.5 rounded-lg border border-slate-300 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-semibold"
                      >
                        <option value="admin_doctor">Admin Doctor (Full Authorities)</option>
                        <option value="doctor">Doctor (Consulting Physician)</option>
                        <option value="nurse">Nurse (Inpatient Care & Vitals)</option>
                        <option value="pharmacist">Pharmacist (Drug Dispensing & Verification)</option>
                        <option value="manager">Hospital Manager (Stores, Assets & Facility)</option>
                        <option value="receptionist">Receptionist (Front Desk & Billing)</option>
                        <option value="lab_technician">Lab Technician (Pathology & Diagnostics)</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-1 bg-amber-50/70 p-2.5 rounded-xl border border-amber-200">
                    <Label className="text-xs font-semibold text-amber-900 flex items-center gap-1.5">
                      <KeyRound className="w-3.5 h-3.5 text-amber-700" /> Reset Account Password
                    </Label>
                    <Input
                      type="password"
                      value={editNewPassword}
                      onChange={(e) => setEditNewPassword(e.target.value)}
                      placeholder="Leave blank to keep current, or enter new (min 8 chars)"
                      className="h-8 text-xs font-mono bg-white"
                    />
                    <p className="text-[10px] text-amber-700">Enter a new secure password (min 8 characters, letters & numbers) or leave empty.</p>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs font-semibold">Designation / Subcategory</Label>
                      <Input
                        value={editSubRole}
                        onChange={(e) => setEditSubRole(e.target.value)}
                        className="h-8 text-xs"
                      />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs font-semibold">Department / Ward</Label>
                      <Input
                        value={editDepartment}
                        onChange={(e) => setEditDepartment(e.target.value)}
                        className="h-8 text-xs"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs font-semibold">Qualifications</Label>
                      <Input
                        value={editQualifications}
                        onChange={(e) => setEditQualifications(e.target.value)}
                        className="h-8 text-xs"
                      />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs font-semibold">Registration No</Label>
                      <Input
                        value={editRegNumber}
                        onChange={(e) => setEditRegNumber(e.target.value)}
                        className="h-8 text-xs font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs font-semibold">Phone</Label>
                      <Input
                        value={editPhone}
                        onChange={(e) => setEditPhone(e.target.value)}
                        className="h-8 text-xs"
                      />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs font-semibold">Email</Label>
                      <Input
                        type="email"
                        value={editEmail}
                        onChange={(e) => setEditEmail(e.target.value)}
                        className="h-8 text-xs"
                      />
                    </div>
                  </div>
                </div>

                <DialogFooter className="pt-2">
                  <DialogClose render={<Button type="button" variant="outline" size="sm" />}>
                    Cancel
                  </DialogClose>
                  <Button
                    type="submit"
                    disabled={isPending}
                    size="sm"
                    className="bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5"
                  >
                    {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                    Save Changes
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </CardContent>
    </Card>
  );
}
