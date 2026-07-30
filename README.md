This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Data fetching pattern (Horizon/Soroban RPC)

The dashboard (`src/app/page.tsx` + `src/hooks/useDashboard.ts`) is the
reference implementation for fetching live chain data. Follow this pattern
for treasury/payroll/vesting/governance instead of hand-rolling
`useState`/`useEffect` fetchers:

1. **Fetchers throw, they don't mask.** Functions in `src/lib/orbitpay.ts`
   (e.g. `fetchNativeBalance`, `fetchAccountPayments`) never catch-and-return
   a placeholder ("0 XLM", empty array) to paper over a network/RPC failure.
   A genuine empty/zero result and a failed fetch are different facts, and
   only the fetcher knows which one happened — so it either returns real
   data or throws an `Error` with a useful message (using `{ cause }` to
   preserve the original error).

2. **One `useQuery` per independently-failable widget**, not one big
   `Promise.all` for the whole page. See `useDashboard`: the treasury
   balance and the payments/activity scan are separate TanStack Query
   queries, each with its own `queryKey` (scoped by `address`), loading
   state, and error. This is what makes partial failure possible — one
   widget's RPC call failing doesn't blank out the ones that succeeded.
   If two pieces of UI can be derived from the *same* RPC response (like
   "employee count" and "recent activity" both coming from one
   `payments()` call here), fetch once and derive both — don't issue
   duplicate calls against a rate-limited RPC.

3. **Expose a `WidgetState<T>`-shaped result** (see `useDashboard.ts`):
   `data`, `isInitialLoading` (first fetch, no cache yet — show a skeleton),
   `isFetching` (any fetch in flight, including background refetch — good
   for a subtle spinner/refresh-button state), `error`/`isError`. Render
   from this shape directly instead of collapsing everything into a single
   page-level `loading`/`error` pair.

4. **Rely on the shared `QueryClient`** from `src/contexts/QueryProvider.tsx`
   (already mounted in `src/app/layout.tsx`, above `FreighterProvider`).
   Its defaults (30s `staleTime`, capped exponential-backoff `retry`,
   `refetchOnWindowFocus: false`) are tuned for a public, rate-limited
   testnet RPC — don't create a second `QueryClient` per page.

5. **Address changes are cache-key changes.** Key every query on the
   connected wallet address (`["orbitpay", "<resource>", address]`).
   TanStack Query treats a new address as a new query: it won't let a
   stale in-flight response for the previous address overwrite state for
   the new one, and it discards state updates for unmounted components.
   (Note: the Stellar SDK's `Horizon.Server` client doesn't accept an
   `AbortSignal`, so this is request-level race protection, not a literal
   aborted XHR — see `src/hooks/useDashboard.test.tsx` for the behavior
   this guarantees.)

6. **Wire real error UI, not a silent default.** Each metric card / list
   renders its own inline error state (`WidgetError` in `page.tsx`) instead
   of falling back to `0`/empty. Route-level `error.tsx`/`loading.tsx`
   scaffolds still apply for render-time exceptions and navigation
   transitions — this pattern is specifically for in-page, client-fetched
   data.

See `src/lib/__tests__/orbitpay.test.ts` and `src/hooks/useDashboard.test.tsx`
for the expected test coverage: error-surfacing (no masked defaults),
partial-failure rendering, and stale-response/race handling on address
change.

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
