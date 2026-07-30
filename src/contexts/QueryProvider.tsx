"use client"

import { useState, type ReactNode } from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

/**
 * Shared TanStack Query client for all live-RPC data fetching (dashboard,
 * and eventually treasury/payroll/vesting/governance — see
 * `src/lib/orbitpay.README.md` for the pattern write-up).
 *
 * Defaults are tuned for a rate-limited public testnet RPC:
 *  - `staleTime` keeps recently-fetched data fresh enough that switching
 *    tabs/routes doesn't immediately re-hit Horizon.
 *  - `retry` uses capped exponential backoff instead of hammering the RPC
 *    on transient failures.
 *  - `refetchOnWindowFocus` is off — a wallet dashboard refetching every
 *    time the window regains focus is noisy against a rate-limited RPC;
 *    widgets expose an explicit refresh action instead.
 */
function createQueryClient(): QueryClient {
    return new QueryClient({
        defaultOptions: {
            queries: {
                staleTime: 30_000,
                gcTime: 5 * 60_000,
                retry: 2,
                retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10_000),
                refetchOnWindowFocus: false,
            },
        },
    })
}

export function QueryProvider({ children }: { children: ReactNode }) {
    // useState (not module scope) so every request in an SSR context gets its
    // own client, while the client-side render keeps a single stable instance
    // across re-renders.
    const [queryClient] = useState(createQueryClient)

    return (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )
}
