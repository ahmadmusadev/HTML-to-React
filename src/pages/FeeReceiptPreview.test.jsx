import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FeeReceiptDocument } from './Fees';
import fs from 'fs';
import path from 'path';

describe('FeeReceiptDocument Component & CSS Polish', () => {
  const dummyReceiptData = {
    studentId: '01',
    studentName: 'MUHAMMAD TALHA',
    studentFather: 'MUHAMMAD ARSHAD',
    feeMonth: '2026-09',
    timestamp: '2026-09-18T11:08:00Z',
    feeMethod: 'Cash',
    feeAmount: 4444,
    feeArrears: 0,
    totalPaid: 4444
  };

  const dummyMadrasa = {
    name: 'جامع مسجد اللہ اکبر'
  };

  it('renders all receipt labels with exact background and text styles', () => {
    render(
      <FeeReceiptDocument
        receiptData={dummyReceiptData}
        activeMadrasa={dummyMadrasa}
        students={[]}
        classesList={[]}
        isPrintMode={false}
      />
    );

    // Verify all 8 label cells exist in the grid table
    const expectedLabels = [
      'Student Name',
      'Student ID',
      'Father Name',
      'Class',
      'Fee Month',
      'Date',
      'Payment Method',
      'Timestamp'
    ];

    expectedLabels.forEach((label) => {
      const cell = screen.getByText(label);
      expect(cell).toBeDefined();
      expect(cell.className).toContain('receipt-cell-label');
      expect(cell.style.backgroundColor).toBe('rgb(9, 27, 62)'); // #091b3e
      expect(cell.style.color).toBe('rgb(255, 255, 255)');
    });

    // Verify Breakdown headers and total row
    const descHeader = screen.getByText('Description');
    const amountHeader = screen.getByText('Amount (Rs.)');
    expect(descHeader.style.backgroundColor).toBe('rgb(9, 27, 62)');
    expect(amountHeader.style.backgroundColor).toBe('rgb(9, 27, 62)');

    const totalRowDesc = screen.getByText('TOTAL RECEIVED');
    expect(totalRowDesc.style.backgroundColor).toBe('rgb(9, 27, 62)');
    expect(totalRowDesc.style.color).toBe('rgb(255, 255, 255)');
  });

  it('renders student values with white background and dark text', () => {
    render(
      <FeeReceiptDocument
        receiptData={dummyReceiptData}
        activeMadrasa={dummyMadrasa}
        students={[]}
        classesList={[]}
        isPrintMode={false}
      />
    );

    const nameCell = screen.getByText('MUHAMMAD TALHA');
    expect(nameCell.className).toContain('receipt-cell-value');
    expect(nameCell.style.backgroundColor).toBe('rgb(255, 255, 255)');
    expect(nameCell.style.color).toBe('rgb(0, 0, 0)');

    const fatherCell = screen.getByText('MUHAMMAD ARSHAD');
    expect(fatherCell.className).toContain('receipt-cell-value');
    expect(fatherCell.style.backgroundColor).toBe('rgb(255, 255, 255)');
    expect(fatherCell.style.color).toBe('rgb(0, 0, 0)');
  });

  it('renders dedicated signature lines and titles for Cashier and Parent', () => {
    const { container } = render(
      <FeeReceiptDocument
        receiptData={dummyReceiptData}
        activeMadrasa={dummyMadrasa}
        students={[]}
        classesList={[]}
        isPrintMode={false}
      />
    );

    const cashierTitle = screen.getByText('Authorized Cashier Signature');
    const parentTitle = screen.getByText('Parent / Payer Signature');
    expect(cashierTitle).toBeDefined();
    expect(parentTitle).toBeDefined();

    const sigLines = container.querySelectorAll('.receipt-sig-line');
    expect(sigLines.length).toBe(2);

    const footerNote = screen.getByText(/Note: This is a computerized official proof of payment/i);
    expect(footerNote).toBeDefined();
  });

  it('verifies dark-mode.css exempts receipt-paper from global table striping and hover rules', () => {
    const darkModeCss = fs.readFileSync(path.resolve(__dirname, '../dark-mode.css'), 'utf8');

    // Verify even row striping excludes receipt-paper
    expect(darkModeCss).toContain(':not(.receipt-paper tr):not(.receipt-wrap tr):nth-child(even)');
    // Verify hover excludes receipt-paper
    expect(darkModeCss).toContain(':not(.receipt-paper tr):not(.receipt-wrap tr):hover');
    // Verify dark-mode high specificity rule for receipt-cell-label
    expect(darkModeCss).toContain('[data-theme="dark"] .receipt-paper tr:nth-child(even) td.receipt-cell-label');
  });

  it('verifies Fees.css constrains receipt paper and tables to prevent horizontal overflow and excessive margins', () => {
    const feesCss = fs.readFileSync(path.resolve(__dirname, 'Fees.css'), 'utf8');

    // Verify receipt-paper width: 100% and max-width: 580px
    expect(feesCss).toContain('max-width: 580px !important');
    // Verify tables have min-width: 0 to override any global 900px table min-width
    expect(feesCss).toContain('min-width: 0 !important');
    // Verify tightened vertical padding
    expect(feesCss).toContain('padding: 12px 22px 14px 22px !important');
    // Verify signature line styling exists
    expect(feesCss).toContain('.receipt-sig-line');
    // Verify responsive media query exists
    expect(feesCss).toContain('@media (max-width: 640px)');
    // Verify print alignment is flex-start with 0 auto margin
    expect(feesCss).toContain('align-items: flex-start !important');
  });
});
