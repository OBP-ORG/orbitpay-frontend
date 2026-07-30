import {
    SorobanRpc,
    Horizon,
} from "@stellar/stellar-sdk";

export interface DashboardMetrics {
    treasuryBalance: string;
    activeStreams: number;
    vestingSchedules: number;
    activeProposals: number;
    employees: number;
}

export interface ActivityItem {
    action: string;
    detail: string;
    time: string;
    status: "success" | "active" | "pending" | "failed";
}

/** Result of a Horizon `payments()` scan: unique counterparties + a recent-activity feed. */
export interface AccountPayments {
    employees: number;
    activity: ActivityItem[];
}

const HORIZON_URL = "https://horizon-testnet.stellar.org";
const RPC_URL = "https://soroban-testnet.stellar.org";

const rpc = new SorobanRpc.Server(RPC_URL, { allowHttp: false });
const horizon = new Horizon.Server(HORIZON_URL);

export function getHorizonServer(): Horizon.Server {
    return horizon;
}

export function getRpcServer(): SorobanRpc.Server {
    return rpc;
}

function describeCause(cause: unknown): string {
    if (cause instanceof Error) return cause.message;
    return String(cause);
}

/**
 * Fetches the native (XLM) balance for a Stellar account.
 *
 * IMPORTANT: this throws on any Horizon/network failure — it never returns a
 * placeholder balance. A network error and a genuine zero balance are two
 * different facts and callers (React Query, in practice) must be able to
 * tell them apart to render "couldn't load balance" instead of "0 XLM".
 *
 * The only case where "0 XLM" is returned is the (rare) genuinely-loaded
 * account that has no native balance line at all — that's real data, not a
 * fallback.
 */
export async function fetchNativeBalance(
    publicKey: string,
): Promise<string> {
    let account: Horizon.AccountResponse;
    try {
        account = await horizon.loadAccount(publicKey);
    } catch (cause) {
        throw new Error(
            `Failed to load account balance from Horizon: ${describeCause(cause)}`,
            { cause },
        );
    }

    const native = account.balances.find((b) => b.asset_type === "native");
    if (!native) return "0 XLM";
    return `${Number.parseFloat(native.balance).toLocaleString()} XLM`;
}

export async function fetchTreasuryBalance(
    treasuryAddress: string,
): Promise<string> {
    return fetchNativeBalance(treasuryAddress);
}

/**
 * Scans an account's recent payments once and derives both the unique
 * counterparty count ("employees") and a recent-activity feed from the same
 * response, instead of issuing two separate Horizon calls for the same data
 * (the previous implementation queried `payments()` twice with different
 * limits — wasteful against a rate-limited RPC).
 *
 * Throws on failure; callers decide how to represent "no data yet" vs.
 * "fetch failed" — this function never manufactures mock activity to mask
 * an error.
 */
function callPayments(address: string) {
    return horizon.payments().forAccount(address).limit(200).order("desc").call();
}

export async function fetchAccountPayments(
    address: string,
): Promise<AccountPayments> {
    let txs: Awaited<ReturnType<typeof callPayments>>;
    try {
        txs = await callPayments(address);
    } catch (cause) {
        throw new Error(
            `Failed to load account activity from Horizon: ${describeCause(cause)}`,
            { cause },
        );
    }

    const uniqueAccounts = new Set<string>();
    for (const tx of txs.records) {
        if ("to" in tx) uniqueAccounts.add(tx.to);
        if ("from" in tx) uniqueAccounts.add(tx.from);
    }

    const activity: ActivityItem[] = txs.records.slice(0, 5).map((tx, i) => {
        const amount =
            "amount" in tx
                ? `${tx.amount} ${("asset_code" in tx && tx.asset_code) || "XLM"}`
                : "unknown";
        return {
            action: tx.type === "create_account" ? "Account created" : "Payment",
            detail: `${("to" in tx && tx.to?.slice(0, 5)) || "??"}... · ${amount}`,
            time: `${i + 1} min ago`,
            status: tx.transaction_successful ? "success" : "failed",
        } satisfies ActivityItem;
    });

    return { employees: uniqueAccounts.size, activity };
}
