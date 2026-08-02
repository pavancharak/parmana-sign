import { CanonicalSerializer } from "./CanonicalSerializer.js";

import type { CryptoProvider } from "./providers/CryptoProvider.js";

/**
 * Artifact Hasher.
 *
 * Produces a deterministic cryptographic hash for an
 * immutable artifact.
 */
export class ArtifactHasher {
  constructor(
    private readonly crypto: CryptoProvider,

    private readonly serializer = new CanonicalSerializer(),
  ) {}

  /**
   * Hashes an immutable object.
   */
  async hash(value: unknown): Promise<string> {
    const bytes = this.serializer.serialize(value);

    return this.crypto.hash.hash(bytes);
  }
}
