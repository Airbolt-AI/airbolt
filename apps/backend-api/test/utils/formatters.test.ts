import { describe, it, expect } from 'vitest';
import { propertyTest, generators } from '@airbolt/types';
import fc from 'fast-check';

import {
  formatCurrency,
  formatPercentage,
  formatFileSize,
  type Currency,
} from '../../src/utils/formatters.js';

describe('formatCurrency', () => {
  it('should format USD by default', () => {
    expect(formatCurrency(1234.56)).toBe('$1,234.56');
  });

  it('should format different currencies', () => {
    expect(formatCurrency(1234.56, 'EUR')).toBe('€1,234.56');
    expect(formatCurrency(1234.56, 'GBP')).toBe('£1,234.56');
    expect(formatCurrency(1234.56, 'JPY')).toBe('¥1,235'); // JPY doesn't use decimals
  });

  it('should handle zero amount', () => {
    expect(formatCurrency(0)).toBe('$0.00');
  });

  it('should handle negative amounts', () => {
    expect(formatCurrency(-100.5)).toBe('-$100.50');
  });

  it('should handle very large numbers', () => {
    expect(formatCurrency(1000000)).toBe('$1,000,000.00');
  });

  it('should handle very small numbers', () => {
    expect(formatCurrency(0.01)).toBe('$0.01');
  });

  it('should work with different locales', () => {
    const result = formatCurrency(1234.56, 'EUR', 'de-DE');
    // Different Node.js versions may format differently, just check it contains euro symbol and digits
    expect(result).toContain('€');
    expect(result).toMatch(/1.*2.*3.*4/); // Contains the digits in order
  });

  it('should throw error for invalid currency', () => {
    expect(() => formatCurrency(100, 'INVALID' as Currency)).toThrow();
  });

  it('should throw error for non-finite amounts', () => {
    expect(() => formatCurrency(Infinity)).toThrow(
      'Amount must be a finite number'
    );
    expect(() => formatCurrency(NaN)).toThrow('Amount must be a finite number');
  });

  it('should throw error for invalid locale', () => {
    expect(() => formatCurrency(100, 'USD', 'x')).toThrow();
  });
});

describe('formatPercentage', () => {
  it('should format percentage with default 2 decimals', () => {
    expect(formatPercentage(0.1234)).toBe('12.34%');
  });

  it('should format percentage with custom decimals', () => {
    expect(formatPercentage(0.1234, 0)).toBe('12%');
    expect(formatPercentage(0.1234, 1)).toBe('12.3%');
    expect(formatPercentage(0.1234, 3)).toBe('12.340%');
  });

  it('should handle zero percentage', () => {
    expect(formatPercentage(0)).toBe('0.00%');
  });

  it('should handle negative percentages', () => {
    expect(formatPercentage(-0.05)).toBe('-5.00%');
  });

  it('should handle percentages over 100%', () => {
    expect(formatPercentage(1.5)).toBe('150.00%');
  });

  it('should throw error for non-finite values', () => {
    expect(() => formatPercentage(Infinity)).toThrow(
      'Value must be a finite number'
    );
    expect(() => formatPercentage(NaN)).toThrow(
      'Value must be a finite number'
    );
  });

  it('should throw error for invalid decimal places', () => {
    expect(() => formatPercentage(0.5, -1)).toThrow(
      'Decimals must be between 0 and 10'
    );
    expect(() => formatPercentage(0.5, 11)).toThrow(
      'Decimals must be between 0 and 10'
    );
  });

  // Critical test for boundary condition mutation
  it('should accept exactly 10 decimal places', () => {
    expect(formatPercentage(0.123456789, 10)).toBe('12.3456789000%');
  });

  it('should reject exactly 11 decimal places', () => {
    expect(() => formatPercentage(0.5, 11)).toThrow(
      'Decimals must be between 0 and 10'
    );
  });
});

