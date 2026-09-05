import { describe, it, expect } from 'vitest';
import { mapSupabaseToUi, mapUiToSupabase, formatTimeForUi } from '../utils/StaffMappers';
import { mapSupabaseToUi as staffExportMapToUi, mapUiToSupabase as staffExportMapToSupabase } from './Staff';

describe('Staff Supabase Mappers', () => {
  it('re-exports mappers from Staff.jsx correctly', () => {
    expect(staffExportMapToUi).toBe(mapSupabaseToUi);
    expect(staffExportMapToSupabase).toBe(mapUiToSupabase);
  });

  it('formatTimeForUi correctly formats HH:MM:SS and HH:MM', () => {
    expect(formatTimeForUi('06:50:00')).toBe('06:50');
    expect(formatTimeForUi('14:45:00')).toBe('14:45');
    expect(formatTimeForUi('7:5:00')).toBe('07:05');
    expect(formatTimeForUi('08:15')).toBe('08:15');
    expect(formatTimeForUi('', '06:50')).toBe('06:50');
    expect(formatTimeForUi(null, '14:45')).toBe('14:45');
  });

  it('mapSupabaseToUi correctly transforms a Supabase staff row with joined classes data', () => {
    const supabaseRow = {
      id: 'staff-uuid-101',
      madrasa_id: 'madrasa-uuid-202',
      profile_id: 'profile-uuid-303',
      staff_code: 1005,
      name: 'قاری محمد بلال',
      father_name: 'محمد انور',
      cnic: '35201-1234567-1',
      assigned_class_id: 'class-uuid-404',
      phone: '0300-1234567',
      whatsapp: '0300-7654321',
      residence_status: 'کرایہ',
      address: 'محلہ عثمانیہ، لاہور',
      qualification: 'حفظ القرآن + تجوید و قراءات',
      joining_date: '2024-08-01',
      shift_start: '07:00:00',
      shift_end: '15:00:00',
      experience: 'جامعہ اشرفیہ، 4 سال',
      reference: 'مولانا احمد حسن',
      notes: 'شعبہ حفظ کے سینئر استاد',
      created_at: '2024-08-01T10:00:00Z',
      updated_at: '2026-08-29T10:00:00Z',
      classes: {
        id: 'class-uuid-404',
        class_name: 'حفظ سال اول (الف)'
      }
    };

    const uiObj = mapSupabaseToUi(supabaseRow);

    expect(uiObj).toEqual({
      id: 'staff-uuid-101',
      staffCode: 1005,
      name: 'قاری محمد بلال',
      fatherName: 'محمد انور',
      cnic: '35201-1234567-1',
      assignedClass: 'class-uuid-404',
      assignedClassName: 'حفظ سال اول (الف)',
      phone: '0300-1234567',
      whatsapp: '0300-7654321',
      residenceStatus: 'کرایہ',
      address: 'محلہ عثمانیہ، لاہور',
      qualification: 'حفظ القرآن + تجوید و قراءات',
      joiningDate: '2024-08-01',
      shiftStart: '07:00',
      shiftEnd: '15:00',
      experience: 'جامعہ اشرفیہ، 4 سال',
      reference: 'مولانا احمد حسن',
      notes: 'شعبہ حفظ کے سینئر استاد',
      profileId: 'profile-uuid-303',
      createdAt: '2024-08-01T10:00:00Z',
      updatedAt: '2026-08-29T10:00:00Z'
    });
  });

  it('mapSupabaseToUi resolves class name from classes array or lookup object when joined relation is omitted', () => {
    const supabaseRow = {
      id: 'staff-uuid-102',
      madrasa_id: 'madrasa-uuid-202',
      staff_code: 1006,
      name: 'استاد حماد علی',
      father_name: 'علی احمد',
      assigned_class_id: 'class-uuid-505',
      phone: '0312-3456789'
    };

    const classesArray = [
      { id: 'class-uuid-505', name: 'حفظ سال دوم (ب)' }
    ];

    const uiObjArrayLookup = mapSupabaseToUi(supabaseRow, classesArray);
    expect(uiObjArrayLookup.assignedClassName).toBe('حفظ سال دوم (ب)');

    const classesMap = {
      'class-uuid-505': { id: 'class-uuid-505', class_name: 'حفظ سال دوم (ب)' }
    };
    const uiObjMapLookup = mapSupabaseToUi(supabaseRow, classesMap);
    expect(uiObjMapLookup.assignedClassName).toBe('حفظ سال دوم (ب)');
  });

  it('mapSupabaseToUi applies defaults when optional fields are null or omitted', () => {
    const minimalRow = {
      id: 'staff-uuid-103',
      madrasa_id: 'madrasa-uuid-202',
      staff_code: 1001,
      name: 'قاری عبد الرحمن',
      father_name: 'عبد اللہ',
      phone: '0321-9876543'
    };

    const uiObj = mapSupabaseToUi(minimalRow);

    expect(uiObj.staffCode).toBe(1001);
    expect(uiObj.name).toBe('قاری عبد الرحمن');
    expect(uiObj.fatherName).toBe('عبد اللہ');
    expect(uiObj.residenceStatus).toBe('ذاتی مکان');
    expect(uiObj.shiftStart).toBe('06:50');
    expect(uiObj.shiftEnd).toBe('14:45');
    expect(uiObj.assignedClass).toBe('');
    expect(uiObj.assignedClassName).toBe('');
    expect(uiObj.cnic).toBe('');
    expect(uiObj.whatsapp).toBe('');
    expect(uiObj.address).toBe('');
    expect(uiObj.qualification).toBe('');
    expect(uiObj.experience).toBe('');
    expect(uiObj.reference).toBe('');
    expect(uiObj.notes).toBe('');
  });

  it('mapUiToSupabase formats new staff UI form data into Supabase payload with trimmed fields', () => {
    const uiData = {
      name: '  قاری عبد السمیع  ',
      fatherName: '  سمیع اللہ  ',
      cnic: '  35202-7654321-3  ',
      assignedClass: 'b567c9c0-9988-4c6e-a2b1-123456789abc',
      phone: '  0301-1122334  ',
      whatsapp: '  0301-1122334  ',
      residenceStatus: 'ذاتی مکان',
      address: '  مسجد و مدرسہ کمپلیکس  ',
      qualification: '  شہادۃ العالمیہ  ',
      joiningDate: '2026-01-15',
      shiftStart: '06:45',
      shiftEnd: '14:30',
      experience: '  5 سال تدریسی تجربہ  ',
      reference: '  مفتی طارق صاحب  ',
      notes: '  ناظرہ و حفظ انچارج  '
    };

    const madrasaId = 'c7e8a9f0-1234-4567-89ab-cdef01234567';
    const payload = mapUiToSupabase(uiData, madrasaId);

    expect(payload).toEqual({
      madrasa_id: madrasaId,
      name: 'قاری عبد السمیع',
      father_name: 'سمیع اللہ',
      cnic: '35202-7654321-3',
      assigned_class_id: 'b567c9c0-9988-4c6e-a2b1-123456789abc',
      phone: '0301-1122334',
      whatsapp: '0301-1122334',
      residence_status: 'ذاتی مکان',
      address: 'مسجد و مدرسہ کمپلیکس',
      qualification: 'شہادۃ العالمیہ',
      joining_date: '2026-01-15',
      shift_start: '06:45',
      shift_end: '14:30',
      experience: '5 سال تدریسی تجربہ',
      reference: 'مفتی طارق صاحب',
      notes: 'ناظرہ و حفظ انچارج'
    });
  });

  it('mapUiToSupabase preserves existing UUID and staff_code during updates and handles empty class', () => {
    const existingUiData = {
      id: 'a1b2c3d4-5678-90ab-cdef-1234567890ab',
      staffCode: 1003,
      name: 'حافظ زبیر',
      fatherName: 'زبیر احمد',
      phone: '0333-5556677',
      assignedClass: '', // unassigned
      profileId: 'e1f2a3b4-5678-90ab-cdef-abcdef123456'
    };

    const madrasaId = 'c7e8a9f0-1234-4567-89ab-cdef01234567';
    const payload = mapUiToSupabase(existingUiData, madrasaId);

    expect(payload.id).toBe('a1b2c3d4-5678-90ab-cdef-1234567890ab');
    expect(payload.staff_code).toBe(1003);
    expect(payload.assigned_class_id).toBeNull();
    expect(payload.profile_id).toBe('e1f2a3b4-5678-90ab-cdef-abcdef123456');
    expect(payload.shift_start).toBe('06:50');
    expect(payload.shift_end).toBe('14:45');
    expect(payload.residence_status).toBe('ذاتی مکان');
  });

  it('mapUiToSupabase ignores non-UUID assignedClass strings and sets assigned_class_id to null', () => {
    const uiData = {
      name: 'قاری عثمان',
      fatherName: 'عثمان غنی',
      phone: '0345-0000000',
      assignedClass: 'default_class_1' // Not a valid UUID
    };

    const payload = mapUiToSupabase(uiData, 'c7e8a9f0-1234-4567-89ab-cdef01234567');
    expect(payload.assigned_class_id).toBeNull();
  });
});
