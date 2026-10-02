import {
  generateKeyPairSync,
  type KeyObject,
} from "node:crypto";

import { describe, expect, it } from "vitest";

import { ArtifactHasher } from "../src/ArtifactHasher.js";
import { CanonicalSerializer } from "../src/CanonicalSerializer.js";
import {
  canonicalExecutionIntent,
  canonicalExecutionTrustRecord,
  hybridCanonicalExecutionTrustRecord,
} from "../src/parmana/canonicalViews.js";
import {
  verifyExecutionIntentOffline,
  verifyExecutionTrustRecordOffline,
} from "../src/parmana/OfflineVerifier.js";
import type {
  ExecutionIntent,
  ExecutionTrustRecord,
} from "../src/parmana/types.js";
import { Sha256HashProvider } from "../src/providers/hash/Sha256HashProvider.js";
import type { SignatureProvider } from "../src/providers/SignatureProvider.js";
import { Dilithium3SignatureProvider } from "../src/providers/signature/Dilithium3SignatureProvider.js";
import { Ed25519SignatureProvider } from "../src/providers/signature/Ed25519SignatureProvider.js";
import {
  isMlDsa65Supported,
  ML_DSA_65_SKIP_REASON,
} from "../src/support/MlDsaSupport.js";

const createdAt = new Date("2026-01-01T00:00:00Z");

const hasher = new ArtifactHasher({
  hash: new Sha256HashProvider(),
  signature: new Ed25519SignatureProvider(),
});

const serializer = new CanonicalSerializer();

function pem(key: KeyObject): string {
  return key.export({ format: "pem", type: "spki" }).toString();
}

async function signArtifact(
  provider: SignatureProvider,
  artifact: unknown,
  privateKey: KeyObject,
): Promise<string> {
  return provider.sign(serializer.serialize(artifact), privateKey);
}

async function buildSignedRecord(
  privateKey: KeyObject,
  keyId: string,
): Promise<ExecutionTrustRecord> {
  const draft = {
    trustRecordId: "etr-1",
    businessTransactionId: "btx-1",
    transaction: {
      businessTransactionId: "btx-1",
      status: "EXECUTED",
      createdAt,
    },
    overrides: [],
    executions: [],
    createdAt,
  };

  const unsigned: ExecutionTrustRecord = {
    ...draft,
    trustRecordHash: await hasher.hash(
      canonicalExecutionTrustRecord(
        draft as unknown as ExecutionTrustRecord,
      ),
    ),
    signature: { algorithm: "ed25519", keyId, value: "" },
  };

  const value = await signArtifact(
    new Ed25519SignatureProvider(),
    canonicalExecutionTrustRecord(unsigned),
    privateKey,
  );

  return {
    ...unsigned,
    signature: { ...unsigned.signature, value },
  };
}

