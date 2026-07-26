import { act, renderHook, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { EXPECTED_NETWORK_PASSPHRASE } from "@/lib/domain"
import { createFreighterStore, FreighterProvider, useFreighter } from "./FreighterContext"
import {
  getNetworkDetails,
  getPublicKey,
  isAllowed,
  isConnected,
  requestAccess,
} from "@stellar/freighter-api"

vi.mock("@stellar/freighter-api", () => ({
  getNetworkDetails: vi.fn(),
  getPublicKey: vi.fn(),
  isAllowed: vi.fn(),
  isConnected: vi.fn(),
  requestAccess: vi.fn(),
}))

const mockGetNetworkDetails = vi.mocked(getNetworkDetails)
const mockGetPublicKey = vi.mocked(getPublicKey)
const mockIsAllowed = vi.mocked(isAllowed)
const mockIsConnected = vi.mocked(isConnected)
const mockRequestAccess = vi.mocked(requestAccess)

const MATCHING_NETWORK = { network: "TESTNET", networkPassphrase: EXPECTED_NETWORK_PASSPHRASE }
const MISMATCHED_NETWORK = { network: "PUBLIC", networkPassphrase: "Public Global Stellar Network ; September 2015" }
const ADDRESS = "GABCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQRSTUVW"

/** Each test gets its own store so subscriptions/timers never leak across tests. */
function renderWallet() {
  const store = createFreighterStore()
  return renderHook(() => useFreighter(), {
    wrapper: ({ children }) => <FreighterProvider store={store}>{children}</FreighterProvider>,
  })
}

beforeEach(() => {
  delete (window as { freighter?: boolean }).freighter
  mockGetNetworkDetails.mockReset()
  mockGetPublicKey.mockReset()
  mockIsAllowed.mockReset()
  mockIsConnected.mockReset()
  mockRequestAccess.mockReset()
})

afterEach(() => {
  vi.useRealTimers()
})

describe("FreighterProvider state machine", () => {
  it("resolves to not-installed when the extension never injects", async () => {
    vi.useFakeTimers()
    mockIsConnected.mockResolvedValue(false)

    const { result } = renderWallet()
    expect(result.current.status).toBe("checking")

    await act(async () => {
      await vi.advanceTimersByTimeAsync(300 * 6)
    })

    expect(result.current.status).toBe("not-installed")
    expect(result.current.isFreighterInstalled).toBe(false)
  })

  it("resolves to locked when installed but not yet authorized", async () => {
    window.freighter = true
    mockIsAllowed.mockResolvedValue(false)

    const { result } = renderWallet()

    await waitFor(() => expect(result.current.status).toBe("locked"))
    expect(result.current.isFreighterInstalled).toBe(true)
    expect(result.current.isConnected).toBe(false)
  })

  it("resolves to connected when authorized and on the expected network", async () => {
    window.freighter = true
    mockIsAllowed.mockResolvedValue(true)
    mockGetPublicKey.mockResolvedValue(ADDRESS)
    mockGetNetworkDetails.mockResolvedValue(MATCHING_NETWORK)

    const { result } = renderWallet()

    await waitFor(() => expect(result.current.status).toBe("connected"))
    expect(result.current.address).toBe(ADDRESS)
    expect(result.current.isConnected).toBe(true)
    expect(result.current.error).toBeNull()
  })

  it("resolves to wrong-network when authorized but on a different network", async () => {
    window.freighter = true
    mockIsAllowed.mockResolvedValue(true)
    mockGetPublicKey.mockResolvedValue(ADDRESS)
    mockGetNetworkDetails.mockResolvedValue(MISMATCHED_NETWORK)

    const { result } = renderWallet()

    await waitFor(() => expect(result.current.status).toBe("wrong-network"))
    expect(result.current.isConnected).toBe(false)
    expect(result.current.error).toContain("PUBLIC")
  })

  it("connect() transitions locked -> connecting -> connected", async () => {
    window.freighter = true
    mockIsAllowed.mockResolvedValue(false)
    mockRequestAccess.mockResolvedValue(ADDRESS)
    mockGetNetworkDetails.mockResolvedValue(MATCHING_NETWORK)

    const { result } = renderWallet()
    await waitFor(() => expect(result.current.status).toBe("locked"))

    let connectPromise!: Promise<void>
    act(() => {
      connectPromise = result.current.connect()
    })
    expect(result.current.status).toBe("connecting")

    await act(async () => {
      await connectPromise
    })

    expect(result.current.status).toBe("connected")
    expect(result.current.address).toBe(ADDRESS)
  })

  it("connect() transitions to denied when the user rejects the request", async () => {
    window.freighter = true
    mockIsAllowed.mockResolvedValue(false)
    mockRequestAccess.mockRejectedValue(new Error("User declined access"))

    const { result } = renderWallet()
    await waitFor(() => expect(result.current.status).toBe("locked"))

    await act(async () => {
      await result.current.connect()
    })

    expect(result.current.status).toBe("denied")
    expect(result.current.error).toContain("declined")
  })

  it("connect() transitions to denied when requestAccess resolves empty", async () => {
    window.freighter = true
    mockIsAllowed.mockResolvedValue(false)
    mockRequestAccess.mockResolvedValue("")

    const { result } = renderWallet()
    await waitFor(() => expect(result.current.status).toBe("locked"))

    await act(async () => {
      await result.current.connect()
    })

    expect(result.current.status).toBe("denied")
  })

  it("disconnect() clears the session and returns to locked", async () => {
    window.freighter = true
    mockIsAllowed.mockResolvedValue(true)
    mockGetPublicKey.mockResolvedValue(ADDRESS)
    mockGetNetworkDetails.mockResolvedValue(MATCHING_NETWORK)

    const { result } = renderWallet()
    await waitFor(() => expect(result.current.status).toBe("connected"))

    act(() => {
      result.current.disconnect()
    })

    expect(result.current.status).toBe("locked")
    expect(result.current.address).toBeNull()
  })

  it("reacts to a network switch while connected, without a new connect() call", async () => {
    vi.useFakeTimers()
    window.freighter = true
    mockIsAllowed.mockResolvedValue(true)
    mockGetPublicKey.mockResolvedValue(ADDRESS)
    mockGetNetworkDetails.mockResolvedValue(MATCHING_NETWORK)

    const { result } = renderWallet()

    // Flush the initial detect() chain (no real timers on this code path
    // since window.freighter is already true, so this just drains
    // microtasks) until the connected state lands.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
    })
    expect(result.current.status).toBe("connected")

    mockGetNetworkDetails.mockResolvedValue(MISMATCHED_NETWORK)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000)
    })

    expect(result.current.status).toBe("wrong-network")
    expect(mockRequestAccess).not.toHaveBeenCalled()
  })
})
