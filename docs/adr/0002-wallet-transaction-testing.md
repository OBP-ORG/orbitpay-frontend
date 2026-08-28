# ADR 0002: Test wallet transaction flows at defined boundaries

## Status

Accepted

## Context

OrbitPay submits Soroban transactions through the official
`@stellar/freighter-api` integration. A browser wallet owns private keys and
requires user approval, so a CI job must not embed a wallet seed phrase or
depend on a browser extension being installed.

We need confidence in the transaction path without turning testnet accounts or
wallet popups into an unreliable CI dependency.

## Decision

Use three explicit test layers.

| Layer | Runs in CI | Wallet boundary | Network boundary |
| --- | --- | --- | --- |
| Unit | Yes | Mock `@stellar/freighter-api` and assembled transactions | None |
| Integration smoke | Opt-in | No browser wallet; ephemeral SDK keypair | Stellar testnet |
| Browser E2E | Later | Stub the Freighter API with `page.addInitScript` | Mock RPC by default |

Unit tests own transaction lifecycle error handling, signing rejection,
simulation failures, submission failures, polling, and UI state changes. They
must mock the public Freighter API module rather than a private injected object;
this keeps the tests aligned with the supported wallet integration.

The integration smoke test is `npm run test:wallet-poc`. It creates an
ephemeral testnet keypair, asks Friendbot to fund it, and signs and submits a
self-payment. The generated seed never leaves the process, is never logged,
and has no value outside testnet. The command refuses to run against any
non-testnet Horizon endpoint. It is intentionally opt-in: public testnet
availability and Friendbot rate limits are useful diagnostics but should not
make the deterministic pull-request suite flaky.

Future browser coverage uses Playwright with `page.addInitScript` to define a
deterministic Freighter-compatible wallet before the application loads. It
will assert the browser-to-wallet handoff, but not Freighter internals. Loading
the real extension in CI is not selected because extension packaging, approval
UI, and wallet state make failures difficult to reproduce. A nightly,
quarantined real-extension test can be reconsidered after the stubbed suite is
established.

## Failure diagnostics

The smoke script labels failures by phase: Friendbot funding, account loading,
submission, or confirmation. It includes transaction hashes only after a
successful submission. It does not print a secret key. CI failures in the unit
and future E2E layers retain the mocked RPC/wallet response in test output.

## Consequences

- No production or long-lived test wallet secret is stored in source control or
  required by CI.
- CI remains deterministic while developers retain a reproducible real testnet
  proof command.
- Contract-specific integration tests still need deployed testnet contract IDs
  and should be introduced separately from this transport-level smoke test.

## Follow-up work

1. [Add unit coverage for `runInvocation`](https://github.com/OBP-ORG/orbitpay-frontend/issues/35)
   covering simulation, signing, submission, polling, and decoded failures.
2. [Add Playwright with an `addInitScript` Freighter stub](https://github.com/OBP-ORG/orbitpay-frontend/issues/37)
   for treasury and governance UI flows; keep RPC fixtures deterministic.
3. [Add an opt-in `test:wallet-poc` workflow](https://github.com/OBP-ORG/orbitpay-frontend/issues/34)
   with testnet outage classification and no secret configuration.
4. [Add contract-specific testnet scenarios](https://github.com/OBP-ORG/orbitpay-frontend/issues/36)
   after a disposable deployment and fixture reset process exist.

## Alternatives considered

- **Real Freighter extension in every CI run:** highest fidelity, but brittle
  extension setup and interactive approval make diagnosis poor.
- **A committed or CI-secret wallet seed:** rejected because test automation
  does not need a persistent identity and secret rotation becomes operational
  overhead.
- **Wallet Standard abstraction:** useful if OrbitPay supports multiple wallets,
  but it does not remove the need to test the current Freighter boundary and is
  not justified for this focused work.
