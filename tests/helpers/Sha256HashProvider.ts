import { createHash } from "node:crypto";

import {
  HashAlgorithms,
  type HashAlgorithm,
} from "../../src/algorithms/CryptoAlgorithms.js";
import type { HashProvider } from "../../src/providers/HashProvider.js";

/**
 * Minimal SHA-256 HashProvider used only by this package's own test
 * suite to exercise ArtifactHasher/SignatureVerifier's CryptoProvider
 * dependency without pulling in any bootstrap machinery.
 */
export class Sha256HashProvider implements HashProvider {
  readonly algorithm: HashAlgorithm = HashAlgorithms.SHA256;

  async hash(data: Uint8Array): Promise<string> {
    return createHash("sha256").update(data).digest("hex");
  }
}
