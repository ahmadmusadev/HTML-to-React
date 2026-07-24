/**
 * Utility functions for Academic Year (April - March cycle).
 */

/**
 * Get current academic start year dynamically based on current date.
 * Academic year starts in April (Month 4).
 * E.g., July 2026 -> 2026 (Academic Year 2026–27)
 * E.g., Feb 2027 -> 2026 (Academic Year 2026–27)
 */
export function getCurrentAcademicYearStart(date = new Date()) {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = d.getMonth() + 1; // 1-indexed
  return month >= 4 ? year : year - 1;
}

/**
 * Format start year (e.g. 2026) to Academic Year display string (e.g. "2026–27").
 * Handles numbers, numeric strings, or already formatted strings ("2026–27").
 */
export function formatAcademicYear(yearVal) {
  if (!yearVal) return '';
  const str = String(yearVal).trim();
  if (str.includes('–') || (str.includes('-') && str.length > 5)) return str;
  const num = parseInt(str, 10);
  if (isNaN(num)) return str;
  const nextShort = String(num + 1).slice(-2);
  return `${num}–${nextShort}`;
}

/**
 * Get dynamic list of Academic Year options for dropdowns.
 * Current academic year is ALWAYS at the top of the list by default.
 * Options format: [{ value: "2026", label: "2026–27" }, ...]
 */
export function getAcademicYearOptions(pastYears = 4, futureYears = 1) {
  const currentStart = getCurrentAcademicYearStart();
  const options = [
    { value: String(currentStart), label: formatAcademicYear(currentStart) }
  ];

  // Add past academic years
  for (let i = 1; i <= pastYears; i++) {
    const y = currentStart - i;
    options.push({ value: String(y), label: formatAcademicYear(y) });
  }

  // Add future academic years
  for (let i = 1; i <= futureYears; i++) {
    const y = currentStart + i;
    options.push({ value: String(y), label: formatAcademicYear(y) });
  }

  return options;
}
