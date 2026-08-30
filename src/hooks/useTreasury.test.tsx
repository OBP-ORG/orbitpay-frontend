import { renderHook, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { getTreasuryConfig, getWithdrawal, isTreasuryConfigured } from "@/lib/soroban/treasury"
import { useTreasury } from "./useTreasury"

const wallet = vi.hoisted(() => ({ address: null as string | null }))

vi.mock("@/contexts/FreighterContext", () => ({
  useFreighter: () => ({ address: wallet.address, signTransaction: vi.fn() }),
}))

vi.mock("@/lib/soroban/treasury", () => ({
  getTreasuryConfig: vi.fn(),
  getWithdrawal: vi.fn(),
  isTreasuryConfigured: vi.fn(),
  proposeWithdrawal: vi.fn(),
  approveWithdrawal: vi.fn(),
  executeWithdrawal: vi.fn(),
}))

const mockGetConfig = vi.mocked(getTreasuryConfig)
const mockGetWithdrawal = vi.mocked(getWithdrawal)
const mockConfigured = vi.mocked(isTreasuryConfigured)
const ADDRESS_A = "GAAA1AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"
const ADDRESS_B = "GBBB1BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB"

function renderTreasury() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 0 } } })
  return renderHook(() => useTreasury(), {
    wrapper: ({ children }) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>,
  })
}

beforeEach(() => {
  wallet.address = ADDRESS_A
  mockConfigured.mockReturnValue(true)
  mockGetConfig.mockReset()
  mockGetWithdrawal.mockReset()
})

describe("useTreasury", () => {
  it("surfaces a contract read failure instead of substituting treasury values", async () => {
    mockGetConfig.mockRejectedValue(new Error("contract is not initialized"))

    const { result } = renderTreasury()

    await waitFor(() => expect(result.current.configError).toContain("not initialized"))
    expect(result.current.config).toBeNull()
  })

  it("does not let a slow previous wallet read overwrite the current wallet", async () => {
    let resolveA!: (value: Awaited<ReturnType<typeof getTreasuryConfig>>) => void
    mockGetConfig.mockImplementation(() => {
      if (wallet.address === ADDRESS_A) return new Promise((resolve) => { resolveA = resolve })
      return Promise.resolve({ admin: ADDRESS_B, signers: [ADDRESS_B], threshold: 1, balance: 20000000n, paused: false })
    })

    const { result, rerender } = renderTreasury()
    wallet.address = ADDRESS_B
    rerender()

    await waitFor(() => expect(result.current.config?.admin).toBe(ADDRESS_B))
    resolveA({ admin: ADDRESS_A, signers: [ADDRESS_A], threshold: 1, balance: 10000000n, paused: false })
    await new Promise((resolve) => setTimeout(resolve, 10))

    expect(result.current.config?.admin).toBe(ADDRESS_B)
  })

  it("keeps a disconnected wallet idle and does not make a contract read", () => {
    wallet.address = null

    const { result } = renderTreasury()

    expect(result.current.config).toBeNull()
    expect(result.current.configLoading).toBe(false)
    expect(mockGetConfig).not.toHaveBeenCalled()
  })
})
