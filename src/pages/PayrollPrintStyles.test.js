import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('PayrollPrintStyles - AGENTS.md Print & Report Printing Rules Verification', () => {
  const payrollPrintCssPath = path.resolve(__dirname, 'PayrollPrint.css');
  const printCssPath = path.resolve(__dirname, '../styles/print.css');

  const payrollPrintCss = fs.readFileSync(payrollPrintCssPath, 'utf8');
  const printCss = fs.readFileSync(printCssPath, 'utf8');

  it('asserts print.css still contains the original global @page A5 landscape line and new payroll pages', () => {
    expect(printCss).toContain('size: A5 landscape;');
    expect(printCss).toContain('@page payroll-slip');
    expect(printCss).toContain('size: A4 portrait;');
    expect(printCss).toContain('margin: 10mm;');
    expect(printCss).toContain('@page payroll-report');
    expect(printCss).toContain('size: A4 landscape;');
    expect(printCss).toContain('body.printing-payroll');
  });

  it('asserts all printable rules in PayrollPrint.css follow AGENTS.md black and white rules', () => {
    // Split CSS into rule blocks
    const rawBlocks = payrollPrintCss.split('}');

    const printableRuleBlocks = [];
    for (const block of rawBlocks) {
      const parts = block.split('{');
      if (parts.length < 2) continue;
      const selector = parts[0].trim();
      const declarations = parts[1].trim();

      // Check if selector matches printable document or elements
      const isPrintable = selector
        .split(',')
        .some((s) => {
          const trimmed = s.trim();
          return (
            trimmed.startsWith('.payroll-print-document') ||
            trimmed.startsWith('.payroll-slip-') ||
            trimmed.startsWith('.payroll-report-')
          );
        });

      if (isPrintable) {
        printableRuleBlocks.push({ selector, declarations });
      }
    }

    expect(printableRuleBlocks.length).toBeGreaterThan(0);

    for (const { selector, declarations } of printableRuleBlocks) {
      // 1. No print-color-adjust allowed in printable styles
      expect(
        declarations,
        `Selector "${selector}" must not contain print-color-adjust`
      ).not.toMatch(/print-color-adjust/i);

      // 2. Parse individual declarations
      const declList = declarations.split(';').map((d) => d.trim()).filter(Boolean);

      for (const decl of declList) {
        const colonIdx = decl.indexOf(':');
        if (colonIdx === -1) continue;
        const prop = decl.substring(0, colonIdx).trim().toLowerCase();
        const val = decl.substring(colonIdx + 1).trim().toLowerCase();

        // 2a. Backgrounds must be white, transparent, or none
        if (prop === 'background' || prop === 'background-color') {
          const isAllowedBg =
            val.includes('#ffffff') ||
            val.includes('#fff') ||
            val.includes('white') ||
            val.includes('transparent') ||
            val.includes('none');
          expect(
            isAllowedBg,
            `Selector "${selector}" has background "${val}", but must be white/transparent/none`
          ).toBe(true);
        }

        // 2b. Text colors must be black (#000000 or black)
        if (prop === 'color') {
          const isBlackText =
            val.includes('#000000') ||
            val.includes('#000') ||
            val.includes('black') ||
            val.includes('inherit');
          expect(
            isBlackText,
            `Selector "${selector}" has text color "${val}", but must be black`
          ).toBe(true);
        }

        // 2c. Border colors must be light gray (#bdbdbd) or black-free
        if (
          prop === 'border' ||
          prop === 'border-color' ||
          prop === 'border-top' ||
          prop === 'border-bottom' ||
          prop === 'border-left' ||
          prop === 'border-right'
        ) {
          // If value is 'none', it is fine
          if (val === 'none') continue;

          // Must not have pure black borders (#000000 or black)
          expect(
            val,
            `Selector "${selector}" has black border "${val}", but must be light gray (#bdbdbd)`
          ).not.toMatch(/(#000000|#000\b|black)/i);

          // If a color is specified, it should be light gray (#bdbdbd)
          if (val.includes('#')) {
            expect(
              val,
              `Selector "${selector}" border color must be #bdbdbd (light gray)`
            ).toContain('#bdbdbd');
          }
        }
      }
    }
  });

  it('asserts page properties are set for named pages on container classes', () => {
    expect(payrollPrintCss).toMatch(/\.payroll-slip-container\s*\{[^}]*page:\s*payroll-slip/);
    expect(payrollPrintCss).toMatch(/\.payroll-report-container\s*\{[^}]*page:\s*payroll-report/);
  });

  it('asserts print.css contains scoped print isolation rules for payroll printing (Stage 6f)', () => {
    // Must contain scoped selector for print isolation
    expect(printCss).toContain('body.printing-payroll #print-portal-root');
    expect(printCss).toContain('body.printing-payroll #print-portal-root *');

    // Must force transparent background and black color with !important
    expect(printCss).toContain('background: transparent !important');
    expect(printCss).toContain('color: #000000 !important');

    // Must reset table width and min-width to 0 with !important
    expect(printCss).toContain('width: 100% !important');
    expect(printCss).toContain('min-width: 0 !important');
    expect(printCss).toContain('display: table !important');
    expect(printCss).toContain('border-color: #bdbdbd !important');

    // Must still contain the original global @page A5 landscape and named payroll pages
    expect(printCss).toContain('@page {');
    expect(printCss).toContain('size: A5 landscape;');
    expect(printCss).toContain('@page payroll-slip');
    expect(printCss).toContain('@page payroll-report');
  });
});
