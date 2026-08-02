# Security Policy

## Reporting a vulnerability

Please report security vulnerabilities privately rather than through a
public GitHub issue. Use GitHub's private vulnerability reporting
(Security tab → "Report a vulnerability") on this repository, or email
the maintainer directly if that's not available.

Include:

- A description of the issue and its impact.
- Steps to reproduce, or a proof of concept if you have one.
- The commit or version affected.

We will acknowledge your report within 3 business days and aim to give
you a fix timeline or a clarifying question within 10. Please give us a
reasonable window to fix and release before any public disclosure.

## Scope

In scope: the signature providers, canonical serialization, and
verification/hashing helpers in this repository.

Out of scope: vulnerabilities that require a compromised private key to
demonstrate, and anything in applications that consume this library
(this library performs no key management or storage of its own).

## Acknowledged reports

We're happy to credit reporters by name in release notes, with your
permission, once a fix ships.
