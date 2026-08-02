import type { HashAlgorithm } from "../algorithms/CryptoAlgorithms.js";

/**
 * Hash Provider.
 *
 * Abstraction for cryptographic hashing.
 */
export interface HashProvider {
  /**
   * Canonical algorithm identifier.
   */
  readonly algorithm: HashAlgorithm;

  /**
   * Computes a cryptographic hash.
   */
  hash(data: Uint8Array): Promise<string>;
}
