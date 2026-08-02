import { describe, expect, it } from "vitest";

import { ArtifactHasher } from "../src/ArtifactHasher.js";
import { Dilithium3SignatureProvider } from "../src/providers/signature/Dilithium3SignatureProvider.js";
import type { CryptoProvider } from "../src/providers/CryptoProvider.js";
import { Sha256HashProvider } from "./helpers/Sha256HashProvider.js";

// ArtifactHasher never calls into the signature provider, but
// CryptoProvider requires one structurally. Dilithium3SignatureProvider
// is safe to construct unconditionally here (construction itself does
// not touch node:crypto; only sign()/verify() do), so these tests do
// not need the ML-DSA-65 runtime support guard the signing tests use.
function buildCrypto(): CryptoProvider {
  return {
    hash: new Sha256HashProvider(),
    signature: new Dilithium3SignatureProvider(),
  };
}

describe("ArtifactHasher", () => {
  it("hashes identical input to the same output (deterministic)", async () => {
    const hasher = new ArtifactHasher(buildCrypto());

    const artifact = { amount: 100, currency: "USD" };

    const first = await hasher.hash(artifact);
    const second = await hasher.hash(artifact);

    expect(first).toBe(second);
  });

  it("hashes logically-equivalent input (different key order) to the same output", async () => {
    const hasher = new ArtifactHasher(buildCrypto());

    const first = await hasher.hash({ amount: 100, currency: "USD" });
    const second = await hasher.hash({ currency: "USD", amount: 100 });

    expect(first).toBe(second);
  });

  it("produces different hashes for different inputs", async () => {
    const hasher = new ArtifactHasher(buildCrypto());

    const first = await hasher.hash({ amount: 100 });
    const second = await hasher.hash({ amount: 200 });

    expect(first).not.toBe(second);
  });

  it("handles empty-object input sensibly", async () => {
    const hasher = new ArtifactHasher(buildCrypto());

    const digest = await hasher.hash({});

    expect(typeof digest).toBe("string");
    expect(digest.length).toBeGreaterThan(0);
  });

  it("handles empty-string input sensibly", async () => {
    const hasher = new ArtifactHasher(buildCrypto());

    const digest = await hasher.hash("");

    expect(typeof digest).toBe("string");
    expect(digest.length).toBeGreaterThan(0);
  });

  it("handles null input sensibly, and distinctly from other empty values", async () => {
    const hasher = new ArtifactHasher(buildCrypto());

    const nullDigest = await hasher.hash(null);
    const emptyObjectDigest = await hasher.hash({});
    const emptyStringDigest = await hasher.hash("");

    expect(typeof nullDigest).toBe("string");
    expect(nullDigest).not.toBe(emptyObjectDigest);
    expect(nullDigest).not.toBe(emptyStringDigest);
    expect(emptyObjectDigest).not.toBe(emptyStringDigest);
  });
});
