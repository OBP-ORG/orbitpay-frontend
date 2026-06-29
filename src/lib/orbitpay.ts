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

export async function fetchNativeBalance(
    publicKey: string,
): Promise<string> {
    try {
        const account = await horizon.loadAccount(publicKey);
        const native = account.balances.find((b) => b.asset_type === "native");
        if (!native) return "0 XLM";
        return `${Number.parseFloat(native.balance).toLocaleString()} XLM`;
    } catch {
        return "0 XLM";
    }
}

export async function fetchTreasuryBalance(
    treasuryAddress: string,
): Promise<string> {
    return fetchNativeBalance(treasuryAddress);
}

export async function fetchDashboardMetrics(
    _address: string | null,
): Promise<DashboardMetrics> {
    if (!_address) {
        return makeMockMetrics("0 XLM");
    }

    try {
        const balance = await fetchNativeBalance(_address);
        const metrics: DashboardMetrics = {
            treasuryBalance: balance,
            activeStreams: 0,
            vestingSchedules: 0,
            activeProposals: 0,
            employees: 0,
        };

        try {
            const txs = await horizon
                .payments()
                .forAccount(_address)
                .limit(200)
                .call();

            const uniqueAccounts = new Set<string>();
            for (const tx of txs.records) {
                if ("to" in tx) uniqueAccounts.add(tx.to);
                if ("from" in tx) uniqueAccounts.add(tx.from);
            }
            metrics.employees = uniqueAccounts.size;
        } catch {
            // Ignore pagination errors
        }

        return metrics;
    } catch {
        return makeMockMetrics("0 XLM");
    }
}

function makeMockMetrics(balance: string): DashboardMetrics {
    return {
        treasuryBalance: balance,
        activeStreams: 0,
        vestingSchedules: 0,
        activeProposals: 0,
        employees: 0,
    };
}

export async function fetchRecentActivity(
    _address: string | null,
): Promise<ActivityItem[]> {
    if (!_address) return MOCK_ACTIVITY;

    try {
        const txs = await horizon
            .payments()
            .forAccount(_address)
            .limit(10)
            .order("desc")
            .call();

        return txs.records.slice(0, 5).map((tx, i) => {
            const amount =
                "amount" in tx ? `${tx.amount} ${("asset_code" in tx && tx.asset_code) || "XLM"}` : "unknown";
            return {
                action: tx.type === "create_account" ? "Account created" : "Payment",
                detail: `${("to" in tx && tx.to?.slice(0, 5)) || "??"}... · ${amount}`,
                time: `${i + 1} min ago`,
                status: tx.transaction_successful ? "success" : "failed",
            } as ActivityItem;
        });
    } catch {
        return MOCK_ACTIVITY;
    }
}

const MOCK_ACTIVITY: ActivityItem[] = [
    {
        action: "No recent activity",
        detail: "Connect wallet to view transactions",
        time: "",
        status: "pending",
    },
];