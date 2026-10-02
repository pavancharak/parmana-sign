import { createHash } from "node:crypto";

/**
 * Ed25519 large-message commitment (v1), as used by Parmana.
 *
 * AWS KMS caps the raw message it will sign with an Ed25519 key at
 * 4096 bytes. Parmana therefore signs any message longer than that as
 * a fixed-size commitment: a domain-separation prefix followed by the
 * SHA-512 digest of the message. The signature itself is still a pure
 * Ed25519 signature, so any standard Ed25519 library can verify it
 * once it rebuilds the same commitment.
 *
 * The scheme is a pure function of message length:
 *
 * - length <= limit: signed and verified raw.
 * - length > limit: signed as the commitment. A verifier also accepts
 *   a raw signature over such a message, because local key signers
 *   have always signed large messages raw.
 *
 * The prefix contains a NUL byte and never occurs at the start of a
 * canonical JSON message (which starts with "{"), so a signature over
 * a commitment cannot be replayed as a signature over a small raw
 * message. A commitment signature over a message at or below the
 * limit is never accepted, which prevents downgrading a small message
 * to the commitment form.
 *
 * Must stay byte-for-byte identical to Parmana's own
 * SignatureCommitment, or signatures issued by Parmana will not
 * verify here.
 */
export const KMS_RAW_MESSAGE_LIMIT_BYTES = 4096;

const COMMITMENT_PREFIX = Buffer.from(
  "PARMANA-ED25519-LARGE-MESSAGE-V1\0",
  "utf8",
);

/**
 * Whether a message is large enough to be signed as a commitment.
 */
export function requiresCommitment(data: Uint8Array): boolean {
  return data.length > KMS_RAW_MESSAGE_LIMIT_BYTES;
}

/**
 * The commitment bytes signed in place of a large message.
 */
export function commitmentMessage(data: Uint8Array): Uint8Array {
  return Buffer.concat([
    COMMITMENT_PREFIX,
    createHash("sha512").update(data).digest(),
  ]);
}
