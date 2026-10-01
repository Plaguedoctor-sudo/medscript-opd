import { describe, it, expect } from 'vitest';
import { canDo, getRoleScope } from '../role-scope';
import { isPharmacist, isHospitalManager, isValidUserRole, isDoctor, isNurse } from '../auth';

describe('Pharmacist & Hospital Manager Roles and Permissions (RBAC)', () => {
  describe('Role Validation', () => {
    it('recognizes pharmacist and manager as valid UserRoles', () => {
      expect(isValidUserRole('pharmacist')).toBe(true);
      expect(isValidUserRole('manager')).toBe(true);
      expect(isValidUserRole('admin_doctor')).toBe(true);
      expect(isValidUserRole('doctor')).toBe(true);
      expect(isValidUserRole('nurse')).toBe(true);
      expect(isValidUserRole('receptionist')).toBe(true);
      expect(isValidUserRole('lab_technician')).toBe(true);
      expect(isValidUserRole('hacker_role')).toBe(false);
    });

    it('correctly maps isPharmacist and isHospitalManager helper checks', () => {
      expect(isPharmacist('pharmacist')).toBe(true);
      expect(isPharmacist('admin_doctor')).toBe(true);
      expect(isPharmacist('nurse')).toBe(false);
      expect(isPharmacist('receptionist')).toBe(false);

      expect(isHospitalManager('manager')).toBe(true);
      expect(isHospitalManager('admin_doctor')).toBe(true);
      expect(isHospitalManager('doctor')).toBe(false);
      expect(isHospitalManager('nurse')).toBe(false);
    });
  });

  describe('Pharmacist Role Permissions & Scope', () => {
    it('grants pharmacist authority to view prescriptions and inpatient rounds', () => {
      expect(canDo('pharmacist', 'prescription:view')).toBe(true);
      expect(canDo('pharmacist', 'ipd:view')).toBe(true);
      expect(canDo('pharmacist', 'patient:view')).toBe(true);
    });

    it('grants pharmacist authority to view inventory and dispense medications', () => {
      expect(canDo('pharmacist', 'inventory:view')).toBe(true);
      expect(canDo('pharmacist', 'inventory:manage')).toBe(true);
      expect(canDo('pharmacist', 'pharmacy:dispense')).toBe(true);
    });

    it('strictly denies pharmacist from creating or editing clinical prescriptions', () => {
      expect(canDo('pharmacist', 'prescription:create')).toBe(false);
      expect(canDo('pharmacist', 'prescription:edit')).toBe(false);
      expect(isDoctor('pharmacist')).toBe(false);
    });

    it('strictly denies pharmacist from conducting rounds, nursing notes, or lab alterations', () => {
      expect(canDo('pharmacist', 'ipd:clinical_rounds')).toBe(false);
      expect(canDo('pharmacist', 'ipd:nursing_notes')).toBe(false);
      expect(canDo('pharmacist', 'ipd:admit_discharge')).toBe(false);
      expect(canDo('pharmacist', 'lab:manage')).toBe(false);
      expect(canDo('pharmacist', 'billing:manage')).toBe(false);
      expect(canDo('pharmacist', 'settings:security')).toBe(false);
    });

    it('provides clear clinical role scope definitions for Pharmacist', () => {
      const scope = getRoleScope('pharmacist');
      expect(scope.role).toBe('pharmacist');
      expect(scope.title).toContain('Pharmacist');
      expect(scope.department).toContain('Pharmacy');
      expect(scope.allowedWork.some((w) => w.includes('Dispense and dispatch prescribed medications'))).toBe(true);
      expect(scope.restrictedWork.some((w) => w.includes('CANNOT create new clinical prescriptions'))).toBe(true);
    });
  });

  describe('Hospital Manager Role Permissions & Scope', () => {
    it('grants manager authority over hospital assets, maintenance, procurement, and dispatch', () => {
      expect(canDo('manager', 'inventory:view')).toBe(true);
      expect(canDo('manager', 'inventory:manage')).toBe(true);
      expect(canDo('manager', 'manager:assets')).toBe(true);
      expect(canDo('manager', 'manager:maintenance')).toBe(true);
      expect(canDo('manager', 'manager:purchase')).toBe(true);
      expect(canDo('manager', 'manager:dispatch')).toBe(true);
    });

    it('strictly denies manager from clinical prescribing or patient diagnosis', () => {
      expect(canDo('manager', 'prescription:create')).toBe(false);
      expect(canDo('manager', 'prescription:edit')).toBe(false);
      expect(canDo('manager', 'ipd:clinical_rounds')).toBe(false);
      expect(canDo('manager', 'certificate:issue')).toBe(false);
      expect(canDo('manager', 'lab:order')).toBe(false);
      expect(canDo('manager', 'lab:manage')).toBe(false);
      expect(isDoctor('manager')).toBe(false);
      expect(isNurse('manager')).toBe(false);
    });

    it('provides comprehensive materials and operations role scope definitions for Manager', () => {
      const scope = getRoleScope('manager');
      expect(scope.role).toBe('manager');
      expect(scope.title).toContain('Manager');
      expect(scope.allowedWork.some((w) => w.includes('surgical instruments'))).toBe(true);
      expect(scope.allowedWork.some((w) => w.includes('cleaning agents, toiletries, bedsheets'))).toBe(true);
      expect(scope.allowedWork.some((w) => w.includes('instrument maintenance'))).toBe(true);
      expect(scope.allowedWork.some((w) => w.includes('procurement purchase orders'))).toBe(true);
      expect(scope.allowedWork.some((w) => w.includes('Dispatch stock and instruments'))).toBe(true);
      expect(scope.restrictedWork.some((w) => w.includes('CANNOT create or edit clinical prescriptions'))).toBe(true);
    });
  });

  describe('Admin Doctor Full Inheritance', () => {
    it('ensures admin_doctor inherits all pharmacist and manager capabilities', () => {
      expect(canDo('admin_doctor', 'pharmacy:dispense')).toBe(true);
      expect(canDo('admin_doctor', 'manager:assets')).toBe(true);
      expect(canDo('admin_doctor', 'manager:maintenance')).toBe(true);
      expect(canDo('admin_doctor', 'manager:purchase')).toBe(true);
      expect(canDo('admin_doctor', 'manager:dispatch')).toBe(true);
      expect(isPharmacist('admin_doctor')).toBe(true);
      expect(isHospitalManager('admin_doctor')).toBe(true);
    });
  });

  describe('Admin Doctor & Doctor Staff Management Authority', () => {
    it('ensures admin_doctor and doctor can manage staff profiles', () => {
      expect(canDo('admin_doctor', 'settings:staff_management')).toBe(true);
      expect(canDo('doctor', 'settings:staff_management')).toBe(true);
      expect(isDoctor('admin_doctor')).toBe(true);
      expect(isDoctor('doctor')).toBe(true);
    });

    it('denies nurse, receptionist, and pharmacist from managing staff profiles', () => {
      expect(canDo('nurse', 'settings:staff_management')).toBe(false);
      expect(canDo('receptionist', 'settings:staff_management')).toBe(false);
      expect(canDo('pharmacist', 'settings:staff_management')).toBe(false);
      expect(canDo('manager', 'settings:staff_management')).toBe(false);
    });
  });
});
