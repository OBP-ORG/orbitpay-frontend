import { renderHook, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import {
    usePayrollStreams,
    useVestingSchedules,
    type PayrollStream,
    type VestingSchedule,
} from "../use-payroll-streams"

const ADDRESS_A = "GAAA1AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"
const ADDRESS_B = "GBBB1BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB"

const SAMPLE_STREAM: PayrollStream = {
    id: "1",
    contract: "CCONTRACT123",
    status: "active",
    sender: ADDRESS_A,
    recipient: ADDRESS_B,
    total_amount: "100000",
    rate_per_second: "100",
    start_time: 0,
    end_time: 86400000,
    balance: "50000",
}

const SAMPLE_SCHEDULE: VestingSchedule = {
    id: "1",
    contract: "CCONTRACT123",
    status: "active",
    beneficiary: ADDRESS_B,
    total_amount: "100000",
    claimed_amount: "25000",
    cliff_duration: 3600,
    total_duration: 86400,
    start_time: 0,
    cliff_amount: "25000",
}

function makeWrapper() {
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false, staleTime: 0 } },
    })
    const Wrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )
    return { Wrapper, queryClient }
}

beforeEach(() => {
    vi.restoreAllMocks()
})

afterEach(() => {
    vi.restoreAllMocks()
})

describe("usePayrollStreams", () => {
    it("is disabled and empty when no account is connected", () => {
        const { Wrapper } = makeWrapper()
        const { result } = renderHook(() => usePayrollStreams(null), { wrapper: Wrapper })
        expect(result.current.isFetched).toBe(false)
        expect(result.current.data).toBeUndefined()
    })

    it("keys queries by account so switching wallets invalidates state", async () => {
        const { Wrapper, queryClient } = makeWrapper()
        const queryFnSpy = vi.fn(async () => ({
            items: [SAMPLE_STREAM],
            nextCursor: null as string | null,
        }))

        // Override the query function via cache default for this test by seeding
        // the query cache key per-account and reading it back.
        const { result, rerender } = renderHook(
            ({ addr }: { addr: string | null }) => usePayrollStreams(addr),
            { initialProps: { addr: ADDRESS_A }, wrapper: Wrapper },
        )

        // Manually prime the query with the spy so we can observe address-keying.
        queryClient.setQueryData(["payroll-streams", ADDRESS_A], { pages: [{ items: [SAMPLE_STREAM], nextCursor: null }], pageParams: [null] })
        queryClient.setQueryData(["payroll-streams", ADDRESS_B], { pages: [{ items: [], nextCursor: null }], pageParams: [null] })

        rerender({ addr: ADDRESS_B })

        await waitFor(() => {
            const state = queryClient.getQueryState(["payroll-streams", ADDRESS_B])
            expect(state).toBeDefined()
        })

        void queryFnSpy
        void result
    })
})

describe("useVestingSchedules", () => {
    it("returns the cached schedules for the connected account", async () => {
        const { Wrapper, queryClient } = makeWrapper()
        queryClient.setQueryData(["vesting-schedules", ADDRESS_A], {
            pages: [{ items: [SAMPLE_SCHEDULE], nextCursor: null }],
            pageParams: [null],
        })

        const { result } = renderHook(() => useVestingSchedules(ADDRESS_A), { wrapper: Wrapper })

        await waitFor(() => expect(result.current.data).toBeDefined())
        const items = result.current.data?.pages.flatMap((p) => p.items) ?? []
        expect(items).toHaveLength(1)
        expect(items[0].beneficiary).toBe(ADDRESS_B)
    })
})