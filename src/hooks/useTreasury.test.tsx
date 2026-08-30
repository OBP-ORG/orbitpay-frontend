import { act, renderHook, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { useFreighter } from "@/contexts/FreighterContext"
import {
  approveWithdrawal,
  executeWithdrawal,
  getTokenBalance,
  getTreasuryConfig,
  getWithdrawal,
  proposeWithdrawal,
  type TreasuryConfigView,
  type WithdrawalView,
} from "@/lib/soroban/treasury"
import { useTreasury } from "./useTreasury"

vi.mock("@/contexts/FreighterContext", () => ({
  useFreighter: vi.fn(),
}))

vi.mock("@/lib/soroban/treasury", async () => {
  const actual = await vi.importActual<typeof import("@/lib/soroban/treasury")>("@/lib/soroban/treasury")
  return {
    ...actual,
    getTreasuryConfig: vi.fn(),
    getWithdrawal: vi.fn(),
    getTokenBalance: vi.fn(),
    proposeWithdrawal: vi.fn(),
    approveWithdrawal: vi.fn(),
    executeWithdrawal: vi.fn(),
    isTreasuryConfigured: vi.fn(() => true),
  }
})

const mockUseFreighter = vi.mocked(useFreighter)
const mockGetTreasuryConfig = vi.mocked(getTreasuryConfig)
const mockGetWithdrawal = vi.mocked(getWithdrawal)
const mockGetTokenBalance = vi.mocked(getTokenBalance)
const mockProposeWithdrawal = vi.mocked(proposeWithdrawal)
const mockApproveWithdrawal = vi.mocked(approveWithdrawal)
const mockExecuteWithdrawal = vi.mocked(executeWithdrawal)

const SIGNER_A = "GAAA1AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"
const SIGNER_B = "GBBB1BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB"
const RECIPIENT = "GDDD1DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD"
const TOKEN = "CAAA1AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"

function freighterAs(address: string | null) {
  mockUseFreighter.mockReturnValue({
    status: address ? "connected" : "locked",
    address,
    network: null,
    networkPassphrase: null,
    error: null,
    isConnected: !!address,
    isFreighterInstalled: true,
    connect: vi.fn(),
    disconnect: vi.fn(),
    signTransaction: vi.fn(),
  })
}

function config(overrides: Partial<TreasuryConfigView> = {}): TreasuryConfigView {
  return {
    admin: SIGNER_A,
    signers: [SIGNER_A, SIGNER_B],
    threshold: 1,
    paused: false,
    ...overrides,
  }
}

function withdrawal(overrides: Partial<WithdrawalView> = {}): WithdrawalView {
  return {
    id: 1,
    proposer: SIGNER_A,
    recipient: RECIPIENT,
    token: TOKEN,
    amount: BigInt(100),
    memo: "payout",
    approvals: [],
    threshold: 1,
    executed: false,
    timelockExpiresAt: 0,
    ...overrides,
  }
}

beforeEach(() => {
  window.localStorage.clear()
  mockGetTreasuryConfig.mockReset()
  mockGetWithdrawal.mockReset()
  mockGetTokenBalance.mockReset()
  mockProposeWithdrawal.mockReset()
  mockApproveWithdrawal.mockReset()
  mockExecuteWithdrawal.mockReset()
  mockUseFreighter.mockReset()
  mockGetTreasuryConfig.mockResolvedValue({ status: "success", hash: "", result: config() })
  mockGetTokenBalance.mockResolvedValue({ status: "success", hash: "", result: BigInt(1_000_000) })
})

afterEach(() => {
  vi.useRealTimers()
})

describe("useTreasury: one-signer path", () => {
  it("marks a withdrawal executable once the sole required signer approves it", async () => {
    freighterAs(SIGNER_A)
    mockGetTreasuryConfig.mockResolvedValue({ status: "success", hash: "", result: config({ threshold: 1 }) })
    mockGetWithdrawal.mockResolvedValue({ status: "success", hash: "", result: withdrawal({ threshold: 1, approvals: [] }) })
    mockProposeWithdrawal.mockResolvedValue({ status: "success", hash: "h1", result: 1 })

    const { result } = renderHook(() => useTreasury())

    await waitFor(() => expect(result.current.config?.threshold).toBe(1))

    await act(async () => {
      await result.current.propose({ token: TOKEN, recipient: RECIPIENT, amount: BigInt(100), memo: "payout" })
    })

    expect(mockProposeWithdrawal).toHaveBeenCalledWith(
      expect.objectContaining({ publicKey: SIGNER_A }),
      { token: TOKEN, recipient: RECIPIENT, amount: BigInt(100), memo: "payout" },
      expect.any(Function),
    )

    await waitFor(() => expect(result.current.withdrawals[1]).toBeDefined())
    expect(result.current.isWithdrawalMet(result.current.withdrawals[1])).toBe(false)

    mockGetWithdrawal.mockResolvedValue({
      status: "success",
      hash: "",
      result: withdrawal({ threshold: 1, approvals: [SIGNER_A] }),
    })
    mockApproveWithdrawal.mockResolvedValue({ status: "success", hash: "h2", result: undefined })

    await act(async () => {
      await result.current.approve(1)
    })

    expect(mockApproveWithdrawal).toHaveBeenCalledWith(
      expect.objectContaining({ publicKey: SIGNER_A }),
      1,
      expect.any(Function),
    )
    await waitFor(() => expect(result.current.isWithdrawalMet(result.current.withdrawals[1])).toBe(true))
  })
})

describe("useTreasury: threshold path", () => {
  it("only reports a withdrawal as met once approvals reach its own frozen threshold, ignoring a diverged live config", async () => {
    freighterAs(SIGNER_A)
    // Live config threshold has since moved to 1, but this withdrawal was
    // proposed under threshold 2 — it must still require 2 approvals.
    mockGetTreasuryConfig.mockResolvedValue({ status: "success", hash: "", result: config({ threshold: 1 }) })
    mockGetWithdrawal.mockResolvedValue({
      status: "success",
      hash: "",
      result: withdrawal({ threshold: 2, approvals: [SIGNER_A] }),
    })

    const { result } = renderHook(() => useTreasury())

    await waitFor(() => expect(result.current.config).not.toBeNull())

    act(() => result.current.trackId(1))

    await waitFor(() => expect(result.current.withdrawals[1]).toBeDefined())
    expect(result.current.isWithdrawalMet(result.current.withdrawals[1])).toBe(false)
    expect(result.current.isWithdrawalStale(result.current.withdrawals[1])).toBe(true)

    mockGetWithdrawal.mockResolvedValue({
      status: "success",
      hash: "",
      result: withdrawal({ threshold: 2, approvals: [SIGNER_A, SIGNER_B] }),
    })

    act(() => result.current.refresh())

    await waitFor(() => expect(result.current.isWithdrawalMet(result.current.withdrawals[1])).toBe(true))
  })
})

describe("useTreasury: failure paths", () => {
  it("surfaces a paused-treasury violation without ever calling the contract", async () => {
    freighterAs(SIGNER_A)
    mockGetTreasuryConfig.mockResolvedValue({ status: "success", hash: "", result: config({ paused: true }) })

    const { result } = renderHook(() => useTreasury())
    await waitFor(() => expect(result.current.config?.paused).toBe(true))

    await act(async () => {
      await result.current.propose({ token: TOKEN, recipient: RECIPIENT, amount: BigInt(100), memo: "payout" })
    })

    // The paused check short-circuits before a live balance read is ever
    // requested *for this proposal* (the hook may separately fetch a
    // balance on mount for the stats tile — that's unrelated).
    const balanceCallsForThisToken = mockGetTokenBalance.mock.calls.filter(([token]) => token === TOKEN)
    expect(balanceCallsForThisToken).toHaveLength(0)
    expect(mockProposeWithdrawal).not.toHaveBeenCalled()
    expect(result.current.actionState("propose").stage).toBe("error")
    expect(result.current.actionState("propose").message).toMatch(/paused/i)
  })

  it("surfaces an unauthorized-signer violation without ever calling the contract", async () => {
    const outsider = "GEEE1EEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEE"
    freighterAs(outsider)
    mockGetTreasuryConfig.mockResolvedValue({ status: "success", hash: "", result: config() })

    const { result } = renderHook(() => useTreasury())
    await waitFor(() => expect(result.current.config).not.toBeNull())
    expect(result.current.isSigner).toBe(false)

    await act(async () => {
      await result.current.propose({ token: TOKEN, recipient: RECIPIENT, amount: BigInt(100), memo: "payout" })
    })

    expect(mockProposeWithdrawal).not.toHaveBeenCalled()
    expect(result.current.actionState("propose").message).toMatch(/not authorized/i)
  })

  it("surfaces an insufficient-balance violation from a live per-token read, without ever calling the contract", async () => {
    freighterAs(SIGNER_A)
    mockGetTreasuryConfig.mockResolvedValue({ status: "success", hash: "", result: config({ threshold: 1 }) })
    mockGetTokenBalance.mockResolvedValue({ status: "success", hash: "", result: BigInt(50) })

    const { result } = renderHook(() => useTreasury())
    await waitFor(() => expect(result.current.config).not.toBeNull())

    await act(async () => {
      await result.current.propose({ token: TOKEN, recipient: RECIPIENT, amount: BigInt(100), memo: "payout" })
    })

    expect(mockGetTokenBalance).toHaveBeenCalledWith(TOKEN)
    expect(mockProposeWithdrawal).not.toHaveBeenCalled()
    expect(result.current.actionState("propose").message).toMatch(/insufficient|balance/i)
  })

  it("does not optimistically mark an approval recorded when the contract call fails", async () => {
    freighterAs(SIGNER_A)
    mockGetTreasuryConfig.mockResolvedValue({ status: "success", hash: "", result: config() })
    mockGetWithdrawal.mockResolvedValue({ status: "success", hash: "", result: withdrawal({ approvals: [] }) })

    const { result } = renderHook(() => useTreasury())
    await waitFor(() => expect(result.current.config).not.toBeNull())
    act(() => result.current.trackId(1))
    await waitFor(() => expect(result.current.withdrawals[1]).toBeDefined())

    mockApproveWithdrawal.mockResolvedValue({
      status: "error",
      stage: "submitting",
      message: "The treasury does not hold enough balance to cover this withdrawal.",
    })
    const callsBeforeApprove = mockGetWithdrawal.mock.calls.length

    await act(async () => {
      await result.current.approve(1)
    })

    expect(result.current.actionState("approve-1").stage).toBe("error")
    expect(result.current.actionState("approve-1").message).toMatch(/insufficient|balance/i)
    // A failed call must not trigger an optimistic re-fetch/update either.
    expect(mockGetWithdrawal.mock.calls.length).toBe(callsBeforeApprove)
    expect(result.current.withdrawals[1].approvals).toEqual([])
  })
})

describe("useTreasury: account-change path", () => {
  it("clears stale per-account action state and recomputes signer status when the connected wallet switches", async () => {
    freighterAs(SIGNER_A)
    mockGetTreasuryConfig.mockResolvedValue({ status: "success", hash: "", result: config({ threshold: 1 }) })
    mockProposeWithdrawal.mockResolvedValue({ status: "success", hash: "h1", result: 1 })
    mockGetWithdrawal.mockResolvedValue({ status: "success", hash: "", result: withdrawal({ threshold: 1 }) })

    const { result, rerender } = renderHook(() => useTreasury())
    await waitFor(() => expect(result.current.config).not.toBeNull())
    expect(result.current.isSigner).toBe(true)

    await act(async () => {
      await result.current.propose({ token: TOKEN, recipient: RECIPIENT, amount: BigInt(100), memo: "payout" })
    })
    expect(result.current.actionState("propose").stage).toBe("success")

    // Switch the connected account to one that isn't a treasury signer.
    const outsider = "GFFF1FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF"
    freighterAs(outsider)
    rerender()

    await waitFor(() => expect(result.current.currentSigner).toBe(outsider))
    expect(result.current.isSigner).toBe(false)
    // The previous account's success banner must not leak into the new account's session.
    expect(result.current.actionState("propose")).toEqual({ stage: null, message: null })
  })
})
