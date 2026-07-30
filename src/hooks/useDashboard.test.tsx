import { renderHook, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { fetchNativeBalance, fetchAccountPayments } from "@/lib/orbitpay"
import { useDashboard } from "./useDashboard"

vi.mock("@/lib/orbitpay", async () => {
    const actual = await vi.importActual<typeof import("@/lib/orbitpay")>("@/lib/orbitpay")
    return {
        ...actual,
        fetchNativeBalance: vi.fn(),
        fetchAccountPayments: vi.fn(),
    }
})

const mockFetchBalance = vi.mocked(fetchNativeBalance)
const mockFetchPayments = vi.mocked(fetchAccountPayments)

const ADDRESS_A = "GAAA1AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"
const ADDRESS_B = "GBBB1BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB"

function renderDashboard(address: string | null) {
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false, staleTime: 0 } },
    })
    return renderHook(({ addr }: { addr: string | null }) => useDashboard(addr), {
        initialProps: { addr: address },
        wrapper: ({ children }) => (
            <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
        ),
    })
}

beforeEach(() => {
    mockFetchBalance.mockReset()
    mockFetchPayments.mockReset()
})

afterEach(() => {
    vi.useRealTimers()
})

describe("useDashboard", () => {
    it("surfaces a fetch failure as an error, never a masked default value", async () => {
        mockFetchBalance.mockRejectedValue(new Error("Horizon unreachable"))
        mockFetchPayments.mockResolvedValue({ employees: 2, activity: [] })

        const { result } = renderDashboard(ADDRESS_A)

        await waitFor(() => expect(result.current.balance.isError).toBe(true))
        expect(result.current.balance.data).toBeUndefined()
        expect(result.current.balance.error?.message).toContain("Horizon unreachable")
    })

    it("renders partial data: one widget fails while the other succeeds", async () => {
        mockFetchBalance.mockResolvedValue("500 XLM")
        mockFetchPayments.mockRejectedValue(new Error("payments timeout"))

        const { result } = renderDashboard(ADDRESS_A)

        await waitFor(() => {
            expect(result.current.balance.data).toBe("500 XLM")
            expect(result.current.payments.isError).toBe(true)
        })

        // The failing widget doesn't blank out the successful one.
        expect(result.current.balance.error).toBeNull()
        expect(result.current.payments.data).toBeUndefined()
    })

    it("does not let a stale response for a previous address overwrite the current address's state", async () => {
        let resolveSlowBalanceForA!: (value: string) => void
        mockFetchBalance.mockImplementation((address: string) => {
            if (address === ADDRESS_A) {
                return new Promise((resolve) => {
                    resolveSlowBalanceForA = resolve
                })
            }
            return Promise.resolve("999 XLM")
        })
        mockFetchPayments.mockResolvedValue({ employees: 0, activity: [] })

        const { result, rerender } = renderDashboard(ADDRESS_A)

        // Switch address before the slow A request ever resolves.
        rerender({ addr: ADDRESS_B })

        await waitFor(() => expect(result.current.balance.data).toBe("999 XLM"))

        // Now let the stale A response land — it must not clobber B's data.
        resolveSlowBalanceForA("111 XLM (stale for A)")
        await new Promise((r) => setTimeout(r, 10))

        expect(result.current.balance.data).toBe("999 XLM")
    })

    it("treats a disconnected wallet (null address) as an empty/idle state, not an error", () => {
        const { result } = renderDashboard(null)

        expect(result.current.balance.isError).toBe(false)
        expect(result.current.balance.data).toBeUndefined()
        expect(result.current.balance.isInitialLoading).toBe(false)
        expect(mockFetchBalance).not.toHaveBeenCalled()
    })

    it("refresh() re-triggers both queries", async () => {
        mockFetchBalance.mockResolvedValue("10 XLM")
        mockFetchPayments.mockResolvedValue({ employees: 1, activity: [] })

        const { result } = renderDashboard(ADDRESS_A)

        await waitFor(() => expect(result.current.balance.data).toBe("10 XLM"))
        expect(mockFetchBalance).toHaveBeenCalledTimes(1)

        result.current.refresh()

        await waitFor(() => expect(mockFetchBalance).toHaveBeenCalledTimes(2))
        expect(mockFetchPayments.mock.calls.length).toBeGreaterThanOrEqual(2)
    })
})
