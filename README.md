# @parmana/sign

[![OpenSSF Best Practices](https://www.bestpractices.dev/projects/13926/badge)](https://www.bestpractices.dev/projects/13926)

Applications that need to sign, verify, or deterministically hash data
usually end up solving the same three problems from scratch: a
consistent byte representation for arbitrary objects (so the same
logical value always hashes/signs the same way), a swappable signature
algorithm behind one interface, and support for post-quantum signatures
as classical algorithms start getting deprecated in security-sensitive
contexts. `@parmana/sign` is those three pieces as a small, standalone
library: canonical object serialization, a `SignatureProvider`
interface with a working ML-DSA-65 (Dilithium3) post-quantum
implementation built on Node's native `node:crypto` support (Node >=24,
OpenSSL >=3.5), and hash/verify helpers built on top.

**It is fully usable on its own, independent of Parmana** — it has no
dependency on Parmana's runtime, policy engine, or any other Parmana
package. It is also **not an authorization or policy-evaluation
system**: it signs, verifies, and canonically hashes artifacts you give
it, and makes no decisions about whether an action should be allowed.
It was extracted from [Parmana](https://parmanasystems.com), an AI
execution-authorization platform, as the subset of that project's crypto
layer that is generic enough to stand on its own.

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

## API

### `SignatureProvider` (interface)

Minimal sign/verify contract every signature implementation follows.
Key management is intentionally external — implementations take a
`node:crypto` `KeyObject`, never a file path, env var, or credential
store.

```ts
interface SignatureProvider {
  readonly algorithm: SignatureAlgorithm;
  sign(data: Uint8Array, privateKey: KeyObject): Promise<string>;
  verify(data: Uint8Array, signature: string, publicKey: KeyObject): Promise<boolean>;
}
```

### `Dilithium3SignatureProvider`

`SignatureProvider` implementation for ML-DSA-65 (Dilithium3), a
NIST-standardized post-quantum signature scheme. Stateless; safe to
share a single instance. Signatures are base64-encoded strings.
ML-DSA-65 is randomized — signing the same data twice with the same key
produces two different, both-valid signatures.

```ts
const provider = new Dilithium3SignatureProvider();
const signature: string = await provider.sign(data: Uint8Array, privateKey: KeyObject);
const valid: boolean = await provider.verify(data: Uint8Array, signature: string, publicKey: KeyObject);
```

Throws `CryptoError` if the supplied key's `asymmetricKeyType` isn't
`"ml-dsa-65"` — this catches accidentally signing with the wrong
algorithm's key material.

### `CanonicalSerializer`

Produces a deterministic byte representation of an arbitrary object:
object keys are sorted recursively, arrays keep their order, `Date`
becomes an ISO string. Two calls with structurally-equal-but
differently-ordered objects produce identical output.

```ts
const bytes: Uint8Array = new CanonicalSerializer().serialize(value: unknown);
```

### `ArtifactHasher`

Canonically serializes a value, then hashes it with a supplied
`CryptoProvider`'s hash implementation.

```ts
const hasher = new ArtifactHasher(crypto: CryptoProvider);
const digest: string = await hasher.hash(value: unknown);
```

### `SignatureVerifier`

Canonically serializes a value, then verifies a signature over it with
a supplied `CryptoProvider`'s signature implementation. This is the
counterpart consumers typically use instead of calling a
`SignatureProvider` directly, since it guarantees the same
serialization was used on both the signing and verifying side.

```ts
const verifier = new SignatureVerifier(crypto: CryptoProvider);
const valid: boolean = await verifier.verify(artifact: unknown, signature: string, publicKey: KeyObject);
```

## Requirements

- Requires Node.js >=24.6.0 (needs OpenSSL 3.5+ for ML-DSA-65 support
  via `node:crypto`). Node.js only added `node:crypto` support for
  ML-DSA KeyObjects, signing, and verification in v24.6.0
  ([nodejs/node#59259](https://github.com/nodejs/node/pull/59259)) —
  earlier 24.x releases do not have it even though they satisfy a
  plain `>=24` check. Use `isMlDsa65Supported()` to check at runtime
  before relying on the Dilithium3 provider regardless; older or
  non-conforming runtimes throw synchronously on key generation
  instead of failing gracefully.

## Security

See [SECURITY.md](./SECURITY.md) for how to report a vulnerability.

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md).

## License

Apache License 2.0 — see [LICENSE](./LICENSE).