describe('formatFileSize', () => {
  it('should format bytes correctly', () => {
    expect(formatFileSize(0)).toBe('0.0 B');
    expect(formatFileSize(512)).toBe('512.0 B');
    expect(formatFileSize(1023)).toBe('1023.0 B');
  });

  it('should format kilobytes correctly', () => {
    expect(formatFileSize(1024)).toBe('1.0 KB');
    expect(formatFileSize(1536)).toBe('1.5 KB');
    expect(formatFileSize(1048575)).toBe('1024.0 KB');
  });

  it('should format megabytes correctly', () => {
    expect(formatFileSize(1048576)).toBe('1.0 MB');
    expect(formatFileSize(1572864)).toBe('1.5 MB');
  });

  it('should format gigabytes correctly', () => {
    expect(formatFileSize(1073741824)).toBe('1.0 GB');
  });

  it('should format terabytes correctly', () => {
    expect(formatFileSize(1099511627776)).toBe('1.0 TB');
  });

  it('should handle very large files', () => {
    expect(formatFileSize(1125899906842624)).toBe('1024.0 TB');
  });

  it('should throw error for negative bytes', () => {
    expect(() => formatFileSize(-100)).toThrow(
      'Bytes must be a non-negative integer'
    );
  });

  it('should throw error for non-integer bytes', () => {
    expect(() => formatFileSize(100.5)).toThrow(
      'Bytes must be a non-negative integer'
    );
  });

  // Critical tests for unit array mutations - these tests specifically target the survived mutants
  it('should use correct unit strings', () => {
    expect(formatFileSize(0)).toContain('B');
    expect(formatFileSize(1024)).toContain('KB');
    expect(formatFileSize(1024 * 1024)).toContain('MB');
    expect(formatFileSize(1024 * 1024 * 1024)).toContain('GB');
    expect(formatFileSize(1024 * 1024 * 1024 * 1024)).toContain('TB');
  });

  it('should not contain empty unit strings', () => {
    expect(formatFileSize(0)).not.toContain(' .');
    expect(formatFileSize(1024)).not.toContain(' .');
    expect(formatFileSize(1024 * 1024)).not.toContain(' .');
  });

  // Specific tests to catch each unit string mutation
  it('should use exact "B" unit string', () => {
    const result = formatFileSize(512);
    expect(result).toMatch(/512\.0 B$/);
    expect(result).not.toMatch(/512\.0 $/); // Would happen if B mutated to empty string
  });

  it('should never return empty unit strings for any size', () => {
    // This specifically catches mutations where first element of units array is changed to ""
    const result = formatFileSize(0); // Uses first unit 'B'
    expect(result).toBe('0.0 B');
    expect(result).not.toBe('0.0 '); // Would happen if units[0] mutated to ""
    expect(result.split(' ')[1]).toBe('B'); // Explicitly check the unit part
  });

  it('should use exact "KB" unit string', () => {
    const result = formatFileSize(1024);
    expect(result).toMatch(/1\.0 KB$/);
    expect(result).not.toMatch(/1\.0 $/); // Would happen if KB mutated to empty string
  });

  it('should use exact "MB" unit string', () => {
    const result = formatFileSize(1024 * 1024);
    expect(result).toMatch(/1\.0 MB$/);
    expect(result).not.toMatch(/1\.0 $/); // Would happen if MB mutated to empty string
  });

  it('should use exact "GB" unit string', () => {
    const result = formatFileSize(1024 * 1024 * 1024);
    expect(result).toMatch(/1\.0 GB$/);
    expect(result).not.toMatch(/1\.0 $/); // Would happen if GB mutated to empty string
  });

  it('should use exact "TB" unit string', () => {
    const result = formatFileSize(1024 * 1024 * 1024 * 1024);
    expect(result).toMatch(/1\.0 TB$/);
    expect(result).not.toMatch(/1\.0 $/); // Would happen if TB mutated to empty string
  });
});

// ===== Property-Based Tests =====

describe('formatCurrency - Property Tests', () => {
  it('should satisfy string formatting invariants', () => {
    propertyTest(
      (amount: number) => formatCurrency(amount),
      generators.money(),
      ['nonEmptyString']
    );
  });

  it('should work with all supported currencies', () => {
    propertyTest(
      ([amount, currency]: [number, Currency]) =>
        formatCurrency(amount, currency),
      fc.tuple(
        generators.money(),
        fc.constantFrom<Currency>('USD', 'EUR', 'GBP', 'JPY')
      ),
      ['nonEmptyString']
    );
  });
});

describe('formatPercentage - Property Tests', () => {
  it('should satisfy string formatting invariants', () => {
    propertyTest(
      (value: number) => formatPercentage(value / 100), // Convert percentage to decimal
      generators.percentage(),
      ['nonEmptyString']
    );
  });

  it('should handle all valid decimal places', () => {
    propertyTest(
      ([value, decimals]: [number, number]) =>
        formatPercentage(value / 100, decimals),
      fc.tuple(generators.percentage(), fc.integer({ min: 0, max: 10 })),
      ['nonEmptyString']
    );
  });
});

describe('formatFileSize - Property Tests', () => {
  it('should satisfy string formatting invariants', () => {
    propertyTest(
      formatFileSize,
      fc
        .integer({ min: 0, max: Number.MAX_SAFE_INTEGER })
        .filter(n => Number.isSafeInteger(n)),
      ['nonEmptyString']
    );
  });

  it('should handle all byte ranges correctly', () => {
    propertyTest(
      formatFileSize,
      fc.oneof(
        fc.constant(0),
        fc.integer({ min: 1, max: 1023 }), // Bytes
        fc.integer({ min: 1024, max: 1048575 }), // KB range
        fc.integer({ min: 1048576, max: 1073741823 }), // MB range
        fc.integer({ min: 1073741824, max: 1099511627775 }) // GB range
      ),
      ['nonEmptyString']
    );
  });
});