describe("verifyExecutionTrustRecordOffline", () => {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const publicKeys = { "ed-key": pem(publicKey) };

  it("verifies a genuine record", async () => {
    const record = await buildSignedRecord(privateKey, "ed-key");

    const result = await verifyExecutionTrustRecordOffline(
      record,
      publicKeys,
    );

    expect(result).toEqual({
      valid: true,
      hashValid: true,
      legacySignatureValid: true,
      algorithmsChecked: ["ed25519"],
      errors: [],
    });
  });

  it("accepts a KeyObject as well as a PEM string", async () => {
    const record = await buildSignedRecord(privateKey, "ed-key");

    const result = await verifyExecutionTrustRecordOffline(
      record,
      { "ed-key": publicKey },
    );

    expect(result.valid).toBe(true);
  });

  it("verifies the same record after a JSON round trip", async () => {
    const record = await buildSignedRecord(privateKey, "ed-key");

    const parsed = JSON.parse(
      JSON.stringify(record),
    ) as ExecutionTrustRecord;

    const result = await verifyExecutionTrustRecordOffline(
      parsed,
      publicKeys,
    );

    expect(result.valid).toBe(true);
  });

  it("fails when the content is tampered with after signing", async () => {
    const record = await buildSignedRecord(privateKey, "ed-key");

    const tampered: ExecutionTrustRecord = {
      ...record,
      transaction: { status: "APPROVED" },
    };

    const result = await verifyExecutionTrustRecordOffline(
      tampered,
      publicKeys,
    );

    expect(result.valid).toBe(false);
    expect(result.hashValid).toBe(false);
    expect(result.legacySignatureValid).toBe(false);
  });

  it("fails when the hash is replaced to match tampered content", async () => {
    const record = await buildSignedRecord(privateKey, "ed-key");

    const tampered = {
      ...record,
      executions: [{ executionId: "forged" }],
    };

    const forged: ExecutionTrustRecord = {
      ...tampered,
      trustRecordHash: await hasher.hash(
        canonicalExecutionTrustRecord(tampered),
      ),
    };

    const result = await verifyExecutionTrustRecordOffline(
      forged,
      publicKeys,
    );

    expect(result.hashValid).toBe(true);
    expect(result.legacySignatureValid).toBe(false);
    expect(result.valid).toBe(false);
  });

  it("fails against the wrong public key", async () => {
    const record = await buildSignedRecord(privateKey, "ed-key");
    const { publicKey: other } = generateKeyPairSync("ed25519");

    const result = await verifyExecutionTrustRecordOffline(
      record,
      { "ed-key": pem(other) },
    );

    expect(result.valid).toBe(false);
    expect(result.legacySignatureValid).toBe(false);
  });

  it("fails closed when no key is supplied for the keyId", async () => {
    const record = await buildSignedRecord(privateKey, "ed-key");

    const result = await verifyExecutionTrustRecordOffline(
      record,
      {},
    );

    expect(result.valid).toBe(false);
    expect(result.errors).toContain(
      'no public key supplied for keyId "ed-key".',
    );
  });

  it("does not resolve keyIds through the prototype chain", async () => {
    const record = await buildSignedRecord(privateKey, "constructor");

    const result = await verifyExecutionTrustRecordOffline(
      record,
      {},
    );

    expect(result.valid).toBe(false);
    expect(result.errors).toContain(
      'no public key supplied for keyId "constructor".',
    );
  });

  it("fails closed for an unsupported algorithm", async () => {
    const record = await buildSignedRecord(privateKey, "ed-key");

    const result = await verifyExecutionTrustRecordOffline(
      {
        ...record,
        signature: {
          ...record.signature,
          algorithm: "sphincs-plus",
        },
      },
      publicKeys,
    );

    expect(result.valid).toBe(false);
    expect(result.errors).toContain(
      "unsupported algorithm: sphincs-plus.",
    );
  });

  it("returns a failed result instead of throwing on a malformed record", async () => {
    const record = await buildSignedRecord(privateKey, "ed-key");

    const malformed = {
      ...record,
      signature: undefined,
      signatures: "not-an-array",
    } as unknown as ExecutionTrustRecord;

    const result = await verifyExecutionTrustRecordOffline(
      malformed,
      publicKeys,
    );

    expect(result.valid).toBe(false);
    expect(result.legacySignatureValid).toBe(false);
    expect(result.hybridSignaturesValid).toBe(false);
  });

  describe.skipIf(!isMlDsa65Supported())(
    `hybrid signatures${isMlDsa65Supported() ? "" : ` [SKIPPED: ${ML_DSA_65_SKIP_REASON}]`}`,
    () => {
      async function buildHybridRecord() {
        const pq = generateKeyPairSync("ml-dsa-65");
        const record = await buildSignedRecord(privateKey, "ed-key");
        const artifact = hybridCanonicalExecutionTrustRecord(record, 2);

        const hybrid: ExecutionTrustRecord = {
          ...record,
          schemaVersion: 2,
          signatures: [
            {
              algorithm: "ed25519",
              keyId: "ed-key",
              signature: await signArtifact(
                new Ed25519SignatureProvider(),
                artifact,
                privateKey,
              ),
            },
            {
              algorithm: "dilithium3",
              keyId: "pq-key",
              signature: await signArtifact(
                new Dilithium3SignatureProvider(),
                artifact,
                pq.privateKey,
              ),
            },
          ],
        };

        return {
          hybrid,
          keys: { ...publicKeys, "pq-key": pem(pq.publicKey) },
        };
      }

      it("verifies a genuine hybrid record", async () => {
        const { hybrid, keys } = await buildHybridRecord();

        const result = await verifyExecutionTrustRecordOffline(
          hybrid,
          keys,
        );

        expect(result.valid).toBe(true);
        expect(result.hybridSignaturesValid).toBe(true);
        expect(result.algorithmsChecked).toEqual([
          "ed25519",
          "ed25519",
          "dilithium3",
        ]);
      });

      it("rejects a hybrid record with one entry stripped", async () => {
        const { hybrid, keys } = await buildHybridRecord();

        const result = await verifyExecutionTrustRecordOffline(
          {
            ...hybrid,
            signatures: hybrid.signatures?.slice(0, 1) ?? [],
          },
          keys,
        );

        expect(result.valid).toBe(false);
        expect(result.legacySignatureValid).toBe(true);
        expect(result.hybridSignaturesValid).toBe(false);
      });

      it("rejects a duplicated algorithm", async () => {
        const { hybrid, keys } = await buildHybridRecord();
        const first = hybrid.signatures?.[0];

        const result = await verifyExecutionTrustRecordOffline(
          {
            ...hybrid,
            signatures: first ? [first, first] : [],
          },
          keys,
        );

        expect(result.valid).toBe(false);
        expect(result.hybridSignaturesValid).toBe(false);
      });

      it("rejects a changed schemaVersion", async () => {
        const { hybrid, keys } = await buildHybridRecord();

        const result = await verifyExecutionTrustRecordOffline(
          { ...hybrid, schemaVersion: 3 },
          keys,
        );

        expect(result.valid).toBe(false);
        expect(result.legacySignatureValid).toBe(true);
        expect(result.hybridSignaturesValid).toBe(false);
      });
    },
  );
});

