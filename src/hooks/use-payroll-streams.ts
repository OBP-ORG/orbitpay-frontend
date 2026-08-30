"use client"

import { useInfiniteQuery } from "@tanstack/react-query"
import { getStreamsForAccount, isPayrollConfigured, type PayrollStreamView } from "@/lib/soroban/payroll"
import { getSchedulesForAccount, isVestingConfigured, type VestingScheduleView } from "@/lib/soroban/vesting"
import { PAYROLL_CONTRACT_ID, VESTING_CONTRACT_ID } from "@/lib/soroban/config"

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

function mapStream(v: PayrollStreamView, contractId: string): PayrollStream {
    return {
        id: String(v.id),
        contract: contractId,
        status: v.status as PayrollStream["status"],
        sender: v.sender,
        recipient: v.recipient,
        total_amount: v.total_amount.toString(),
        rate_per_second: v.rate_per_second.toString(),
        start_time: Number(v.start_time),
        end_time: Number(v.end_time),
        balance: v.balance.toString(),
    }
}

function mapSchedule(v: VestingScheduleView, contractId: string): VestingSchedule {
    return {
        id: String(v.id),
        contract: contractId,
        status: v.status as VestingSchedule["status"],
        beneficiary: v.beneficiary,
        total_amount: v.total_amount.toString(),
        claimed_amount: v.claimed_amount.toString(),
        cliff_duration: Number(v.cliff_duration),
        total_duration: Number(v.total_duration),
        start_time: Number(v.start_time),
        cliff_amount: v.cliff_amount.toString(),
    }
}

/**
 * Paginated payroll streams for an account (issue #26). Keyed on the account
 * so switching wallets is a brand new query — a stale response for the old
 * address can never land in the new one's state.
 */
export function usePayrollStreams(account: string | null) {
    return useInfiniteQuery({
        queryKey: ["payroll-streams", account ?? ""] as const,
        queryFn: async ({ pageParam }: { pageParam: string | null }) => {
            if (!isPayrollConfigured()) {
                return { items: [] as PayrollStream[], nextCursor: null as string | null }
            }
            const result = await getStreamsForAccount(account!, pageParam, PAGE_SIZE)
            if (result.status === "error") {
                throw new Error(result.message)
            }
                const page = result.result
                return {
                    items: page.items.map((v) => mapStream(v, PAYROLL_CONTRACT_ID)),
                    nextCursor: page.next_cursor,
                }
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
            if (!isVestingConfigured()) {
                return { items: [] as VestingSchedule[], nextCursor: null as string | null }
            }
            const result = await getSchedulesForAccount(account!, pageParam, PAGE_SIZE)
            if (result.status === "error") {
                throw new Error(result.message)
            }
                const page = result.result
                return {
                    items: page.items.map((v) => mapSchedule(v, VESTING_CONTRACT_ID)),
                    nextCursor: page.next_cursor,
                }
        },
        initialPageParam: null as string | null,
        getNextPageParam: (lastPage) => lastPage.nextCursor,
        enabled: !!account,
    })
}
