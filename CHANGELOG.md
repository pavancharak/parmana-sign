# Changelog

## v0.2.0 (unreleased)

Offline verification of real Parmana artifacts.

- `Ed25519SignatureProvider`, including verification of Parmana's
  large-message (>4096 bytes) KMS commitment signatures
- `Sha256HashProvider` is now exported (previously a test helper)
- `verifyExecutionTrustRecordOffline` and `verifyExecutionIntentOffline`:
  verify a signed Parmana Execution Trust Record or Execution Intent
  with only the artifact and public keys, including hybrid
  Ed25519 + ML-DSA-65 `signatures` arrays
- Canonical views (`canonicalExecutionTrustRecord`,
  `hybridCanonicalExecutionTrustRecord`, `canonicalExecutionIntent`)
  defining exactly which fields Parmana signs
- Compatibility tests against artifacts signed by Parmana's own code

## v0.1.0 (2026-08-02)

Initial release. Extracted from Parmana as a standalone open-core package.

- Signature provider interface with an ML-DSA-65 (Dilithium3) implementation
- Canonical artifact serialization
- Artifact hashing and signature verification
