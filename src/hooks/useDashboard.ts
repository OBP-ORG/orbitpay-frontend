"use client"

import { useQuery, useQueryClient, type UseQueryResult } from "@tanstack/react-query"
import {
    fetchNativeBalance,
    fetchAccountPayments,
    type AccountPayments,
    type ActivityItem,
} from "@/lib/orbitpay"

/**
 * Query keys for dashboard data. Keyed on `address` so switching wallets
 * (or disconnecting) is a cache-key change — TanStack Query treats it as a
 * brand new query, discards/ignores any in-flight response for the old key,
 * and never lets a stale response overwrite state for the new address.
 */
export const dashboardKeys = {
    balance: (address: string | null) => ["orbitpay", "balance", address] as const,
    payments: (address: string | null) => ["orbitpay", "payments", address] as const,
}

/** Per-widget view of a query: everything a component needs, nothing it has to derive. */
export interface WidgetState<T> {
    data: T | undefined
    /** True only on the very first fetch for this key (no cached data yet). */
    isInitialLoading: boolean
    /** True while any fetch (initial or background refetch/retry) is in flight. */
    isFetching: boolean
    /** Set when the query has no usable data and the last attempt failed. */
    error: Error | null
    /** True once TanStack Query has exhausted its retries for this attempt. */
    isError: boolean
}

function toWidgetState<T>(result: UseQueryResult<T, Error>): WidgetState<T> {
    return {
        data: result.data,
        isInitialLoading: result.isPending && result.isFetching,
        isFetching: result.isFetching,
        error: result.error ?? null,
        isError: result.isError,
    }
}

export interface UseDashboardResult {
    /** Treasury (native XLM) balance widget. */
    balance: WidgetState<string>
    /** Recent payments scan: unique counterparties + activity feed. */
    payments: WidgetState<AccountPayments>
    /**
     * Metrics not yet backed by a live data source (payroll streams, vesting
     * schedules, governance proposals — see issues #9/#10/#11). Kept as an
     * explicit static block so it's obvious these are placeholders, not a
     * masked fetch failure.
     */
    staticMetrics: {
        activeStreams: number
        vestingSchedules: number
        activeProposals: number
    }
    /** True while every widget is on its first, uncached load. */
    isInitialLoading: boolean
    /** Re-run both widget queries from scratch (ignores cache). */
    refresh: () => void
}

export function useDashboard(address: string | null): UseDashboardResult {
    const queryClient = useQueryClient()

    const balanceQuery = useQuery({
        queryKey: dashboardKeys.balance(address),
        queryFn: () => {
            if (!address) throw new Error("No wallet connected")
            return fetchNativeBalance(address)
        },
        enabled: address !== null,
    })

    const paymentsQuery = useQuery({
        queryKey: dashboardKeys.payments(address),
        queryFn: () => {
            if (!address) throw new Error("No wallet connected")
            return fetchAccountPayments(address)
        },
        enabled: address !== null,
    })

    const balance = toWidgetState(balanceQuery)
    const payments = toWidgetState(paymentsQuery)

    return {
        balance,
        payments,
        staticMetrics: {
            activeStreams: 0,
            vestingSchedules: 0,
            activeProposals: 0,
        },
        isInitialLoading: balance.isInitialLoading || payments.isInitialLoading,
        refresh: () => {
            void queryClient.invalidateQueries({ queryKey: dashboardKeys.balance(address) })
            void queryClient.invalidateQueries({ queryKey: dashboardKeys.payments(address) })
        },
    }
}

export type { ActivityItem }
