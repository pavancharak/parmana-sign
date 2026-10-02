/**
 * Minimal structural types for the Parmana artifacts this
 * library can verify offline.
 *
 * Only the fields that participate in hashing or signing
 * are typed precisely. Nested content (the business
 * transaction, executions, overrides, the bound
 * authorization) is carried as opaque JSON: the verifier
 * never interprets it, it only serializes it canonically.
 *
 * Timestamps accept either a Date or its ISO-8601 string,
 * so a record parsed straight from JSON verifies the same
 * as one built in memory (CanonicalSerializer renders a
 * Date as its ISO string).
 */

export type Timestamp = Date | string;

/**
 * The single, always-present signature on a Parmana
 * artifact.
 */
export interface ParmanaSignature {
  readonly algorithm: string;

  readonly keyId: string;

  /**
   * Base64-encoded signature bytes.
   */
  readonly value: string;

  readonly signedAt?: Timestamp;
}

/**
 * One entry in a hybrid-signed artifact's `signatures`
 * array. Present only on records signed in Parmana's
 * hybrid mode (for example Ed25519 + ML-DSA-65).
 */
export interface SignatureEntry {
  readonly algorithm: string;

  readonly keyId: string;

  /**
   * Base64-encoded signature bytes.
   */
  readonly signature: string;
}

/**
 * A signed Parmana Execution Trust Record.
 */
export interface ExecutionTrustRecord {
  readonly trustRecordId: string;

  readonly businessTransactionId: string;

  readonly transaction: unknown;

  readonly authorization?: unknown;

  readonly overrides: readonly unknown[];

  readonly executions: readonly unknown[];

  readonly createdAt: Timestamp;

  /**
   * Hex SHA-256 of the canonical record content.
   */
  readonly trustRecordHash: string;

  readonly signature: ParmanaSignature;

  readonly schemaVersion?: number;

  readonly signatures?: readonly SignatureEntry[];
}

/**
 * A signed Parmana Execution Intent, written before an
 * approved action is released.
 */
export interface ExecutionIntent {
  readonly intentId: string;

  readonly businessTransactionId: string;

  readonly decisionId: string;

  readonly authorizationId: string;

  readonly policyName: string;

  readonly policyVersion: string;

  readonly policyContentHash?: string;

  readonly signalsHash?: string;

  readonly businessTransactionHash: string;

  readonly action: string;

  readonly target: string;

  readonly submittedBy?: string;

  readonly grantedCapability?: string;

  readonly createdAt: Timestamp;

  /**
   * Hex SHA-256 of the canonical intent content.
   */
  readonly intentHash: string;

  readonly signature: ParmanaSignature;
}
