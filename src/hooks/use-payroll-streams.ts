"use client"

import { useInfiniteQuery } from "@tanstack/react-query"

export interface PayrollStream {
    id: string
    contract: string
    status: "active" | "completed" | "cancelled" | "expired"
    sender: string
    recipient: string
    total_amount: string
    rate_per_second: string
    start_time: number
    end_time: number
    balance: string
}

export interface VestingSchedule {
    id: string
    contract: string
    status: "active" | "revoked" | "fully_claimed"
    beneficiary: string
    total_amount: string
    claimed_amount: string
    cliff_duration: number
    total_duration: number
    start_time: number
    cliff_amount: string
}

export interface Paginated<T> {
    items: T[]
    nextCursor: string | null
}

const PAGE_SIZE = 20

/**
 * Paginated payroll streams for an account (issue #26). Keyed on the account
 * so switching wallets is a brand new query — a stale response for the old
 * address can never land in the new one's state.
 */
export function usePayrollStreams(account: string | null) {
    return useInfiniteQuery({
        queryKey: ["payroll-streams", account ?? ""] as const,
        queryFn: async ({ pageParam }: { pageParam: string | null }) => {
            // TODO: wire the real contract read once the client is added.
            void pageParam
            void account
            return { items: [] as PayrollStream[], nextCursor: null as string | null }
        },
        initialPageParam: null as string | null,
        getNextPageParam: (lastPage) => lastPage.nextCursor,
        enabled: !!account,
    })
}

/** Paginated vesting schedules for an account (issue #26). */
export function useVestingSchedules(account: string | null) {
    return useInfiniteQuery({
        queryKey: ["vesting-schedules", account ?? ""] as const,
        queryFn: async ({ pageParam }: { pageParam: string | null }) => {
            void pageParam
            void account
            return { items: [] as VestingSchedule[], nextCursor: null as string | null }
        },
        initialPageParam: null as string | null,
        getNextPageParam: (lastPage) => lastPage.nextCursor,
        enabled: !!account,
    })
}