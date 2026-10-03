# @parmana/sign

[![npm](https://img.shields.io/npm/v/@parmana/sign)](https://www.npmjs.com/package/@parmana/sign)
[![CI](https://github.com/pavancharak/parmana-sign/actions/workflows/ci.yml/badge.svg)](https://github.com/pavancharak/parmana-sign/actions/workflows/ci.yml)
[![License](https://img.shields.io/npm/l/@parmana/sign)](./LICENSE)
[![Node](https://img.shields.io/node/v/@parmana/sign)](#requirements)
[![OpenSSF Best Practices](https://www.bestpractices.dev/projects/13926/badge)](https://www.bestpractices.dev/projects/13926)
[![OpenSSF Scorecard](https://api.scorecard.dev/projects/github.com/pavancharak/parmana-sign/badge)](https://scorecard.dev/viewer/?uri=github.com/pavancharak/parmana-sign) ([full report](https://scorecard.dev/viewer/?uri=github.com/pavancharak/parmana-sign))

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

**It is fully usable on its own, independent of Parmana.** It has no
dependency on Parmana's runtime, policy engine, or any other Parmana
package. It is also **not an authorization or policy-evaluation
system**: it signs, verifies, and canonically hashes artifacts you give
it, and makes no decisions about whether an action should be allowed.
It was extracted from [Parmana](https://parmanasystems.com), an AI
execution-authorization platform, as the subset of that project's crypto
layer that is generic enough to stand on its own.

## Contents

- [What this is](#what-this-is)
- [Where authorization is enforced](#where-authorization-is-enforced)
- [Installation](#installation)
- [Quick start](#quick-start)
- [Verifying Parmana artifacts offline](#verifying-parmana-artifacts-offline)
- [Examples](#examples)
- [API](#api)
- [Requirements](#requirements)
- [Versioning and support](#versioning-and-support)
- [Getting help](#getting-help)
- [Security and supply chain](#security-and-supply-chain)
- [Contributing](#contributing)

## What this is

- `SignatureProvider`: a minimal interface for sign/verify over a
  `node:crypto` `KeyObject`.
- `Dilithium3SignatureProvider`: an implementation of that interface
  for ML-DSA-65 (Dilithium3), a post-quantum signature scheme.
- `Ed25519SignatureProvider`: an implementation for Ed25519, the
  classical default Parmana signs with.
- `verifyExecutionTrustRecordOffline` / `verifyExecutionIntentOffline`:
  check a signed Parmana artifact using only the artifact and a
  public key: no network, no database, no trust in Parmana's servers.
- `SignatureVerifier` / `ArtifactHasher`: small helpers that
  canonically serialize an arbitrary object (deterministic key
  ordering) before signing, verifying, or hashing it, so the same
  logical object always produces the same bytes regardless of how it
  was constructed.
- `CanonicalSerializer`: the deterministic serialization used by the
  above.

## What this is not

- Not a key-management system. You supply `KeyObject`s; this library
  never reads keys from disk, environment variables, or a network
  service.
- Not a policy engine, authorization system, or credential broker.
  Nothing here decides whether an action is permitted. It only signs
  and verifies data you already decided to sign.
- Not evidence that an unauthorized action was prevented. A valid
  signature shows who signed a record and that it was not altered. It
  says nothing about actions that never went through Parmana.

## Where authorization is enforced

If you are evaluating Parmana's security rather than this library, the
system to evaluate is the Parmana server in
[github.com/pavancharak/parmana](https://github.com/pavancharak/parmana),
not this package. Execution is refused there, before anything runs, at:

1. **The API boundary** (`packages/api/src/middleware/caller-auth.ts`):
   unauthenticated callers and capabilities the API key is not allowed.
2. **The decision** (`packages/runtime/src/RuntimeEngine.ts`): policy
   rules, and a signed human approval for this action, resource and
   amount. A refused request gets no authorization.
3. **The gateway** (`packages/execution-gateway/src/ExecutionGateway.ts`):
   the authorization's signature, expiry, content hash, policy version,
   signals and single use nonce, checked before the connector is called.
4. **Execution control** (`packages/execution-control/`): connectors
   accept only a valid gateway session, and only there are connector
   credentials released.

Parmana enforces nothing at the network level: anyone holding a
downstream system's own credentials can call it directly. The
[Audit guide](https://docs.parmanasystems.com/evaluation/audit-guide)
covers what an attacker controls in each case, including a compromised
approver key or authorization signing key, and a bounded scenario
pinned to a commit.

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
  ArtifactHasher,
  Dilithium3SignatureProvider,
  Sha256HashProvider,
  type CryptoProvider,
} from "@parmana/sign";

const crypto: CryptoProvider = {
  signature: new Dilithium3SignatureProvider(),
  hash: new Sha256HashProvider(), // or your own HashProvider
};

const hasher = new ArtifactHasher(crypto);
const digest = await hasher.hash({ amount: 100, currency: "USD" });
```

## Verifying Parmana artifacts offline

A 50-second demo of this in action (verify a record, change one field, watch
verification fail) is in [`docs/demo/`](./docs/demo/).

Given a signed Execution Trust Record or Execution Intent (for example
exported from Parmana as JSON) and the public keys it references, you
can check it yourself:

```ts
import { verifyExecutionTrustRecordOffline } from "@parmana/sign";

const result = await verifyExecutionTrustRecordOffline(record, {
  "ed-key-1": ed25519PublicKeyPem,  // keyId -> PEM (SPKI) or KeyObject
  "pq-key-1": mlDsa65PublicKeyPem,  // only needed for hybrid records
});

if (!result.valid) {
  console.error(result.errors);
}
```

A record is `valid` only when all of these hold:

- `trustRecordHash` matches a fresh SHA-256 of the record's canonical
  content (`hashValid`);
- the `signature` field verifies (`legacySignatureValid`);
- if the record carries a hybrid `signatures` array, it has at least
  two entries with distinct algorithms and every one verifies
  (`hybridSignaturesValid`; `undefined` when the record has none).

Supported algorithms are `ed25519` and `dilithium3` (ML-DSA-65). Any
other algorithm, a missing key, or a malformed record is reported in
`errors` and makes the result invalid; the verifier never throws on bad
input and never silently skips a check. Whether hybrid signatures are
*required* is your policy decision: check `hybridSignaturesValid`.

`verifyExecutionIntentOffline(intent, publicKeys)` works the same way
for Execution Intents. A valid intent proves who authorized the action
and that it was not altered; it does not prove the action ran. Neither
check shows that an action was authorized correctly, or that an
unauthorized one was blocked: see
[Where authorization is enforced](#where-authorization-is-enforced).

Compatibility with Parmana's signer is tested against artifacts signed
by Parmana's own code (`tests/fixtures/parmana-artifacts.json`,
regenerated with `scripts/generate-parmana-fixtures.sh`).

## Examples

Runnable examples are in [`examples/`](./examples). They import the
package by name, the same way your code would:

- [`sign-and-verify.mjs`](./examples/sign-and-verify.mjs): sign an object
  with Ed25519 and ML-DSA-65, then verify it and a modified copy.
- [`verify-parmana-record.mjs`](./examples/verify-parmana-record.mjs):
  verify a Parmana-signed Execution Trust Record offline, then change one
  field and verify again.

```bash
npm install
npm run build
npm run examples
```

## API

### `SignatureProvider` (interface)

Minimal sign/verify contract every signature implementation follows.
Key management is intentionally external: implementations take a
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
ML-DSA-65 is randomized: signing the same data twice with the same key
produces two different, both-valid signatures.

```ts
const provider = new Dilithium3SignatureProvider();
const signature: string = await provider.sign(data: Uint8Array, privateKey: KeyObject);
const valid: boolean = await provider.verify(data: Uint8Array, signature: string, publicKey: KeyObject);
```

Throws `CryptoError` if the supplied key's `asymmetricKeyType` isn't
`"ml-dsa-65"`. This catches accidentally signing with the wrong
algorithm's key material.

### `Ed25519SignatureProvider`

`SignatureProvider` implementation for Ed25519. Same interface and
`CryptoError` key-type check as `Dilithium3SignatureProvider`.

For messages over 4096 bytes, `verify()` also accepts Parmana's
large-message commitment form (a domain-separation prefix plus the
SHA-512 digest of the message, which is how Parmana's AWS KMS signer
signs large records). A commitment signature over a message at or under
4096 bytes is always rejected. `sign()` always signs the raw message.

### `Sha256HashProvider`

`HashProvider` returning the lowercase hex SHA-256 digest, the hash
format Parmana records use.

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
  ([nodejs/node#59259](https://github.com/nodejs/node/pull/59259));
  earlier 24.x releases do not have it even though they satisfy a
  plain `>=24` check. Use `isMlDsa65Supported()` to check at runtime
  before relying on the Dilithium3 provider regardless; older or
  non-conforming runtimes throw synchronously on key generation
  instead of failing gracefully. Ed25519 and the offline verifiers'
  Ed25519 checks work on older Node versions too.

## Versioning and support

- This package follows [Semantic Versioning](https://semver.org). While
  the version is below 1.0.0, a minor release (0.x.0) may include
  breaking changes; they are always listed in
  [CHANGELOG.md](./CHANGELOG.md). Patch releases (0.x.y) never break the
  public API.
- The public API is what `src/index.ts` exports. Anything else may change
  in any release.
- Supported Node.js versions: 24.6.0 and later. CI tests 24.6.0, the
  latest 24.x and the latest release line on Linux, and the latest 24.x
  on Windows and macOS.
- Security fixes are made on the latest release only.

## Getting help

- Bugs and feature requests: open an
  [issue](https://github.com/pavancharak/parmana-sign/issues).
- Security vulnerabilities: do not open a public issue. Follow
  [SECURITY.md](./SECURITY.md).

## Security and supply chain

See [SECURITY.md](./SECURITY.md) for how to report a vulnerability.

- **OpenSSF Best Practices**: passing badge (see above), [project #13926](https://www.bestpractices.dev/projects/13926).
- **OpenSSF Scorecard**: automated supply-chain security score, published weekly and on every push to `main` (see badge above).
- **SLSA provenance**: every tagged release (`v*.*.*`) is built via a GitHub Actions workflow that generates [SLSA](https://slsa.dev) Build Level 3 provenance for the published npm tarball, independently verifiable with [`slsa-verifier`](https://github.com/slsa-framework/slsa-verifier).
- **Sigstore signatures**: every release tarball is signed keylessly with [cosign](https://github.com/sigstore/cosign) using GitHub's OIDC identity, with the signature recorded in the public Rekor transparency log.

See [RELEASING.md](./RELEASING.md) for the exact commands to verify a release's provenance and signature yourself.

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md).

## License

Apache License 2.0. See [LICENSE](./LICENSE).
