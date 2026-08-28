# Testing Strategy

The wallet transaction strategy is documented in [ADR 0002](docs/adr/0002-wallet-transaction-testing.md).
Run `npm run test:wallet-poc` to execute the safe, ephemeral Stellar testnet proof.

_Spike: [#11](https://github.com/OBP-ORG/orbitpay-frontend/issues/11) — decision note and PoC._

## Recommendation

**Vitest + React Testing Library** for unit and component tests. Defer Playwright/e2e for now.

### Unit / component runner: Vitest over Jest

Next.js 16 ships an official [Vitest guide](node_modules/next/dist/docs/01-app/02-guides/testing/vitest.md) and no
equivalent first-party Jest guide for this version. Vitest was chosen because it fits this
toolchain with the least friction:

- **Native ESM.** The app, `next.config.ts`, and `@stellar/stellar-sdk` are ESM-first. Jest's
  ESM support still requires extra flags and transform config; Vitest (built on Vite) handles it
  natively.
- **Path aliases for free.** `@/*` (from `tsconfig.json`) resolves out of the box via Vite's
  `resolve.tsconfigPaths` option — no separate `moduleNameMapper` to keep in sync, which Jest
  would require.
- **Fast TS/TSX transform.** Vite/esbuild transforms TypeScript directly; no `ts-jest` or Babel
  preset wiring needed.
- **Same mental model as Testing Library.** `@testing-library/react` + `@testing-library/user-event`
  work identically under Vitest and Jest, so this choice doesn't constrain component-testing style.

### e2e / wallet flows: deferred

Playwright is the natural choice if/when e2e lands (first-party Next.js support, real-browser
Freighter extension loading via a persistent context). It's deferred for this spike because:

- No transaction lifecycle exists yet to exercise end-to-end (per the issue, this is coming next).
- Freighter (`@stellar/freighter-api`) has no official test-mode/mock extension; e2e wallet
  coverage means either loading the real extension in a Playwright persistent context and funding
  a testnet account, or stubbing `window.freighterApi` in-page — both are real setup investments
  better scoped as their own follow-up once there's a flow worth covering end-to-end.
- Unit/component tests already cover the thing most likely to break silently right now: the
  formatting/validation math in `lib/amount.ts` and `lib/validation.ts`.

**When e2e is picked up:** favor stubbing `window.freighterApi` (`isConnected`, `getAddress`,
`signTransaction`, etc.) via `page.addInitScript` over loading the real extension — deterministic,
no funded testnet account required in CI, and sufficient for exercising app-side wallet flows.

### Mocking the Soroban RPC / Horizon layer

`lib/orbitpay.ts` instantiates `Horizon.Server` and `SorobanRpc.Server` as module-level singletons
and calls them directly (`horizon.loadAccount(...)`, `horizon.payments().forAccount(...)`, etc.),
rather than accepting them as injected dependencies. Two mocking strategies fit that shape,
depending on what's under test:

1. **Mock the module boundary with `vi.mock("@/lib/orbitpay")`** when testing a consumer (e.g.
   `useDashboard`, a page). Replace `fetchDashboardMetrics` / `fetchRecentActivity` with
   `vi.fn()` resolving fixture data. This is the default choice — it's fast, avoids network
   entirely, and doesn't care about Horizon/RPC wire shapes.
2. **Mock `@stellar/stellar-sdk` itself** (`vi.mock("@stellar/stellar-sdk", ...)`, stubbing
   `Horizon.Server`/`SorobanRpc.Server` constructors) only when testing `lib/orbitpay.ts` itself —
   e.g. asserting `fetchDashboardMetrics` falls back to mock data when `loadAccount` throws.

MSW (Mock Service Worker) is worth revisiting once real contract-invocation flows exist and the
tests need to assert against actual RPC/Horizon HTTP payloads (headers, status codes, pagination),
but for the current read-only dashboard calls, mocking at the module boundary is simpler and the
PoC follows that pattern.

## PoC delivered

- `vitest.config.ts` / `vitest.setup.ts` — jsdom environment, tsconfig path aliases resolved
  natively via Vite's `resolve.tsconfigPaths`, `@testing-library/jest-dom` matchers, and explicit
  `afterEach(cleanup)` (Testing Library's auto-cleanup needs Vitest's injected globals, which this
  config intentionally leaves off in favor of explicit `import { describe, it, expect } from "vitest"`).
- `npm test` (`vitest run`) / `npm run test:watch` (`vitest`) scripts.
- `src/lib/__tests__/amount.test.ts` — formatting/rounding/round-trip coverage for
  `formatBaseUnit`, `parseDisplayAmountToBaseUnit`, and the XLM convenience helpers.
- `src/lib/__tests__/validation.test.ts` — address format, base-unit bounds (including the i128
  ceiling), and decimal-to-base-unit parsing.
- `src/components/ui/__tests__/button.test.tsx` — one component test exercising the `Button`
  wrapper (`@base-ui/react`) for click behavior and the disabled state, using
  `@testing-library/user-event`.

Run locally with `npm test`.

## Minimum CI wiring (for the follow-up issue)

Add a GitHub Actions step running `npm test` on PRs touching `orbitpay-frontend`, alongside the
existing `npm run lint`. Gate merges on both. Scoped and tracked separately — see the follow-up
issue.

## Out of scope (per the spike)

Full coverage of `useDashboard`, the page components, and `lib/orbitpay.ts` itself, plus the CI
gate — tracked in the follow-up issue.
