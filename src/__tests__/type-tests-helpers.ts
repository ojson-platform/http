/**
 * Type testing utilities for verifying type inference in the library.
 *
 * These utilities use TypeScript's type system to verify that types are inferred
 * correctly. They are compile-time only - no runtime behavior.
 */

/**
 * Checks if two types are exactly equal (not just assignable).
 */
export type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;

/**
 * Ensures that a value is assignable to type T.
 */
export function expectType<T>(_value: T): void {
  // Runtime no-op - all checks happen at compile time.
}

/**
 * Ensures that a type is exactly equal to an expected type.
 */
export type Expect<T extends true> = T;
