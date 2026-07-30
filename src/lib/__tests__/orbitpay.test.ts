import { describe, expect, it, vi, beforeEach } from "vitest"
import { Horizon } from "@stellar/stellar-sdk"

vi.mock("@stellar/stellar-sdk", async () => {
    const actual = await vi.importActual<typeof import("@stellar/stellar-sdk")>(
        "@stellar/stellar-sdk",
    )
    return {
        ...actual,
        Horizon: {
            Server: vi.fn(),
        },
        SorobanRpc: {
            Server: vi.fn().mockImplementation(function MockRpcServer() {}),
        },
    }
})

const loadAccount = vi.fn()
const paymentsCall = vi.fn()
const paymentsBuilder = {
    forAccount: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    call: paymentsCall,
}

vi.mocked(Horizon.Server).mockImplementation(function MockHorizonServer() {
    return {
        loadAccount,
        payments: vi.fn(() => paymentsBuilder),
    } as unknown as Horizon.Server
} as unknown as new (...args: unknown[]) => Horizon.Server)

const { fetchNativeBalance, fetchAccountPayments } = await import("@/lib/orbitpay")

const ADDRESS = "GABCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQRSTUVW"

beforeEach(() => {
    loadAccount.mockReset()
    paymentsCall.mockReset()
    paymentsBuilder.forAccount.mockClear()
    paymentsBuilder.limit.mockClear()
    paymentsBuilder.order.mockClear()
})

describe("fetchNativeBalance", () => {
    it("returns the formatted native balance for a loaded account", async () => {
        loadAccount.mockResolvedValue({
            balances: [{ asset_type: "native", balance: "1234.5" }],
        })

        await expect(fetchNativeBalance(ADDRESS)).resolves.toBe("1,234.5 XLM")
    })

    it("returns a genuine '0 XLM' when the account has no native balance line (real data, not a fallback)", async () => {
        loadAccount.mockResolvedValue({
            balances: [{ asset_type: "credit_alphanum4", balance: "500" }],
        })

        await expect(fetchNativeBalance(ADDRESS)).resolves.toBe("0 XLM")
    })

    it("throws — never returns a placeholder — when Horizon fails", async () => {
        loadAccount.mockRejectedValue(new Error("Network request failed"))

        await expect(fetchNativeBalance(ADDRESS)).rejects.toThrow(
            /Failed to load account balance from Horizon/,
        )
    })
})

describe("fetchAccountPayments", () => {
    it("derives unique counterparties and a recent-activity feed from a single payments call", async () => {
        paymentsCall.mockResolvedValue({
            records: [
                {
                    type: "payment",
                    to: "GAAA1",
                    from: "GBBB1",
                    amount: "10",
                    asset_code: "USDC",
                    transaction_successful: true,
                },
                {
                    type: "create_account",
                    to: "GCCC1",
                    transaction_successful: true,
                },
            ],
        })

        const result = await fetchAccountPayments(ADDRESS)

        expect(result.employees).toBe(3)
        expect(result.activity).toHaveLength(2)
        expect(result.activity[0].action).toBe("Payment")
        expect(result.activity[1].action).toBe("Account created")
        // Only one Horizon call made for both derived pieces of data.
        expect(paymentsCall).toHaveBeenCalledTimes(1)
    })

    it("throws — never returns mock activity — when Horizon fails", async () => {
        paymentsCall.mockRejectedValue(new Error("timeout"))

        await expect(fetchAccountPayments(ADDRESS)).rejects.toThrow(
            /Failed to load account activity from Horizon/,
        )
    })
})
