# @parmana/sign

Standalone signing, verification, and canonical-hashing primitives for
TypeScript/Node, including a post-quantum ML-DSA-65 (Dilithium3)
signature provider built on Node's native `node:crypto` support
(Node >=24, OpenSSL >=3.5).

This is a general-purpose cryptographic primitives library. **It is not
an authorization or policy-evaluation system.** It signs, verifies, and
canonically hashes artifacts you give it — it makes no decisions about
whether an action should be allowed. It was extracted from
[Parmana](https://parmana.ai), an AI execution-authorization platform,
as the subset of that project's crypto layer that is generic enough to
stand on its own.

## What this is

- `SignatureProvider` — a minimal interface for sign/verify over a
  `node:crypto` `KeyObject`.
- `Dilithium3SignatureProvider` — an implementation of that interface
  for ML-DSA-65 (Dilithium3), a post-quantum signature scheme.
- `SignatureVerifier` / `ArtifactHasher` — small helpers that
  canonically serialize an arbitrary object (deterministic key
  ordering) before signing, verifying, or hashing it, so the same
  logical object always produces the same bytes regardless of how it
  was constructed.
- `CanonicalSerializer` — the deterministic serialization used by the
  above.

## What this is not

- Not a key-management system. You supply `KeyObject`s; this library
  never reads keys from disk, environment variables, or a network
  service.
- Not a policy engine, authorization system, or credential broker.
  Nothing here decides whether an action is permitted — it only signs
  and verifies data you already decided to sign.

## Installation

```bash
npm install @parmana/sign
```

## Quick start

```ts
import { generateKeyPairSync } from "node:crypto";
import { Dilithium3SignatureProvider } from "@parmana/sign";

const provider = new Dilithium3SignatureProvider();
const { privateKey, publicKey } = generateKeyPairSync("ml-dsa-65");

const data = new TextEncoder().encode("hello world");

const signature = await provider.sign(data, privateKey);
const valid = await provider.verify(data, signature, publicKey);

console.log(valid); // true
```

Using the canonical hasher/verifier with an arbitrary object instead of
raw bytes:

```ts
import {
  Dilithium3SignatureProvider,
  SignatureVerifier,
  ArtifactHasher,
  type CryptoProvider,
} from "@parmana/sign";

const crypto: CryptoProvider = {
  signature: new Dilithium3SignatureProvider(),
  hash: myHashProvider, // implement HashProvider, or bring your own
};

const hasher = new ArtifactHasher(crypto);
const digest = await hasher.hash({ amount: 100, currency: "USD" });
```

## Requirements

- Node.js >= 24 with OpenSSL >= 3.5 for ML-DSA-65 support. Use
  `isMlDsa65Supported()` to check at runtime before relying on the
  Dilithium3 provider; older runtimes throw synchronously on key
  generation instead of failing gracefully.

## Security

See [SECURITY.md](./SECURITY.md) for how to report a vulnerability.

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md).

## License

Apache License 2.0 — see [LICENSE](./LICENSE).
