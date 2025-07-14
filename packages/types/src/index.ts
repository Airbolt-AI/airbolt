/**
 * @repo/types - Branded types for compile-time ID safety
 *
 * This package provides TypeScript branded types to prevent ID confusion
 * at compile time while maintaining runtime validation for safety.
 *
 * Key Features:
 * - Compile-time type safety prevents ID mixups
 * - Runtime validation ensures data integrity
 * - Zod integration for seamless API validation
 * - Enterprise-grade error handling
 * - Minimal performance overhead
 *
 * @example Basic Usage
 * ```typescript
 * import { UserId, OrderId } from '@repo/types';
 *
 * const userId = UserId('550e8400-e29b-41d4-a716-446655440000');
 * const orderId = OrderId('660e8400-e29b-41d4-a716-446655440000');
 *
 * // This will cause a compile error:
 * processOrder(userId); // ❌ Type error: UserId is not assignable to OrderId
 *
 * // This is type-safe:
 * processOrder(orderId); // ✅ Correct type
 * ```
 */

// Core branded type utilities
export {
  type Brand,
  type Unbranded,
  type ExtractBrand,
  type IsBranded,
  type Validator,
  type BrandConstructorOptions,
  BrandValidationError,
  createBrandConstructor,
  createUnsafeBrandConstructor,
  unwrap,
  brandedEquals,
  createBrandedComparator,
} from './brand.js';

// Validation utilities
export {
  isString,
  isNonEmptyString,
  isValidUuid,
  isValidUlid,
  isValidNanoid,
  isValidEmail,
  isPositiveInteger,
  isNonNegativeNumber,
  createStringLengthValidator,
  createRegexValidator,
  createAndValidator,
  createOrValidator,
  ValidationErrors,
} from './validators.js';

// Re-export everything from entity-ids
export * from './entity-ids.js';

// Re-export Zod integration
export * from './zod-integration.js';

// Property-based testing utilities
export * from './property-testing-simple.js';
