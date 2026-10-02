import {
  generateKeyPairSync,
  sign,
} from "node:crypto";

import { describe, expect, it } from "vitest";

import { CryptoError } from "../src/errors/CryptoError.js";
import { Ed25519SignatureProvider } from "../src/providers/signature/Ed25519SignatureProvider.js";
import {
  commitmentMessage,
  KMS_RAW_MESSAGE_LIMIT_BYTES,
} from "../src/SignatureCommitment.js";

function generateKeyPair() {
  return generateKeyPairSync("ed25519");
}

describe("Ed25519SignatureProvider", () => {
  it("signs and verifies with caller-supplied keys", async () => {
    const provider = new Ed25519SignatureProvider();
    const { privateKey, publicKey } = generateKeyPair();

    const data = Buffer.from("execution authorization payload");

    const signature = await provider.sign(data, privateKey);

    expect(await provider.verify(data, signature, publicKey)).toBe(
      true,
    );
  });

  it("rejects a tampered message", async () => {
    const provider = new Ed25519SignatureProvider();
    const { privateKey, publicKey } = generateKeyPair();

    const signature = await provider.sign(
      Buffer.from("original message"),
      privateKey,
    );

    expect(
      await provider.verify(
        Buffer.from("tampered message"),
        signature,
        publicKey,
      ),
    ).toBe(false);
  });

  it("rejects a signature produced by a different keypair", async () => {
    const provider = new Ed25519SignatureProvider();
    const { privateKey } = generateKeyPair();
    const { publicKey: otherPublicKey } = generateKeyPair();

    const data = Buffer.from("message");
    const signature = await provider.sign(data, privateKey);

    expect(
      await provider.verify(data, signature, otherPublicKey),
    ).toBe(false);
  });

  it("refuses a key of the wrong type", async () => {
    const provider = new Ed25519SignatureProvider();
    const { privateKey } = generateKeyPairSync("ec", {
      namedCurve: "P-256",
    });

    await expect(
      provider.sign(Buffer.from("message"), privateKey),
    ).rejects.toBeInstanceOf(CryptoError);
  });

  describe("large-message commitment", () => {
    const large = Buffer.alloc(
      KMS_RAW_MESSAGE_LIMIT_BYTES + 1,
      0x61,
    );
    const atLimit = Buffer.alloc(
      KMS_RAW_MESSAGE_LIMIT_BYTES,
      0x61,
    );

    it("accepts a commitment signature over a message above the limit", async () => {
      const provider = new Ed25519SignatureProvider();
      const { privateKey, publicKey } = generateKeyPair();

      const signature = sign(
        null,
        Buffer.from(commitmentMessage(large)),
        privateKey,
      ).toString("base64");

      expect(
        await provider.verify(large, signature, publicKey),
      ).toBe(true);
    });

    it("still accepts a raw signature over a message above the limit", async () => {
      const provider = new Ed25519SignatureProvider();
      const { privateKey, publicKey } = generateKeyPair();

      const signature = await provider.sign(large, privateKey);

      expect(
        await provider.verify(large, signature, publicKey),
      ).toBe(true);
    });

    it("rejects a commitment signature over a message at the limit (no downgrade)", async () => {
      const provider = new Ed25519SignatureProvider();
      const { privateKey, publicKey } = generateKeyPair();

      const signature = sign(
        null,
        Buffer.from(commitmentMessage(atLimit)),
        privateKey,
      ).toString("base64");

      expect(
        await provider.verify(atLimit, signature, publicKey),
      ).toBe(false);
    });

    it("rejects a commitment signature over a different large message", async () => {
      const provider = new Ed25519SignatureProvider();
      const { privateKey, publicKey } = generateKeyPair();

      const signature = sign(
        null,
        Buffer.from(commitmentMessage(large)),
        privateKey,
      ).toString("base64");

      const other = Buffer.from(large);
      other[0] = 0x62;

      expect(
        await provider.verify(other, signature, publicKey),
      ).toBe(false);
    });
  });
});
