import {
  sign,
  verify,
  type KeyObject,
} from "node:crypto";

import {
  SignatureAlgorithms,
  type SignatureAlgorithm,
} from "../../algorithms/CryptoAlgorithms.js";

import {
  commitmentMessage,
  requiresCommitment,
} from "../../SignatureCommitment.js";
import type { SignatureProvider } from "../SignatureProvider.js";
import { assertKeyType } from "./assertKeyType.js";

const NODE_KEY_TYPE = "ed25519";

/**
 * Ed25519 Signature Provider.
 *
 * Stateless implementation of Ed25519 signing via
 * node:crypto.
 *
 * Signing always signs the raw message. Verification
 * additionally accepts Parmana's large-message
 * commitment form for messages over 4096 bytes (see
 * SignatureCommitment), so signatures issued by a
 * KMS-backed Parmana signer verify here too.
 *
 * Key management is delegated entirely to the caller.
 */
export class Ed25519SignatureProvider
  implements SignatureProvider
{
  public readonly algorithm: SignatureAlgorithm =
    SignatureAlgorithms.ED25519;

  constructor() {
    Object.freeze(this);
  }

  async sign(
    data: Uint8Array,
    privateKey: KeyObject,
  ): Promise<string> {
    assertKeyType(
      privateKey,
      NODE_KEY_TYPE,
      "sign",
    );

    const signature = sign(
      null,
      Buffer.from(data),
      privateKey,
    );

    return signature.toString("base64");
  }

  async verify(
    data: Uint8Array,
    signature: string,
    publicKey: KeyObject,
  ): Promise<boolean> {
    assertKeyType(
      publicKey,
      NODE_KEY_TYPE,
      "verify",
    );

    const signatureBytes = Buffer.from(
      signature,
      "base64",
    );

    if (
      verify(
        null,
        Buffer.from(data),
        publicKey,
        signatureBytes,
      )
    ) {
      return true;
    }

    if (requiresCommitment(data)) {
      return verify(
        null,
        Buffer.from(commitmentMessage(data)),
        publicKey,
        signatureBytes,
      );
    }

    return false;
  }
}
