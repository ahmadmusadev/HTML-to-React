import { describe, it, expect } from 'vitest';
import { mapUiToSupabase, parseDobString } from './Admissions';

describe('Admissions Date of Birth Mapping', () => {
  it('correctly parses date of birth strings via parseDobString', () => {
    expect(parseDobString('2015-05-10')).toEqual({
      year: '2015',
      month: '05',
      day: '10',
      formatted: '2015-05-10'
    });
    expect(parseDobString('10/05/2015')).toEqual({
      year: '2015',
      month: '05',
      day: '10',
      formatted: '2015-05-10'
    });
    expect(parseDobString('invalid')).toBeNull();
    expect(parseDobString('')).toBeNull();
    expect(parseDobString(null)).toBeNull();
  });

  it('Flow 1 (Wizard / New Admission): constructs date_of_birth from admDobDay/admDobMonth/admDobYear when admDobFull is empty', () => {
    const wizardFormData = {
      admRegNo: '101',
      admName: 'احمد',
      admFatherName: 'علی',
      admDobDay: '15',
      admDobMonth: '8',
      admDobYear: '2012',
      admDobFull: '' // or omitted in wizard
    };

    const payload = mapUiToSupabase(wizardFormData);
    expect(payload.date_of_birth).toBe('2012-08-15');
  });

  it('Flow 2 (Profile Modal / Edit): uses admDobFull when present and valid', () => {
    const profileModalData = {
      id: 'student-123',
      name: 'فاطمہ',
      admFatherName: 'عمر',
      admDobFull: '2015-03-25',
      admDobDay: '25',
      admDobMonth: '03',
      admDobYear: '2015'
    };

    const payload = mapUiToSupabase(profileModalData);
    expect(payload.date_of_birth).toBe('2015-03-25');
  });

  it('Flow 2 (Profile Modal / Edit): falls back to admDobDay/Month/Year if admDobFull is empty', () => {
    const profileModalData = {
      id: 'student-124',
      name: 'عثمان',
      admFatherName: 'بلال',
      admDobFull: '',
      admDobDay: '05',
      admDobMonth: '11',
      admDobYear: '2010'
    };

    const payload = mapUiToSupabase(profileModalData);
    expect(payload.date_of_birth).toBe('2010-11-05');
  });
});
