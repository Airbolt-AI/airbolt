import fc from 'fast-check';

/**
 * Simplified Property Testing Framework
 *
 * Focused on the 5 most common property testing patterns with minimal API surface.
 * Designed for high adoption and easy maintenance.
 */

// ===== CORE API =====

/**
 * Test a function with property-based testing
 *
 * @example
 * propertyTest(calculateTotal, generators.items(), ['nonNegative', 'finite']);
 */
export function propertyTest<T, R>(
  testFunction: (input: T) => R,
  generator: fc.Arbitrary<T>,
  invariantNames: string[],
  options?: { iterations?: number }
): void {
  const { iterations = 1000 } = options || {};

  fc.assert(
    fc.property(generator, input => {
      const output = testFunction(input);

      // Apply selected invariants - validate each one exists and execute
      for (const invariantName of invariantNames) {
        // Type-safe invariant lookup with proper type guard
        // eslint-disable-next-line security/detect-object-injection
        const invariant = simpleInvariants[invariantName];
        if (!invariant) {
          throw new Error(
            `Unknown invariant: ${invariantName}. Available: ${Object.keys(simpleInvariants).join(', ')}`
          );
        }

        if (!invariant(input, output)) {
          throw new Error(`Invariant violation: ${invariantName}`);
        }
      }

      return true;
    }),
    { numRuns: iterations }
  );
}

// ===== COMMON GENERATORS =====

/**
 * Pre-built generators for common business domain testing
 */
export const generators = {
  /**
   * Financial amounts (0 to 1M, 2 decimal places)
   */
  money: (): fc.Arbitrary<number> =>
    fc
      .float({ min: 0, max: 1_000_000, noNaN: true })
      .map(n => Math.round(n * 100) / 100),

  /**
   * Quantities (non-negative integers)
   */
  quantity: (): fc.Arbitrary<number> => fc.integer({ min: 0, max: 1000 }),

  /**
   * Shopping cart items
   */
  items: (): fc.Arbitrary<Array<{ price: number; quantity: number }>> =>
    fc.array(
      fc.record({
        price: generators.money(),
        quantity: generators.quantity(),
      }),
      { maxLength: 10 }
    ),

  /**
   * Percentages (0-100)
   */
  percentage: (): fc.Arbitrary<number> =>
    fc.float({ min: 0, max: 100, noNaN: true }),

  /**
   * Tax rates (0-1)
   */
  taxRate: (): fc.Arbitrary<number> =>
    fc.float({ min: 0, max: 1, noNaN: true }),

  /**
   * Email addresses (valid format)
   */
  email: (): fc.Arbitrary<string> => fc.emailAddress(),

  /**
   * Currency codes
   */
  currency: (): fc.Arbitrary<string> =>
    fc.constantFrom('USD', 'EUR', 'GBP', 'JPY', 'CAD'),
};

// ===== ESSENTIAL INVARIANTS =====

/**
 * Common mathematical invariants that most business functions should satisfy
 */
export const simpleInvariants: Record<
  string,
  (input: any, output: any) => boolean
> = {
  /**
   * Output must be non-negative
   */
  nonNegative: (_input: any, output: number): boolean => output >= 0,

  /**
   * Output must be finite (not NaN or Infinity)
   */
  finite: (_input: any, output: number): boolean => Number.isFinite(output),

  /**
   * Empty input should produce zero output
   */
  zeroForEmpty: (input: Array<any>, output: number): boolean =>
    input.length === 0 ? output === 0 : true,

  /**
   * Output should not exceed reasonable bounds for financial calculations
   */
  reasonable: (_input: any, output: number): boolean =>
    output <= Number.MAX_SAFE_INTEGER && output >= -Number.MAX_SAFE_INTEGER,

  /**
   * String output should not be empty for valid input
   */
  nonEmptyString: (_input: any, output: string): boolean =>
    typeof output === 'string' && output.length > 0,
};

// ===== CONVENIENCE FUNCTIONS =====

/**
 * Test financial calculation functions with common invariants
 */
export function testFinancialFunction<T>(
  fn: (input: T) => number,
  generator: fc.Arbitrary<T>,
  options?: { iterations?: number }
): void {
  propertyTest(fn, generator, ['nonNegative', 'finite', 'reasonable'], options);
}

/**
 * Test array processing functions with common invariants
 */
export function testArrayFunction<T>(
  fn: (input: T[]) => number,
  itemGenerator: fc.Arbitrary<T>,
  options?: { iterations?: number }
): void {
  const arrayGenerator = fc.array(itemGenerator, { maxLength: 10 });
  propertyTest(fn, arrayGenerator, ['finite', 'zeroForEmpty'], options);
}

/**
 * Test string formatting functions
 */
export function testFormatterFunction<T>(
  fn: (input: T) => string,
  generator: fc.Arbitrary<T>,
  options?: { iterations?: number }
): void {
  propertyTest(fn, generator, ['nonEmptyString'], options);
}

// ===== USAGE EXAMPLES =====

/**
 * Example property test for a calculation function
 *
 * @example
 * ```typescript
 * import { propertyTest, generators } from '@airbolt/types/property-testing-simple';
 *
 * describe('calculateTotal - Properties', () => {
 *   it('should satisfy mathematical invariants', () => {
 *     propertyTest(
 *       calculateTotal,
 *       generators.items(),
 *       ['nonNegative', 'finite']
 *     );
 *   });
 *
 *   it('should handle edge cases', () => {
 *     testArrayFunction(calculateTotal, generators.money());
 *   });
 * });
 * ```
 */
export const exampleUsage = {
  financial: `
// Test a financial calculation
propertyTest(
  calculateDiscount,
  fc.tuple(generators.money(), generators.percentage()),
  ['nonNegative', 'finite']
);`,

  array: `
// Test an array processing function
testArrayFunction(
  calculateTotal,
  fc.record({ price: generators.money(), quantity: generators.quantity() })
);`,

  formatter: `
// Test a formatter function
testFormatterFunction(
  formatCurrency,
  generators.money(),
  { iterations: 500 }
);`,
};

// ===== MIGRATION HELPERS =====

/**
 * Helper to migrate from complex framework to simple framework
 */
export const migrate = {
  /**
   * Convert testInvariants call to propertyTest
   */
  fromTestInvariants: `
// Old complex API:
testInvariants(generator, fn, [invariants.nonNegative, invariants.finite]);

// New simple API:
propertyTest(fn, generator, ['nonNegative', 'finite']);`,

  /**
   * Convert fc.assert boilerplate to propertyTest
   */
  fromFcAssert: `
// Old boilerplate:
fc.assert(fc.property(generator, (input) => {
  const output = fn(input);
  expect(output).toBeGreaterThanOrEqual(0);
  expect(Number.isFinite(output)).toBe(true);
}));

// New simple API:
propertyTest(fn, generator, ['nonNegative', 'finite']);`,
};
