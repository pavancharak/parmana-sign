/**
 * Canonical hash algorithms supported by this library.
 *
 * New algorithms are additive.
 */
export const HashAlgorithms = {
  SHA256: "sha256",
  SHA3512: "sha3-512",
  BLAKE3: "blake3",
} as const;

export type HashAlgorithm =
  (typeof HashAlgorithms)[keyof typeof HashAlgorithms];

/**
 * Canonical signature algorithms.
 */
export const SignatureAlgorithms = {
  ED25519: "ed25519",
  ECDSA_P256: "ecdsa-p256",

  //
  // Post-Quantum Ready
  //
  DILITHIUM3: "dilithium3",
  DILITHIUM5: "dilithium5",
  SPHINCS_PLUS: "sphincs-plus",
} as const;

export type SignatureAlgorithm =
  (typeof SignatureAlgorithms)[keyof typeof SignatureAlgorithms];
