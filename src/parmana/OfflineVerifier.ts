import {
  createPublicKey,
  KeyObject,
} from "node:crypto";

import { ArtifactHasher } from "../ArtifactHasher.js";
import { Sha256HashProvider } from "../providers/hash/Sha256HashProvider.js";
import type { SignatureProvider } from "../providers/SignatureProvider.js";
import { Dilithium3SignatureProvider } from "../providers/signature/Dilithium3SignatureProvider.js";
import { Ed25519SignatureProvider } from "../providers/signature/Ed25519SignatureProvider.js";
import { SignatureVerifier } from "../SignatureVerifier.js";

import {
  canonicalExecutionIntent,
  canonicalExecutionTrustRecord,
  hybridCanonicalExecutionTrustRecord,
} from "./canonicalViews.js";
import type {
  ExecutionIntent,
  ExecutionTrustRecord,
  SignatureEntry,
} from "./types.js";

/**
 * Public keys for offline verification, keyed by keyId.
 *
 * Each value is a PEM-encoded SPKI public key or a
 * node:crypto KeyObject. Supply an entry for every keyId
 * the artifact references.
 */
export type PublicKeyMap = Readonly<
  Record<string, string | KeyObject>
>;

export interface OfflineVerificationResult {
  /**
   * Overall result: the hash matches, the legacy signature
   * verifies, and (only when the artifact carries a
   * `signatures` array) every hybrid entry verifies.
   * `false` on any error as well as any cryptographic
   * failure; see `errors` for which.
   */
  readonly valid: boolean;

  /**
   * Whether the recorded hash matches a fresh SHA-256 hash
   * of the canonical content.
   */
  readonly hashValid: boolean;

  /**
   * Whether the always-present `signature` field verifies.
   */
  readonly legacySignatureValid: boolean;

  /**
   * Whether the hybrid `signatures` array verifies.
   * `undefined` means the artifact has no `signatures`
   * array, not that it failed. Whether hybrid signatures
   * are *required* is the caller's policy decision.
   */
  readonly hybridSignaturesValid?: boolean;

  /**
   * Every algorithm actually checked, in order.
   */
  readonly algorithmsChecked: readonly string[];

  /**
   * Human-readable reasons for every failed or skipped
   * check. Empty when `valid` is true.
   */
  readonly errors: readonly string[];
}

/**
 * The algorithms this verifier implements. Any other
 * algorithm identifier is rejected rather than skipped.
 */
function signatureProviderFor(
  algorithm: string,
): SignatureProvider | undefined {
  switch (algorithm) {
    case "ed25519":
      return new Ed25519SignatureProvider();
    case "dilithium3":
      return new Dilithium3SignatureProvider();
    default:
      return undefined;
  }
}

const hasher = new ArtifactHasher({
  hash: new Sha256HashProvider(),
  signature: new Ed25519SignatureProvider(),
});

/**
 * Verifies a Parmana Execution Trust Record with no
 * network, disk, or environment access: only the record
 * and the public keys are needed.
 *
 * Checks that `trustRecordHash` matches the canonical
 * content, that the legacy `signature` verifies, and, when
 * the record carries a hybrid `signatures` array, that it
 * has at least two entries with distinct algorithms and
 * every entry verifies.
 */
export async function verifyExecutionTrustRecordOffline(
  trustRecord: ExecutionTrustRecord,
  publicKeys: PublicKeyMap,
): Promise<OfflineVerificationResult> {
  const errors: string[] = [];
  const algorithmsChecked: string[] = [];

  const canonical =
    canonicalExecutionTrustRecord(trustRecord);

  const hashValid = await checkHash(
    canonical,
    trustRecord.trustRecordHash,
    "trustRecordHash",
    errors,
  );

  const legacySignatureValid = await verifyLegacySignature(
    trustRecord.signature,
    canonical,
    publicKeys,
    algorithmsChecked,
    errors,
  );

  let hybridSignaturesValid: boolean | undefined;

  const signatures: unknown = trustRecord.signatures;

  if (signatures !== undefined) {
    if (!Array.isArray(signatures)) {
      errors.push("signatures is present but is not an array.");
      hybridSignaturesValid = false;
    } else if (signatures.length > 0) {
      hybridSignaturesValid = await verifyHybridSignatures(
        signatures as readonly SignatureEntry[],
        hybridCanonicalExecutionTrustRecord(
          trustRecord,
          trustRecord.schemaVersion ?? 2,
        ),
        publicKeys,
        algorithmsChecked,
        errors,
      );
    }
  }

  return {
    valid:
      hashValid &&
      legacySignatureValid &&
      (hybridSignaturesValid ?? true),
    hashValid,
    legacySignatureValid,
    ...(hybridSignaturesValid !== undefined
      ? { hybridSignaturesValid }
      : {}),
    algorithmsChecked,
    errors,
  };
}

