// Sign an arbitrary object and verify it, with Ed25519 and (when the
// runtime supports it) ML-DSA-65. Run: npm run build && node examples/sign-and-verify.mjs
import { generateKeyPairSync } from "node:crypto";

import {
  CanonicalSerializer,
  Dilithium3SignatureProvider,
  Ed25519SignatureProvider,
  isMlDsa65Supported,
  Sha256HashProvider,
  SignatureVerifier,
} from "@parmana/sign";

const order = { orderId: "ord_123", amount: 4200, currency: "USD" };

// Key order does not matter: both objects serialize to the same bytes.
const reordered = { currency: "USD", amount: 4200, orderId: "ord_123" };

const serializer = new CanonicalSerializer();

async function demo(name, provider, keyType) {
  const { privateKey, publicKey } = generateKeyPairSync(keyType);

  const signature = await provider.sign(serializer.serialize(order), privateKey);

  const verifier = new SignatureVerifier({
    hash: new Sha256HashProvider(),
    signature: provider,
  });

  const valid = await verifier.verify(reordered, signature, publicKey);
  const tampered = await verifier.verify(
    { ...order, amount: 42000 },
    signature,
    publicKey,
  );

  console.log(`${name}: genuine=${valid} tampered=${tampered}`);

  if (!valid || tampered) {
    throw new Error(`${name}: unexpected verification result`);
  }
}

await demo("ed25519", new Ed25519SignatureProvider(), "ed25519");

if (isMlDsa65Supported()) {
  await demo("ml-dsa-65", new Dilithium3SignatureProvider(), "ml-dsa-65");
} else {
  console.log("ml-dsa-65: skipped (requires Node >=24.6 with OpenSSL >=3.5)");
}
