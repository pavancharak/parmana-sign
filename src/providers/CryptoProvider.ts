import type { HashProvider } from "./HashProvider.js";

import type { SignatureProvider } from "./SignatureProvider.js";

/**
 * Configured cryptographic capabilities.
 *
 * Consumers use the configured providers without
 * knowing the underlying algorithms.
 */
export interface CryptoProvider {
  readonly hash: HashProvider;

  readonly signature: SignatureProvider;
}