/**
 * Verifies a Parmana Execution Intent with no network,
 * disk, or environment access.
 *
 * A valid result proves the intent was signed by the
 * holder of the key and has not been altered. It does not
 * prove the action was released or what its result was:
 * an intent is written before release.
 */
export async function verifyExecutionIntentOffline(
  intent: ExecutionIntent,
  publicKeys: PublicKeyMap,
): Promise<OfflineVerificationResult> {
  const errors: string[] = [];
  const algorithmsChecked: string[] = [];

  const canonical = canonicalExecutionIntent(intent);

  const hashValid = await checkHash(
    canonical,
    intent.intentHash,
    "intentHash",
    errors,
  );

  const legacySignatureValid = await verifyLegacySignature(
    intent.signature,
    canonical,
    publicKeys,
    algorithmsChecked,
    errors,
  );

  return {
    valid: hashValid && legacySignatureValid,
    hashValid,
    legacySignatureValid,
    algorithmsChecked,
    errors,
  };
}

async function checkHash(
  canonical: unknown,
  recorded: string,
  fieldName: string,
  errors: string[],
): Promise<boolean> {
  const expected = await hasher.hash(canonical);

  if (expected === recorded) {
    return true;
  }

  errors.push(
    `${fieldName} mismatch: expected ${expected}, got ${String(recorded)}.`,
  );

  return false;
}

async function verifyLegacySignature(
  signature: unknown,
  artifact: unknown,
  publicKeys: PublicKeyMap,
  algorithmsChecked: string[],
  errors: string[],
): Promise<boolean> {
  if (typeof signature !== "object" || signature === null) {
    errors.push("signature is missing or malformed.");
    return false;
  }

  const { algorithm, keyId, value } = signature as Record<
    string,
    unknown
  >;

  return verifyOneEntry(
    { algorithm, keyId, signature: value },
    artifact,
    publicKeys,
    algorithmsChecked,
    errors,
  );
}

async function verifyHybridSignatures(
  signatures: readonly SignatureEntry[],
  artifact: unknown,
  publicKeys: PublicKeyMap,
  algorithmsChecked: string[],
  errors: string[],
): Promise<boolean> {
  let allValid = signatures.length >= 2;

  if (!allValid) {
    errors.push(
      `signatures array has ${signatures.length} entry, need at least 2 for a hybrid record.`,
    );
  }

  const seenAlgorithms = new Set<unknown>();

  for (const entry of signatures) {
    const { algorithm, keyId, signature } =
      (typeof entry === "object" && entry !== null
        ? entry
        : {}) as Partial<Record<keyof SignatureEntry, unknown>>;

    if (seenAlgorithms.has(algorithm)) {
      errors.push(
        `duplicate algorithm in signatures array: ${String(algorithm)}.`,
      );
      allValid = false;
      continue;
    }

    seenAlgorithms.add(algorithm);

    const entryValid = await verifyOneEntry(
      { algorithm, keyId, signature },
      artifact,
      publicKeys,
      algorithmsChecked,
      errors,
    );

    allValid = allValid && entryValid;
  }

  return allValid;
}

async function verifyOneEntry(
  entry: {
    readonly algorithm: unknown;
    readonly keyId: unknown;
    readonly signature: unknown;
  },
  artifact: unknown,
  publicKeys: PublicKeyMap,
  algorithmsChecked: string[],
  errors: string[],
): Promise<boolean> {
  const { algorithm, keyId, signature } = entry;

  if (
    typeof algorithm !== "string" ||
    typeof keyId !== "string" ||
    typeof signature !== "string"
  ) {
    errors.push(
      "signature entry is malformed: algorithm, keyId, and signature must all be strings.",
    );
    return false;
  }

  const signatureProvider = signatureProviderFor(algorithm);

  if (!signatureProvider) {
    errors.push(`unsupported algorithm: ${algorithm}.`);
    return false;
  }

  const keyMaterial = Object.hasOwn(publicKeys, keyId)
    ? publicKeys[keyId]
    : undefined;

  if (!keyMaterial) {
    errors.push(`no public key supplied for keyId "${keyId}".`);
    return false;
  }

  algorithmsChecked.push(algorithm);

  try {
    const publicKey =
      keyMaterial instanceof KeyObject
        ? keyMaterial
        : createPublicKey(keyMaterial);

    const verifier = new SignatureVerifier({
      hash: new Sha256HashProvider(),
      signature: signatureProvider,
    });

    const verified = await verifier.verify(
      artifact,
      signature,
      publicKey,
    );

    if (!verified) {
      errors.push(
        `signature verification failed for keyId "${keyId}" (${algorithm}).`,
      );
    }

    return verified;
  } catch (error) {
    errors.push(
      `error verifying keyId "${keyId}" (${algorithm}): ${
        error instanceof Error ? error.message : String(error)
      }`,
    );

    return false;
  }
}