describe("verifyExecutionIntentOffline", () => {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");

  async function buildIntent(): Promise<ExecutionIntent> {
    const draft = {
      intentId: "int-1",
      businessTransactionId: "btx-1",
      decisionId: "dec-1",
      authorizationId: "auth-1",
      policyName: "payments",
      policyVersion: "1",
      businessTransactionHash: "ab".repeat(32),
      action: "payment.create",
      target: "account:42",
      createdAt,
    };

    const unsigned: ExecutionIntent = {
      ...draft,
      intentHash: "",
      signature: { algorithm: "ed25519", keyId: "ed-key", value: "" },
    };

    const canonical = canonicalExecutionIntent(unsigned);

    return {
      ...unsigned,
      intentHash: await hasher.hash(canonical),
      signature: {
        ...unsigned.signature,
        value: await signArtifact(
          new Ed25519SignatureProvider(),
          canonical,
          privateKey,
        ),
      },
    };
  }

  it("verifies a genuine intent", async () => {
    const result = await verifyExecutionIntentOffline(
      await buildIntent(),
      { "ed-key": pem(publicKey) },
    );

    expect(result.valid).toBe(true);
  });

  it("fails when the target is changed", async () => {
    const intent = await buildIntent();

    const result = await verifyExecutionIntentOffline(
      { ...intent, target: "account:43" },
      { "ed-key": pem(publicKey) },
    );

    expect(result.valid).toBe(false);
    expect(result.hashValid).toBe(false);
    expect(result.legacySignatureValid).toBe(false);
  });
});
