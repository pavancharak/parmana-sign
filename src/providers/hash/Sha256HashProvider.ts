import { createHash } from "node:crypto";

import {
  HashAlgorithms,
  type HashAlgorithm,
} from "../../algorithms/CryptoAlgorithms.js";

import type { HashProvider } from "../HashProvider.js";

/**
 * SHA-256 Hash Provider.
 *
 * Returns the lowercase hex digest, matching the hash
 * format Parmana records carry.
 */
export class Sha256HashProvider implements HashProvider {
  public readonly algorithm: HashAlgorithm =
    HashAlgorithms.SHA256;

  async hash(data: Uint8Array): Promise<string> {
    return createHash("sha256")
      .update(data)
      .digest("hex");
  }
}
