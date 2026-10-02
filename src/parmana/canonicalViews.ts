import type {
  ExecutionIntent,
  ExecutionTrustRecord,
} from "./types.js";

/**
 * The exact projection of an Execution Trust Record that
 * Parmana hashes and signs with its legacy `signature`
 * field. Excludes `trustRecordHash` and `signature`
 * (computed from it) and every field Parmana appends
 * after signing.
 *
 * Must match Parmana's ExecutionTrustRecordCanonicalView
 * exactly: any difference makes every genuine record
 * fail to verify.
 */
export function canonicalExecutionTrustRecord(
  trustRecord: ExecutionTrustRecord,
) {
  return {
    trustRecordId: trustRecord.trustRecordId,

    businessTransactionId:
      trustRecord.businessTransactionId,

    transaction: trustRecord.transaction,

    authorization: trustRecord.authorization,

    overrides: trustRecord.overrides,

    executions: trustRecord.executions,

    createdAt: trustRecord.createdAt,
  };
}

/**
 * The projection signed by each entry of the hybrid
 * `signatures` array: the legacy canonical content plus
 * `schemaVersion`. Kept separate so the legacy signature's
 * signed content never changes.
 */
export function hybridCanonicalExecutionTrustRecord(
  trustRecord: ExecutionTrustRecord,
  schemaVersion: number,
) {
  return {
    ...canonicalExecutionTrustRecord(trustRecord),
    schemaVersion,
  };
}

/**
 * The exact projection of an Execution Intent that Parmana
 * hashes and signs. Excludes `intentHash` and `signature`.
 *
 * Must match Parmana's ExecutionIntentCanonicalView
 * exactly.
 */
export function canonicalExecutionIntent(
  intent: ExecutionIntent,
) {
  return {
    intentId: intent.intentId,

    businessTransactionId: intent.businessTransactionId,

    decisionId: intent.decisionId,

    authorizationId: intent.authorizationId,

    policyName: intent.policyName,

    policyVersion: intent.policyVersion,

    policyContentHash: intent.policyContentHash,

    signalsHash: intent.signalsHash,

    businessTransactionHash:
      intent.businessTransactionHash,

    action: intent.action,

    target: intent.target,

    submittedBy: intent.submittedBy,

    grantedCapability: intent.grantedCapability,

    createdAt: intent.createdAt,
  };
}
