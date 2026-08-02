import { generateKeyPairSync } from "node:crypto";

import { describe, expect, it } from "vitest";

import { CanonicalSerializer } from "../src/CanonicalSerializer.js";
import { SignatureVerifier } from "../src/SignatureVerifier.js";
import { Dilithium3SignatureProvider } from "../src/providers/signature/Dilithium3SignatureProvider.js";
import type { CryptoProvider } from "../src/providers/CryptoProvider.js";
import {
  isMlDsa65Supported,
  ML_DSA_65_SKIP_REASON,
} from "../src/support/MlDsaSupport.js";
import { Sha256HashProvider } from "./helpers/Sha256HashProvider.js";

function generateKeyPair() {
  return generateKeyPairSync("ml-dsa-65");
}

function buildCrypto(): CryptoProvider {
  return {
    hash: new Sha256HashProvider(),
    signature: new Dilithium3SignatureProvider(),
  };
}

/**
 * Signs an artifact the same way SignatureVerifier verifies it: via
 * CanonicalSerializer first, so the signature is over the exact bytes
 * the verifier will independently recompute.
 */
async function signArtifact(
  artifact: unknown,
  privateKey: ReturnType<typeof generateKeyPair>["privateKey"],
) {
  const bytes = new CanonicalSerializer().serialize(artifact);

  return new Dilithium3SignatureProvider().sign(bytes, privateKey);
}

describe.skipIf(!isMlDsa65Supported())(
  `SignatureVerifier${isMlDsa65Supported() ? "" : ` [SKIPPED: ${ML_DSA_65_SKIP_REASON}]`}`,
  () => {
  it("verifies a valid signature/artifact pair as valid", async () => {
    const verifier = new SignatureVerifier(buildCrypto());
    const { privateKey, publicKey } = generateKeyPair();

    const artifact = { amount: 100, currency: "USD" };
    const signature = await signArtifact(artifact, privateKey);

    expect(await verifier.verify(artifact, signature, publicKey)).toBe(
      true,
    );
  });

  it("verifies a logically-equivalent artifact (different key order) as valid", async () => {
    const verifier = new SignatureVerifier(buildCrypto());
    const { privateKey, publicKey } = generateKeyPair();

    const signature = await signArtifact(
      { amount: 100, currency: "USD" },
      privateKey,
    );

    expect(
      await verifier.verify(
        { currency: "USD", amount: 100 },
        signature,
        publicKey,
      ),
    ).toBe(true);
  });

  it("rejects a tampered artifact (content changed after signing)", async () => {
    const verifier = new SignatureVerifier(buildCrypto());
    const { privateKey, publicKey } = generateKeyPair();

    const signature = await signArtifact(
      { amount: 100, currency: "USD" },
      privateKey,
    );

    const tampered = { amount: 999, currency: "USD" };

    expect(
      await verifier.verify(tampered, signature, publicKey),
    ).toBe(false);
  });

  it("rejects a signature that doesn't match the provided key", async () => {
    const verifier = new SignatureVerifier(buildCrypto());
    const keyPairA = generateKeyPair();
    const keyPairB = generateKeyPair();

    const artifact = { amount: 100, currency: "USD" };
    const signature = await signArtifact(artifact, keyPairA.privateKey);

    expect(
      await verifier.verify(artifact, signature, keyPairB.publicKey),
    ).toBe(false);
  });

  //
  // Empirically confirmed: node:crypto's native ML-DSA-65 verify()
  // resolves to false for malformed/truncated/empty signature bytes
  // rather than throwing, so these are ordinary rejection cases, not
  // exception paths — asserted directly rather than wrapped in
  // expect(...).rejects.
  //
  it("rejects a malformed (non-base64) signature without crashing", async () => {
    const verifier = new SignatureVerifier(buildCrypto());
    const { publicKey } = generateKeyPair();

    const artifact = { amount: 100, currency: "USD" };

    await expect(
      verifier.verify(artifact, "not-valid-base64-!!!!", publicKey),
    ).resolves.toBe(false);
  });

  it("rejects an empty signature string without crashing", async () => {
    const verifier = new SignatureVerifier(buildCrypto());
    const { publicKey } = generateKeyPair();

    const artifact = { amount: 100, currency: "USD" };

    await expect(
      verifier.verify(artifact, "", publicKey),
    ).resolves.toBe(false);
  });

  it("rejects a truncated (valid-base64, wrong-length) signature without crashing", async () => {
    const verifier = new SignatureVerifier(buildCrypto());
    const { privateKey, publicKey } = generateKeyPair();

    const artifact = { amount: 100, currency: "USD" };
    const signature = await signArtifact(artifact, privateKey);
    const truncated = signature.slice(0, 20);

    await expect(
      verifier.verify(artifact, truncated, publicKey),
    ).resolves.toBe(false);
  });
});
