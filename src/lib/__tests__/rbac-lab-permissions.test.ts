import { describe, it, expect } from 'vitest';
import { canDo, getRoleScope } from '../role-scope';

describe('Clinical RBAC - Laboratory Access Controls', () => {
  describe('Lab Report Editing Restrictions (lab:manage)', () => {
    it('disallows non-admin doctor from editing lab reports', () => {
      expect(canDo('doctor', 'lab:manage')).toBe(false);
    });

    it('disallows staff nurse from editing lab reports', () => {
      expect(canDo('nurse', 'lab:manage')).toBe(false);
    });

    it('disallows receptionist from editing lab reports', () => {
      expect(canDo('receptionist', 'lab:manage')).toBe(false);
    });

    it('allows lab technician to edit lab reports and diagnostic parameters', () => {
      expect(canDo('lab_technician', 'lab:manage')).toBe(true);
    });

    it('allows admin doctor to edit and supervise lab reports', () => {
      expect(canDo('admin_doctor', 'lab:manage')).toBe(true);
    });
  });

  describe('Lab Test Ordering Restrictions (lab:order)', () => {
    it('strictly forbids nurse from ordering laboratory tests', () => {
      expect(canDo('nurse', 'lab:order')).toBe(false);
    });

    it('strictly forbids receptionist from ordering laboratory tests', () => {
      expect(canDo('receptionist', 'lab:order')).toBe(false);
    });

    it('allows consulting doctor to order laboratory tests', () => {
      expect(canDo('doctor', 'lab:order')).toBe(true);
    });

    it('allows admin doctor to order laboratory tests', () => {
      expect(canDo('admin_doctor', 'lab:order')).toBe(true);
    });

    it('allows lab technician to intake/order walk-in patient laboratory tests', () => {
      expect(canDo('lab_technician', 'lab:order')).toBe(true);
    });
  });

  describe('Lab Report Visibility (lab:view)', () => {
    it('allows doctor, nurse, lab technician, and admin doctor to view lab reports', () => {
      expect(canDo('doctor', 'lab:view')).toBe(true);
      expect(canDo('nurse', 'lab:view')).toBe(true);
      expect(canDo('lab_technician', 'lab:view')).toBe(true);
      expect(canDo('admin_doctor', 'lab:view')).toBe(true);
    });
  });

  describe('Role Scope Definitions', () => {
    it('documents nurse restrictions against ordering labs and editing lab data', () => {
      const nurseScope = getRoleScope('nurse');
      expect(nurseScope.restrictedWork.some(r => r.includes('CANNOT order laboratory tests'))).toBe(true);
      expect(nurseScope.restrictedWork.some(r => r.includes('CANNOT edit laboratory test result'))).toBe(true);
    });

    it('documents doctor restrictions against editing lab reports', () => {
      const doctorScope = getRoleScope('doctor');
      expect(doctorScope.restrictedWork.some(r => r.includes('CANNOT edit laboratory test results'))).toBe(true);
    });
  });
});
