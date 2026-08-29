# Spike 0031: Dashboard information architecture and role-based user journeys

## Status

Proposed — spike output. No UI changes are included; see [Out of scope](#out-of-scope).

## Question

What are the minimal, coherent journeys for signer, employee, grantor,
beneficiary, and governance member across the OrbitPay dashboard?

## Method

Read against the current implementation only (`src/app/*`, `src/hooks/*`,
`src/lib/soroban/*`, `src/lib/domain.ts`), not a redesign brief. Each finding
below is traced to a file/line so it stays falsifiable as the code moves.
Time-boxed to the three days called out in the issue.

## Out of scope

Implementing the redesigned UI. This document is the route map, wireframes,
permission/error matrix, mobile/accessibility notes, and backlog described in
the issue's deliverables — no application code changes.

## Roles

OrbitPay has one wallet-connection concept (`useFreighter`,
[`src/contexts/FreighterContext.tsx`](../../src/contexts/FreighterContext.tsx))
and zero role concepts today. Every connected address sees every route and
every action button, regardless of whether the contract will actually accept
the call from that address. The five roles below are *inferred from contract
data shape*, not from anything the frontend currently computes.

| Role | Defined by | Authoritative source today | Can the frontend derive "is this connected address this role" today? |
| --- | --- | --- | --- |
| **Signer** | Member of the treasury's multisig signer set | `TreasuryConfigView.signers` ([`src/lib/soroban/treasury.ts:21-26`](../../src/lib/soroban/treasury.ts)) | **Yes** — `config.signers.includes(address)`. Not currently used to gate any button (see [Finding F1](#f1-treasury-approveexecute-is-not-gated-by-signer-membership)). |
| **Employee** | Recipient of an active `PayrollStream` | `PayrollStream.recipient` ([`src/lib/domain.ts:107-118`](../../src/lib/domain.ts)) | **No** — no payroll contract client exists yet ([Finding F2](#f2-payroll-and-vesting-have-no-contract-client-or-configured-id)); `/payroll` renders a hardcoded array. |
| **Grantor** | Creator/admin of a `VestingSchedule` | `VestingSchedule.grantor` ([`src/lib/domain.ts:120-132`](../../src/lib/domain.ts)) | **No** — same gap as Employee, on the vesting contract. |
| **Beneficiary** | Recipient of a `VestingSchedule` | `VestingSchedule.beneficiary` | **No** — same gap. |
| **Governance member** | Address with non-zero voting weight | Not modeled — `GovernanceConfigView` exposes only `totalWeight`, `quorum`, `proposalCount` ([`src/lib/soroban/governance.ts:16-20`](../../src/lib/soroban/governance.ts)); there is no `get_voting_weight(address)` or member-list method | **No, and not derivable even in principle from the current contract surface** ([Finding F3](#f3-governance-has-no-per-address-membership-or-weight-query)). |

An address can hold more than one role at once (e.g. a treasury signer who is
also a governance member), so role UI must be additive, not a single "mode
switch."

## Route map

| Route | Purpose | Primary role(s) | Secondary/view-only roles | Authoritative data source | Live today? |
| --- | --- | --- | --- | --- | --- |
| `/` Dashboard | Cross-role summary | All connected roles | — | Horizon `loadAccount` (balance) + `payments()` (activity) via `src/lib/orbitpay.ts`; stream/vesting/proposal counts are **static** `staticMetrics` | Partial — balance/activity live, other counts hardcoded ([`src/hooks/useDashboard.ts`](../../src/hooks/useDashboard.ts), tracked in issue #22) |
| `/treasury` | Propose/approve/execute multisig withdrawals | Signer | Everyone (read: balance, pending queue) | Treasury contract via `useTreasury` | Live (`get_config`, `get_withdrawal`, `propose_withdrawal`, `approve_withdrawal`, `execute_withdrawal`) |
| `/payroll` | Create and claim salary streams | Employee (claim), treasury/admin (create) | — | **None wired** — `const streams = [...]` mock array, [`src/app/payroll/page.tsx:14-18`](../../src/app/payroll/page.tsx) | No (tracked in issue #26) |
| `/vesting` | Create and claim vesting schedules | Grantor (create/revoke), Beneficiary (claim) | — | **None wired** — `const schedules = [...]` mock array, [`src/app/vesting/page.tsx:14-18`](../../src/app/vesting/page.tsx) | No (tracked in issue #26) |
| `/governance` | Propose, vote, execute proposals | Governance member | Everyone (read: proposals, quorum) | Governance contract via `useGovernance` | Live (`get_config`, `get_proposal`, `create_proposal`, `vote`, `execute_proposal`), but membership is unenforced client-side (F3) |

No route is currently role-gated at the routing layer (no middleware, no
per-route guard component) — `src/components/navbar.tsx:11-17` lists all five
links unconditionally for every visitor, connected or not.

## Wireframes

Text wireframes only, matching the existing Tailwind/shadcn card-and-table
layout already used on every page (`Card`/`Table`/`Tabs` from
`src/components/ui/*`) — these are journey sketches, not a visual redesign.

### 0. Disconnected / first-time visitor (applies to every route)

```
┌─ Navbar ───────────────────────────────────────────────────┐
│ OrbitPay   Dashboard Treasury Payroll Vesting Governance    │
│                                        [ Connect Wallet ]   │
└───────────────────────────────────────────────────────────┘
┌─ Page body ───────────────────────────────────────────────┐
│  <route-specific read-only content, if the contract for    │
│   this route is configured — see Permission matrix>        │
│                                                              │
│  Actions (Approve, Vote, Claim, Create…) render but are     │
│  disabled with "Connect a wallet to continue."               │
└───────────────────────────────────────────────────────────┘
```
Today: matches this already for the `checking`/`not-installed`/`locked`
states in `navbar.tsx:27-71`; page bodies already disable action buttons on
`!isConnected` (e.g. `src/app/treasury/page.tsx:200`, `:213`). Gap: the
*reason* shown is always "not connected," never "connected but wrong role."

### 1. Signer journey — `/treasury`

```
Stat row:  [ Balance ]  [ Threshold: k of n ]  [ Signers: n ]  [ Pending ]

Pending Transactions
┌────────────────────────────────────────────────────────────┐
│ TX-14   [Ready]                    2 / 2 approvals          │
│ To: GABC…WXYZ · 500 XLM · "vendor payment"                  │
│                                     [ Execute ]              │
├────────────────────────────────────────────────────────────┤
│ TX-15   [Pending] [Timelocked]     1 / 2 approvals          │
│ To: GDEF…UVWX · 1,200 XLM · "Q3 grant"                       │
│                                     [ Approve ]              │
└────────────────────────────────────────────────────────────┘
```
Proposed addition (F1): when the connected address is **not** in
`config.signers`, replace the action button with a disabled state labeled
"Only treasury signers can approve" instead of letting the click reach the
contract and fail with `describeInvocationError`'s "Your connected wallet is
not authorized…" message (`src/lib/soroban/errors.ts:42`). The contract-side
message already exists and is friendly — this is purely about *when* the
user sees it (pre-flight vs. post-failure).

### 2. Employee journey — `/payroll` (target state, pending #26)

```
Stat row: [ Active Streams ] [ Total Streamed ] [ Employees ] [ Completed ]

My Streams (filtered to streams where recipient == connected address)
┌────────────────────────────────────────────────────────────┐
│ STR-002  [Active]                                            │
│ 25,000 XLM total · 8,500 claimed                             │
│ ▓▓▓▓▓▓░░░░░░░░  34%                    [ Claim 340 XLM ]     │
└────────────────────────────────────────────────────────────┘

All Streams (existing "All Streams" tab — unchanged, view-only for non-senders)
```
The "My Streams" split is new relative to today's single flat table
(`src/app/payroll/page.tsx:65-95`) and depends on knowing the connected
address, which the page doesn't currently read (`useFreighter` isn't even
imported in `payroll/page.tsx`).

### 3. Grantor and beneficiary journeys — `/vesting` (target state, pending #26)

```
Grantor view (address created ≥1 schedule as `grantor`):
  "My Schedules"  →  each row gets [ Revoke ] if `revocable === true` and
                      status === "Active"

Beneficiary view (address is `beneficiary` on ≥1 schedule):
  "My Vesting"    →  each row gets [ Claim <cliff-gated amount> ]
                      or a disabled "Cliff ends <date>" state pre-cliff
```
Same split pattern as payroll: one page, two possible action sets depending
on which field of the schedule matches the connected address — never both
buttons for the same schedule.

### 4. Governance member journey — `/governance`

```
Stat row: [ Total Proposals ] [ Active ] [ Quorum ] [ Total Weight ]

┌────────────────────────────────────────────────────────────┐
│ #7  Funding · [Active]                 62 / 100 quorum      │
│ "Fund Q3 marketing" — 5,000 XLM to GABC…                    │
│ ▓▓▓▓▓▓▓▓▓▓▓▓░░░░  62%                                        │
│                          [ 👍 For ]  [ 👎 Against ]           │
└────────────────────────────────────────────────────────────┘
```
Gap (F3): every connected wallet sees the same `[For]/[Against]` buttons
regardless of voting weight, because the contract exposes no per-address
weight lookup yet. This is a contract-surface gap, not just a frontend gap —
see the backlog.

## Permission / error matrix

Legend: **✅** allowed and wired · **⚠️** allowed by the UI but not
pre-flight-checked (contract will reject if the caller is wrong) · **⛔**
not available (no data source) · states are the three the issue calls out:
empty, error/unauthorized, disconnected.

| Route | Action | Who (contract-enforced) | UI gating today | Empty state | Error state | Disconnected state |
| --- | --- | --- | --- | --- | --- | --- |
| `/treasury` | View config/queue | Anyone | ✅ | "No tracked pending withdrawals." (`page.tsx:176`) | `configError` renders inline (needs confirmation it's visible — see backlog item 5) | Read calls run without a signer (`client(null)`), so config still loads |
| `/treasury` | Propose withdrawal | Anyone (contract doesn't restrict proposal creation) | ✅ | — | `TxStatusBanner` shows `describeInvocationError` output | Disabled via `!isConnected` (`treasury/page.tsx:118`) |
| `/treasury` | Approve | Signer only | ⚠️ — disabled only on `!isConnected \|\| paused`, not on signer membership (F1) | — | Falls through to "Your connected wallet is not authorized…" post-click | Disabled |
| `/treasury` | Execute | Anyone, once threshold met + timelock elapsed | ✅ gated on `met`, `paused`, `timelockOpen` (`page.tsx:210-217`) | — | Contract error surfaced via banner | Disabled |
| `/payroll` | View streams | Anyone | ⛔ mock data only | N/A yet | N/A yet | N/A yet |
| `/payroll` | Claim | Stream recipient only | ⛔ no live contract, "Claim" button is a no-op today | — | — | — |
| `/vesting` | View schedules | Anyone | ⛔ mock data only | N/A yet | N/A yet | N/A yet |
| `/vesting` | Claim / Revoke | Beneficiary / Grantor only | ⛔ no live contract | — | — | — |
| `/governance` | View proposals | Anyone | ✅ | "not configured" dashed-card state (`page.tsx:34-46`) when `NEXT_PUBLIC_GOVERNANCE_CONTRACT_ID` is unset | — | Read calls run without a signer |
| `/governance` | Propose | Anyone (no membership check possible, F3) | ⚠️ form-validated, not role-validated | — | Contract error via banner | Disabled |
| `/governance` | Vote | Weighted members only (contract-side, unverifiable client-side per F3) | ⚠️ | — | Contract error via banner | Disabled |
| `/governance` | Execute | Anyone, once quorum met (assumed) | ⚠️ | — | Contract error via banner | Disabled |

The "not configured" empty state already exists and is a good pattern
(`isTreasuryConfigured()` / `isGovernanceConfigured()` guard the page body
before any query runs, `governance/page.tsx:34`) — it should be the template
for payroll/vesting once those contracts are wired, and is the direct
precedent for backlog item 3 below (issue #23).

## Mobile and accessibility considerations

- **Nav already collapses correctly.** `Sheet`-based mobile menu
  (`navbar.tsx:105-123`) duplicates the wallet button and surfaces
  `error` inline — keep this pattern for any role badge added later (see
  backlog item 4), rather than hiding role info on mobile.
- **Tables scroll horizontally already, but a five-plus-column table is still
  a poor mobile reading experience.** The shared `Table` primitive wraps in
  `overflow-x-auto` (`src/components/ui/table.tsx:11`), so `/payroll`'s "All
  Streams" and `/governance`'s history tables won't clip — but scrolling a
  data table sideways on a phone to find one row is still worse than the
  stacked-`Card` pattern `/treasury` already uses for its pending-withdrawal
  queue. Recommendation: reuse that card pattern for any new per-role list
  ("My Streams," "My Vesting") instead of extending the table.
- **Status is currently color-only in places.** `Badge` variants
  (`default`/`secondary`/`outline`/`destructive`) carry status meaning
  (Active/Ready/Timelocked/Pending) with text labels already present, which
  is good — keep requiring a text label on every status `Badge`, never an
  icon- or color-only chip, as new role-scoped badges are added.
- **Truncated addresses need a full-value accessible name.**
  `formatAddress` (`navbar.tsx:19-21`) and inline `w.recipient.slice(...)`
  patterns render `GABC…WXYZ` as visible text with no `title`/`aria-label`
  carrying the full address (Horizon activity rows use `.slice(0, 5)` too,
  `src/lib/orbitpay.ts:123`). Any new "my role" list (My Streams, My
  Vesting) that filters by exact address match should keep the full address
  available to assistive tech and copy-to-clipboard, not just the
  truncated display string.
- **Transaction lifecycle state has no `aria-live`.** `TxStatusBanner`
  (`src/components/tx-status-banner.tsx`) cycles through `simulating →
  awaiting-signature → submitting → polling → success/error` with a plain
  `<div>` at each stage — no `aria-live`/`role="status"` anywhere in the
  component, so a screen reader user gets no announcement as their approve/
  vote/claim action progresses or fails. Every role-gated action in this
  spike (approve, execute, vote, and eventually claim/revoke) renders
  through this one shared component, so fixing it here covers all of them
  at once.
- **Disabled-button reasons are invisible to screen readers today.**
  Buttons go from enabled to `disabled` based on `isConnected`/`paused`/role
  with no `aria-describedby` explaining *why* (e.g. `treasury/page.tsx:200`
  toggles `disabled` with no adjacent reason text bound to the button). Once
  role gating (F1) ships, the "Only treasury signers can approve" reason
  needs to be programmatically associated with the disabled button, not just
  visually adjacent.

## Findings

#### F1. Treasury approve/execute is not gated by signer membership
`TreasuryConfigView.signers` is fetched and rendered (`k of n` stat card,
`treasury/page.tsx:71`) but never compared against the connected `address`
to gate the Approve button — only `!isConnected` and `paused` are checked
(`treasury/page.tsx:200`). Any connected wallet can attempt Approve and will
only learn it lacks permission after a round-trip to the contract.

#### F2. Payroll and vesting have no contract client or configured ID
Unlike `src/lib/soroban/treasury.ts` and `governance.ts`, there is no
`payroll.ts` or `vesting.ts`, and `src/lib/soroban/config.ts` defines no
`PAYROLL_CONTRACT_ID` / `VESTING_CONTRACT_ID` or `isPayrollConfigured()` /
`isVestingConfigured()`. Both pages render fixed mock arrays
(`payroll/page.tsx:14-18`, `vesting/page.tsx:14-18`) — there is currently no
way for the Employee, Grantor, or Beneficiary journeys to reflect real
on-chain state. Already tracked as issue #26.

#### F3. Governance has no per-address membership or weight query
`GovernanceConfigView` (`governance.ts:16-20`) exposes only aggregate
`totalWeight`/`quorum`/`proposalCount`. There is no method resembling
`get_voting_weight(address)` or a member list. Even with perfect frontend
code, "is this connected address a governance member, and with what weight"
cannot be answered today — this needs a contract-side method before any
client-side role gating on `/governance` is possible.

## Prioritized implementation backlog

Tied to live contract capability, ordered so each item is buildable given
what precedes it. Existing issue numbers are cross-referenced rather than
duplicated.

1. **Contract-configuration status panel** — surface which of the four
   contracts (treasury, governance, payroll, vesting) are actually
   configured/live vs. mock, reusing the `isTreasuryConfigured()` pattern.
   Already filed as issue #23; this spike's route map (above) is the
   content for that panel.
2. **Gate treasury Approve on signer membership (F1)** — client-side only,
   no contract change: `config.signers.includes(address)`. Smallest, most
   direct fix for the issue's third acceptance criterion ("avoid exposing
   actions unsupported by the contracts").
3. **Wire payroll and vesting contract clients** — build
   `src/lib/soroban/payroll.ts` / `vesting.ts` mirroring
   `treasury.ts`/`governance.ts`, plus config IDs and `useTreasury`-shaped
   hooks. Already filed as issue #26; this is the hard blocker for the
   Employee, Grantor, and Beneficiary journeys existing at all.
4. **Split payroll/vesting views by role once live** — "My Streams" /
   "My Vesting" filtered on `recipient`/`beneficiary`/`grantor` ==
   connected address, per the wireframes above. Depends on (3).
5. **Standardize loading/empty/error/disconnected states** across all four
   routes, including the payroll/vesting states this spike could only mark
   ⛔/pending. Already filed as issue #24.
6. **Move remaining mock arrays into labeled fixtures** so it's visually
   obvious in the running app which lists are live vs. placeholder until
   (3) lands. Already filed as issue #22.
7. **Add a contract-side per-address voting-weight/membership query (F3)**
   — needed before `/governance` can gate Vote/Propose the way item 2 gates
   Treasury Approve. This is a contract-team dependency, not purely
   frontend; flagging it here so it isn't rediscovered later as a frontend
   bug.
8. **Responsive card layout for payroll/vesting/governance history lists**
   — reuse the treasury pending-withdrawal card pattern instead of raw
   `Table`s, once (3)/(4) give these routes real per-role rows to lay out.
9. **Bind disabled-action reasons via `aria-describedby`** and add an
   `aria-live` region to `TxStatusBanner` — accessibility follow-up once
   role-gated buttons (item 2, and eventually governance) exist to explain.

## Open questions

- Does the payroll contract (once specified) expose a "who is HR/admin"
  concept distinct from "who is the stream sender," or is sender == admin?
  Affects whether Payroll needs a Grantor-shaped role of its own.
- Is treasury `execute_withdrawal` intentionally callable by *any* address
  once threshold+timelock are met (current UI assumption,
  `treasury/page.tsx:213`), or should it also be signer-only? This spike
  took the current UI's gating as the source of truth but didn't find it
  confirmed against a deployed contract (none is deployed yet, per
  `treasury.ts`'s module doc).
- Governance weight (F3) — is weight expected to be static (e.g. one
  address = one vote, or a fixed allowlist) or token-balance-derived? This
  determines whether the missing query is a simple storage read or needs
  an oracle/snapshot design.
