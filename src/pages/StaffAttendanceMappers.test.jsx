import { describe, it, expect } from 'vitest';
import {
  normalizeStaffAttendanceStatus,
  formatTimeForUi,
  getMinutesDifference,
  calculateLateMinutes,
  calculateEarlyLeaveMinutes,
  mapStaffAttendanceRowToUi,
  mapStaffAttendanceRowsToDict,
  mapUiToStaffAttendancePayload,
  derivePendingDate,
  getStaffAttendanceStatusLabelUrdu,
  calculateStaffAttendanceCounts
} from '../utils/StaffAttendanceMappers';

describe('Staff Attendance Mappers & Utilities', () => {
  describe('normalizeStaffAttendanceStatus', () => {
    it('normalizes various present statuses to "present"', () => {
      expect(normalizeStaffAttendanceStatus('present')).toBe('present');
      expect(normalizeStaffAttendanceStatus('PRESENT')).toBe('present');
      expect(normalizeStaffAttendanceStatus('p')).toBe('present');
      expect(normalizeStaffAttendanceStatus('P')).toBe('present');
      expect(normalizeStaffAttendanceStatus('حاضر')).toBe('present');
    });

    it('normalizes various absent statuses to "absent"', () => {
      expect(normalizeStaffAttendanceStatus('absent')).toBe('absent');
      expect(normalizeStaffAttendanceStatus('ABSENT')).toBe('absent');
      expect(normalizeStaffAttendanceStatus('a')).toBe('absent');
      expect(normalizeStaffAttendanceStatus('A')).toBe('absent');
      expect(normalizeStaffAttendanceStatus('غیر حاضر')).toBe('absent');
    });

    it('normalizes various leave statuses to "leave"', () => {
      expect(normalizeStaffAttendanceStatus('leave')).toBe('leave');
      expect(normalizeStaffAttendanceStatus('LEAVE')).toBe('leave');
      expect(normalizeStaffAttendanceStatus('l')).toBe('leave');
      expect(normalizeStaffAttendanceStatus('L')).toBe('leave');
      expect(normalizeStaffAttendanceStatus('e')).toBe('leave');
      expect(normalizeStaffAttendanceStatus('رخصت')).toBe('leave');
      expect(normalizeStaffAttendanceStatus('معذور')).toBe('leave');
    });

    it('normalizes various half_leave statuses to "half_leave"', () => {
      expect(normalizeStaffAttendanceStatus('half_leave')).toBe('half_leave');
      expect(normalizeStaffAttendanceStatus('HALF_LEAVE')).toBe('half_leave');
      expect(normalizeStaffAttendanceStatus('half-leave')).toBe('half_leave');
      expect(normalizeStaffAttendanceStatus('half')).toBe('half_leave');
      expect(normalizeStaffAttendanceStatus('hl')).toBe('half_leave');
      expect(normalizeStaffAttendanceStatus('HL')).toBe('half_leave');
      expect(normalizeStaffAttendanceStatus('آدھی چھٹی')).toBe('half_leave');
      expect(normalizeStaffAttendanceStatus('آدھی رخصت')).toBe('half_leave');
      expect(normalizeStaffAttendanceStatus('نصف رخصت')).toBe('half_leave');
    });

    it('falls back to "present" for null, empty or unknown values', () => {
      expect(normalizeStaffAttendanceStatus(null)).toBe('present');
      expect(normalizeStaffAttendanceStatus('')).toBe('present');
      expect(normalizeStaffAttendanceStatus('unknown')).toBe('present');
    });
  });

  describe('getStaffAttendanceStatusLabelUrdu', () => {
    it('returns correct Urdu-only labels', () => {
      expect(getStaffAttendanceStatusLabelUrdu('present')).toBe('حاضر');
      expect(getStaffAttendanceStatusLabelUrdu('absent')).toBe('غیر حاضر');
      expect(getStaffAttendanceStatusLabelUrdu('leave')).toBe('رخصت');
      expect(getStaffAttendanceStatusLabelUrdu('half_leave')).toBe('آدھی چھٹی');
    });
  });

  describe('calculateStaffAttendanceCounts', () => {
    it('correctly counts 2 leave + 1 half_leave as 2.5 leave and 0.5 present-equivalent', () => {
      const records = [
        { status: 'leave' },
        { status: 'leave' },
        { status: 'half_leave', lateMinutes: 10, earlyLeaveMinutes: 90 }
      ];

      const counts = calculateStaffAttendanceCounts(records);
      expect(counts.leave).toBe(2.5);
      expect(counts.present).toBe(0.5);
      expect(counts.absent).toBe(0);
      expect(counts.halfLeave).toBe(1);
      expect(counts.totalLateMinutes).toBe(10);
      expect(counts.totalEarlyLeaveMinutes).toBe(90);
    });

    it('handles mixed staff attendance records with fractional values', () => {
      const records = [
        { status: 'present' },
        { status: 'present' },
        { status: 'half_leave' },
        { status: 'absent' }
      ];

      const counts = calculateStaffAttendanceCounts(records);
      expect(counts.present).toBe(2.5);
      expect(counts.leave).toBe(0.5);
      expect(counts.absent).toBe(1);
      expect(counts.halfLeave).toBe(1);
    });
  });

  describe('formatTimeForUi', () => {
    it('formats HH:MM:SS to HH:MM', () => {
      expect(formatTimeForUi('06:50:00')).toBe('06:50');
      expect(formatTimeForUi('14:45:30')).toBe('14:45');
      expect(formatTimeForUi('7:5:00')).toBe('07:05');
    });

    it('preserves HH:MM format', () => {
      expect(formatTimeForUi('06:50')).toBe('06:50');
      expect(formatTimeForUi('14:45')).toBe('14:45');
    });

    it('returns defaultTime when input is falsy', () => {
      expect(formatTimeForUi('', '06:50')).toBe('06:50');
      expect(formatTimeForUi(null, '14:45')).toBe('14:45');
      expect(formatTimeForUi(undefined, '')).toBe('');
    });
  });

  describe('getMinutesDifference', () => {
    it('calculates correct difference between two times', () => {
      expect(getMinutesDifference('07:15', '06:50')).toBe(25);
      expect(getMinutesDifference('06:50', '06:50')).toBe(0);
      expect(getMinutesDifference('06:40', '06:50')).toBe(-10);
      expect(getMinutesDifference('14:45', '14:30')).toBe(15);
    });

    it('returns 0 for invalid or missing inputs', () => {
      expect(getMinutesDifference('', '06:50')).toBe(0);
      expect(getMinutesDifference(null, '06:50')).toBe(0);
      expect(getMinutesDifference('invalid', '06:50')).toBe(0);
    });
  });

  describe('calculateLateMinutes & calculateEarlyLeaveMinutes', () => {
    it('calculates late minutes accurately for present staff', () => {
      expect(calculateLateMinutes('07:10', '06:50', 'present')).toBe(20);
      expect(calculateLateMinutes('06:45', '06:50', 'present')).toBe(0);
      expect(calculateLateMinutes('06:50', '06:50', 'present')).toBe(0);
    });

    it('calculates late minutes accurately for half_leave staff just like present staff', () => {
      expect(calculateLateMinutes('07:10', '06:50', 'half_leave')).toBe(20);
      expect(calculateLateMinutes('06:45', '06:50', 'half_leave')).toBe(0);
      expect(calculateLateMinutes('06:50', '06:50', 'half_leave')).toBe(0);
    });

    it('returns 0 late minutes if staff is absent or on leave', () => {
      expect(calculateLateMinutes('07:30', '06:50', 'absent')).toBe(0);
      expect(calculateLateMinutes('07:30', '06:50', 'leave')).toBe(0);
    });

    it('calculates early departure minutes accurately for present staff', () => {
      // Shift ends at 14:45, staff checked out at 14:30 -> 15 min early
      expect(calculateEarlyLeaveMinutes('14:30', '14:45', 'present')).toBe(15);
      // Staff stayed until 15:00 -> 0 early minutes
      expect(calculateEarlyLeaveMinutes('15:00', '14:45', 'present')).toBe(0);
      expect(calculateEarlyLeaveMinutes('14:45', '14:45', 'present')).toBe(0);
    });

    it('calculates early departure minutes accurately for half_leave staff', () => {
      expect(calculateEarlyLeaveMinutes('13:15', '14:45', 'half_leave')).toBe(90);
      expect(calculateEarlyLeaveMinutes('14:45', '14:45', 'half_leave')).toBe(0);
    });

    it('returns 0 early minutes if staff is absent or on leave', () => {
      expect(calculateEarlyLeaveMinutes('14:00', '14:45', 'absent')).toBe(0);
      expect(calculateEarlyLeaveMinutes('14:00', '14:45', 'leave')).toBe(0);
    });
  });

  describe('mapStaffAttendanceRowToUi', () => {
    it('transforms a Supabase staff_attendance row with joined staff', () => {
      const row = {
        id: 'att-uuid-1',
        madrasa_id: 'madrasa-uuid-101',
        staff_id: 'staff-uuid-201',
        date: '2026-09-04',
        status: 'present',
        check_in: '07:05:00',
        check_out: '14:45:00',
        late_minutes: 15,
        early_leave_minutes: 0,
        remarks: '15 منٹ تاخیر',
        created_at: '2026-09-04T07:05:00Z',
        updated_at: '2026-09-04T14:45:00Z',
        staff: {
          id: 'staff-uuid-201',
          name: 'قاری محمد بلال',
          staff_code: 1001,
          shift_start: '06:50:00',
          shift_end: '14:45:00'
        }
      };

      const ui = mapStaffAttendanceRowToUi(row);
      expect(ui).toEqual({
        id: 'att-uuid-1',
        madrasaId: 'madrasa-uuid-101',
        staffId: 'staff-uuid-201',
        teacherId: '1001',
        teacherName: 'قاری محمد بلال',
        date: '2026-09-04',
        status: 'present',
        checkIn: '07:05',
        checkOut: '14:45',
        lateMinutes: 15,
        earlyLeaveMinutes: 0,
        remarks: '15 منٹ تاخیر',
        createdAt: '2026-09-04T07:05:00Z',
        updatedAt: '2026-09-04T14:45:00Z'
      });
    });

    it('uses staffLookup fallback when joined relation is omitted', () => {
      const row = {
        id: 'att-uuid-2',
        madrasa_id: 'madrasa-uuid-101',
        staff_id: 'staff-uuid-202',
        date: '2026-09-04',
        status: 'leave',
        check_in: null,
        check_out: null,
        late_minutes: 0,
        early_leave_minutes: 0,
        remarks: 'بیماری کی رخصت'
      };

      const lookup = {
        'staff-uuid-202': {
          id: 'staff-uuid-202',
          name: 'استاد حماد علی',
          staff_code: 1002
        }
      };

      const ui = mapStaffAttendanceRowToUi(row, lookup);
      expect(ui.teacherId).toBe('1002');
      expect(ui.teacherName).toBe('استاد حماد علی');
      expect(ui.status).toBe('leave');
      expect(ui.checkIn).toBe('');
      expect(ui.checkOut).toBe('');
      expect(ui.remarks).toBe('بیماری کی رخصت');
    });
  });

  describe('mapStaffAttendanceRowsToDict', () => {
    it('groups rows by date and teacherId into a dictionary', () => {
      const rows = [
        {
          id: 'att-1',
          staff_id: 'staff-1',
          date: '2026-09-04',
          status: 'present',
          check_in: '06:50:00',
          check_out: '14:45:00',
          late_minutes: 0,
          early_leave_minutes: 0,
          remarks: '',
          staff: { id: 'staff-1', name: 'قاری بلال', staff_code: 1001 }
        },
        {
          id: 'att-2',
          staff_id: 'staff-2',
          date: '2026-09-04',
          status: 'absent',
          check_in: null,
          check_out: null,
          late_minutes: 0,
          early_leave_minutes: 0,
          remarks: 'غیر حاضر',
          staff: { id: 'staff-2', name: 'استاد حماد', staff_code: 1002 }
        },
        {
          id: 'att-3',
          staff_id: 'staff-1',
          date: '2026-09-03',
          status: 'present',
          check_in: '06:55:00',
          check_out: '14:45:00',
          late_minutes: 5,
          early_leave_minutes: 0,
          remarks: '',
          staff: { id: 'staff-1', name: 'قاری بلال', staff_code: 1001 }
        }
      ];

      const dict = mapStaffAttendanceRowsToDict(rows);

      expect(dict['2026-09-04']).toBeDefined();
      expect(dict['2026-09-04']['1001'].status).toBe('present');
      expect(dict['2026-09-04']['1001'].checkIn).toBe('06:50');
      expect(dict['2026-09-04']['1002'].status).toBe('absent');

      expect(dict['2026-09-03']).toBeDefined();
      expect(dict['2026-09-03']['1001'].lateMinutes).toBe(5);
    });
  });

  describe('mapUiToStaffAttendancePayload', () => {
    it('creates correct Supabase payload for check-in', () => {
      const record = {
        staffId: 'staff-uuid-301',
        date: '2026-09-04',
        status: 'present',
        checkIn: '06:50',
        lateMinutes: 0,
        earlyLeaveMinutes: 0,
        remarks: 'وقت پر'
      };

      const payload = mapUiToStaffAttendancePayload(record, 'madrasa-uuid-1', '2026-09-04');
      expect(payload).toEqual(expect.objectContaining({
        madrasa_id: 'madrasa-uuid-1',
        staff_id: 'staff-uuid-301',
        date: '2026-09-04',
        status: 'present',
        check_in: '06:50',
        check_out: null,
        late_minutes: 0,
        early_leave_minutes: 0,
        remarks: 'وقت پر'
      }));
    });

    it('creates correct Supabase payload for check-out', () => {
      const record = {
        staffId: 'staff-uuid-301',
        date: '2026-09-04',
        status: 'present',
        checkIn: '06:50',
        checkOut: '14:30',
        lateMinutes: 0,
        earlyLeaveMinutes: 15,
        remarks: 'جلدی رخصت'
      };

      const payload = mapUiToStaffAttendancePayload(record, 'madrasa-uuid-1', '2026-09-04');
      expect(payload).toEqual(expect.objectContaining({
        madrasa_id: 'madrasa-uuid-1',
        staff_id: 'staff-uuid-301',
        date: '2026-09-04',
        status: 'present',
        check_in: '06:50',
        check_out: '14:30',
        late_minutes: 0,
        early_leave_minutes: 15,
        remarks: 'جلدی رخصت'
      }));
    });

    it('sets null check_in and check_out when status is absent or leave', () => {
      const record = {
        staffId: 'staff-uuid-302',
        date: '2026-09-04',
        status: 'absent',
        checkIn: '06:50',
        checkOut: '14:45'
      };

      const payload = mapUiToStaffAttendancePayload(record, 'madrasa-uuid-1', '2026-09-04');
      expect(payload.status).toBe('absent');
      expect(payload.check_in).toBeNull();
      expect(payload.check_out).toBeNull();
      expect(payload.late_minutes).toBe(0);
      expect(payload.early_leave_minutes).toBe(0);
    });

    it('creates correct Supabase payload for half_leave and preserves late and early minutes', () => {
      const record = {
        staffId: 'staff-uuid-303',
        date: '2026-09-04',
        status: 'half_leave',
        checkIn: '07:05',
        checkOut: '13:15',
        lateMinutes: 15,
        earlyLeaveMinutes: 90,
        remarks: 'آدھی چھٹی'
      };

      const payload = mapUiToStaffAttendancePayload(record, 'madrasa-uuid-1', '2026-09-04');
      expect(payload).toEqual(expect.objectContaining({
        madrasa_id: 'madrasa-uuid-1',
        staff_id: 'staff-uuid-303',
        date: '2026-09-04',
        status: 'half_leave',
        check_in: '07:05',
        check_out: '13:15',
        late_minutes: 15,
        early_leave_minutes: 90,
        remarks: 'آدھی چھٹی'
      }));
    });

    it('preserves late and early minutes for half_leave even if check_in/check_out are omitted', () => {
      const record = {
        staffId: 'staff-uuid-304',
        date: '2026-09-04',
        status: 'half_leave',
        lateMinutes: 0,
        earlyLeaveMinutes: 90
      };

      const payload = mapUiToStaffAttendancePayload(record, 'madrasa-uuid-1', '2026-09-04');
      expect(payload.status).toBe('half_leave');
      expect(payload.check_in).toBeNull();
      expect(payload.check_out).toBeNull();
      expect(payload.late_minutes).toBe(0);
      expect(payload.early_leave_minutes).toBe(90);
    });
  });

  describe('Staff Attendance Mapper Round-Trip for half_leave', () => {
    it('preserves status, early_leave_minutes = 90, and late_minutes = 15 through UI -> Payload -> Supabase Row -> UI', () => {
      const initialUiRecord = {
        staffId: 'staff-uuid-501',
        date: '2026-09-04',
        status: 'half_leave',
        checkIn: '07:05',
        checkOut: '13:15',
        lateMinutes: 15,
        earlyLeaveMinutes: 90,
        remarks: 'آدھی رخصت'
      };

      // 1. UI -> Payload
      const payload = mapUiToStaffAttendancePayload(initialUiRecord, 'madrasa-uuid-101', '2026-09-04');
      expect(payload.status).toBe('half_leave');
      expect(payload.late_minutes).toBe(15);
      expect(payload.early_leave_minutes).toBe(90);

      // 2. Simulated Supabase Row as returned from DB
      const dbRow = {
        id: 'att-half-leave-1',
        ...payload,
        created_at: '2026-09-04T07:05:00Z',
        updated_at: '2026-09-04T13:15:00Z',
        staff: {
          id: 'staff-uuid-501',
          name: 'استاد زید',
          staff_code: 1005,
          shift_start: '06:50:00',
          shift_end: '14:45:00'
        }
      };

      // 3. DB Row -> UI Record
      const loadedUi = mapStaffAttendanceRowToUi(dbRow);
      expect(loadedUi.status).toBe('half_leave');
      expect(loadedUi.lateMinutes).toBe(15);
      expect(loadedUi.earlyLeaveMinutes).toBe(90);
      expect(loadedUi.checkIn).toBe('07:05');
      expect(loadedUi.checkOut).toBe('13:15');
      expect(loadedUi.teacherId).toBe('1005');
      expect(loadedUi.teacherName).toBe('استاد زید');
    });
  });

  describe('derivePendingDate (Two-phase check-in -> check-out lock detection)', () => {
    it('returns the date when at least one present row has check_in but no check_out', () => {
      const rows = [
        {
          date: '2026-09-04',
          status: 'present',
          check_in: '06:50',
          check_out: null
        },
        {
          date: '2026-09-04',
          status: 'absent',
          check_in: null,
          check_out: null
        }
      ];

      expect(derivePendingDate(rows)).toBe('2026-09-04');
    });

    it('returns null when all present rows have completed checkout', () => {
      const rows = [
        {
          date: '2026-09-04',
          status: 'present',
          check_in: '06:50',
          check_out: '14:45'
        },
        {
          date: '2026-09-04',
          status: 'absent',
          check_in: null,
          check_out: null
        }
      ];

      expect(derivePendingDate(rows)).toBeNull();
    });

    it('returns null when no rows have status "present"', () => {
      const rows = [
        {
          date: '2026-09-04',
          status: 'absent',
          check_in: null,
          check_out: null
        },
        {
          date: '2026-09-04',
          status: 'leave',
          check_in: null,
          check_out: null
        }
      ];

      expect(derivePendingDate(rows)).toBeNull();
    });

    it('picks the most recent date when multiple dates have pending checkout', () => {
      const rows = [
        {
          date: '2026-09-02',
          status: 'present',
          check_in: '06:50',
          check_out: null
        },
        {
          date: '2026-09-04',
          status: 'present',
          check_in: '06:50',
          check_out: null
        },
        {
          date: '2026-09-03',
          status: 'present',
          check_in: '06:50',
          check_out: null
        }
      ];

      expect(derivePendingDate(rows)).toBe('2026-09-04');
    });
  });
});
