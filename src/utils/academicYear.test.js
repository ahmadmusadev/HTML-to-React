import { describe, it, expect } from 'vitest';
import { getCurrentAcademicYearStart, formatAcademicYear, getAcademicYearOptions } from './academicYear';

describe('academicYear Utility Functions', () => {
  it('getCurrentAcademicYearStart returns a valid number', () => {
    const startYear = getCurrentAcademicYearStart();
    expect(typeof startYear).toBe('number');
    expect(startYear).toBeGreaterThan(2020);
  });

  it('formatAcademicYear formats start year to startYear–shortEndYear', () => {
    expect(formatAcademicYear(2025)).toBe('2025–26');
    expect(formatAcademicYear('2026')).toBe('2026–27');
  });

  it('getAcademicYearOptions returns a list of year options with value and label', () => {
    const options = getAcademicYearOptions();
    expect(Array.isArray(options)).toBe(true);
    expect(options.length).toBeGreaterThan(0);
    expect(options[0]).toHaveProperty('value');
    expect(options[0]).toHaveProperty('label');
  });
});
