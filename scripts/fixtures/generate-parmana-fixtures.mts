import { generateKeyPairSync, sign, type KeyObject } from "node:crypto";

// Not type-checked (tsx strips types); Parmana's own types live in its repo.
type Loose = Record<string, unknown>;
import { writeFileSync } from "node:fs";

/**
 * Regenerates tests/fixtures/parmana-artifacts.json by signing sample
 * artifacts with Parmana's own @parmana/crypto source code (canonical
 * views, hasher, Ed25519/ML-DSA-65 providers, hybrid signer, and the
 * KMS large-message commitment), so tests/parmana-compat.test.ts checks
 * this library against the real signer, not against itself.
 *
 * Run via scripts/generate-parmana-fixtures.sh; requires Node >=24.6.
 */
const C = process.env.PARMANA_REPO + "/packages/crypto/src";
const { canonicalExecutionTrustRecord } = await import(C + "/ExecutionTrustRecordCanonicalView.ts");
const { canonicalExecutionIntent } = await import(C + "/ExecutionIntentCanonicalView.ts");
const { TrustRecordHasher } = await import(C + "/TrustRecordHasher.ts");
const { ArtifactSigner } = await import(C + "/ArtifactSigner.ts");
const { CanonicalSerializer } = await import(C + "/CanonicalSerializer.ts");
const { HybridSignatureProvider } = await import(C + "/HybridSignatureProvider.ts");
const { SHA256HashProvider } = await import(C + "/providers/hash/SHA256HashProvider.ts");
const { Ed25519SignatureProvider } = await import(C + "/providers/signature/Ed25519SignatureProvider.ts");
const { Dilithium3SignatureProvider } = await import(C + "/providers/signature/Dilithium3SignatureProvider.ts");
const { commitmentMessage, requiresCommitment } = await import(C + "/SignatureCommitment.ts");

const ed = generateKeyPairSync("ed25519");
const pq = generateKeyPairSync("ml-dsa-65");
const pem = (k: KeyObject) => k.export({ format: "pem", type: "spki" }).toString();
const edCrypto = { hash: new SHA256HashProvider(), signature: new Ed25519SignatureProvider() };
const pqCrypto = { hash: new SHA256HashProvider(), signature: new Dilithium3SignatureProvider() };
const hasher = new TrustRecordHasher(edCrypto);
const signer = new ArtifactSigner(edCrypto);
const t = new Date("2026-09-01T12:00:00.000Z");

function draft(id: string, big = false): Loose {
  return {
    trustRecordId: "etr-" + id, businessTransactionId: "btx-" + id,
    transaction: { businessTransactionId: "btx-" + id, status: "EXECUTED", action: "hubspot.deal.update",
      payload: { dealId: "123", amount: 4200, note: big ? "x".repeat(6000) : "café ✓" }, createdAt: t },
    authorization: { authorizationId: "auth-" + id, decision: "APPROVED", policyName: "deal-updates", policyVersion: "3" },
    overrides: [], executions: [{ executionId: "exe-" + id, status: "SUCCEEDED", completedAt: t }],
    verifications: [], receipts: [], createdAt: t, updatedAt: t,
  };
}
async function legacy(id: string, big = false) {
  const d = draft(id, big);
  const trustRecordHash = await hasher.hash(canonicalExecutionTrustRecord(d));
  const r = { ...d, trustRecordHash, signature: { algorithm: "ed25519", keyId: "ed-key-1", value: "", signedAt: t } };
  r.signature.value = await signer.sign(canonicalExecutionTrustRecord(r), ed.privateKey);
  return r;
}
const keys = { getPrivateKey: async (id: string) => (id === "ed-key-1" ? ed.privateKey : pq.privateKey),
               getPublicKey: async (id: string) => (id === "ed-key-1" ? ed.publicKey : pq.publicKey) };

const legacyRecord = await legacy("legacy");
const hybridBase = await legacy("hybrid");
const hybrid = new HybridSignatureProvider({ primary: edCrypto, secondary: pqCrypto }, keys);
const signatures = await hybrid.sign({ ...canonicalExecutionTrustRecord(hybridBase), schemaVersion: 2 }, "ed-key-1", "pq-key-1");
const hybridRecord = { ...hybridBase, schemaVersion: 2, signatures };
if (!(await hybrid.verify({ ...canonicalExecutionTrustRecord(hybridBase), schemaVersion: 2 }, signatures))) throw new Error("self-check failed");

// Large record signed the way Parmana's KmsSigner does it (commitment).
const bigDraft = draft("large-kms", true);
const bigHash = await hasher.hash(canonicalExecutionTrustRecord(bigDraft));
const bigBytes = new CanonicalSerializer().serialize(canonicalExecutionTrustRecord(bigDraft));
if (!requiresCommitment(bigBytes)) throw new Error("not large");
const largeKmsRecord = { ...bigDraft, trustRecordHash: bigHash,
  signature: { algorithm: "ed25519", keyId: "ed-key-1", signedAt: t,
    value: sign(null, Buffer.from(commitmentMessage(bigBytes)), ed.privateKey).toString("base64") } };
const largeLocalRecord = await legacy("large-local", true);

const intentDraft: Loose = { intentId: "int-1", businessTransactionId: "btx-legacy", decisionId: "dec-1", authorizationId: "auth-legacy",
  policyName: "deal-updates", policyVersion: "3", policyContentHash: "ab".repeat(32), businessTransactionHash: "cd".repeat(32),
  action: "hubspot.deal.update", target: "deal:123", submittedBy: "agent:sales-bot", createdAt: t };
const intentHash = await hasher.hash(canonicalExecutionIntent(intentDraft));
const intent = { ...intentDraft, intentHash, signature: { algorithm: "ed25519", keyId: "ed-key-1", signedAt: t,
  value: await signer.sign(canonicalExecutionIntent(intentDraft), ed.privateKey) } };

writeFileSync(process.argv[2], JSON.stringify({
  _note: "Generated by scripts/generate-parmana-fixtures.sh using Parmana's real @parmana/crypto signing code. Do not edit by hand.",
  publicKeys: { "ed-key-1": pem(ed.publicKey), "pq-key-1": pem(pq.publicKey) },
  legacyRecord, hybridRecord, largeKmsRecord, largeLocalRecord, intent }, null, 2) + "\n");
console.log("ok");
