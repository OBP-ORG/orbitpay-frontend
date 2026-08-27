"use client"

import { useMemo } from "react"
import { usePayrollStreams, type PayrollStream } from "@/hooks/use-payroll-streams"
import { formatAmount, formatAddress } from "@/lib/format"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Loader2 } from "lucide-react"

/**
 * Paginated list of active payroll streams for an account (issue #26).
 */
export function PayrollStreamList({ account }: { account: string | null }) {
    const {
        data,
        isPending,
        isFetching,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage,
    } = usePayrollStreams(account)

    const streams = useMemo<PayrollStream[]>(
        () => data?.pages.flatMap((p) => p.items) ?? [],
        [data],
    )

    if (!account) {
        return (
            <div className="text-center text-muted-foreground py-8">
                Connect wallet to view streams
            </div>
        )
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">Active Streams</h2>
                {isFetching && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
            </div>

            <div className="rounded-xl border border-border bg-card p-4 overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b border-border">
                            <th className="text-left p-3 font-medium text-muted-foreground">Stream</th>
                            <th className="text-left p-3 font-medium text-muted-foreground">Sender</th>
                            <th className="text-right p-3 font-medium text-muted-foreground">Rate/s</th>
                            <th className="text-center p-3 font-medium text-muted-foreground">Status</th>
                            <th className="text-right p-3 font-medium text-muted-foreground">Balance</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50">
                        {isPending ? (
                            <tr>
                                <td colSpan={5} className="text-center text-muted-foreground py-8">
                                    Loading streams...
                                </td>
                            </tr>
                        ) : streams.length === 0 ? (
                            <tr>
                                <td colSpan={5} className="text-center text-muted-foreground py-8">
                                    No active streams found
                                </td>
                            </tr>
                        ) : (
                            streams.map((stream) => (
                                <tr key={stream.id} className="hover:bg-muted/30 transition-colors">
                                    <td className="p-3">
                                        <div className="font-mono text-sm font-medium">
                                            {formatAddress(stream.contract)}
                                        </div>
                                        <div className="text-xs text-muted-foreground">
                                            Stream #{stream.id}
                                        </div>
                                    </td>
                                    <td className="p-3">
                                        <div className="font-mono text-sm truncate max-w-[150px]">
                                            {formatAddress(stream.sender)}
                                        </div>
                                    </td>
                                    <td className="text-right p-3 font-mono text-sm">
                                        {formatAmount(BigInt(stream.rate_per_second), 4)} /s
                                    </td>
                                    <td className="text-center p-3">
                                        <Badge variant="secondary">{stream.status}</Badge>
                                    </td>
                                    <td className="text-right p-3 font-mono text-sm">
                                        {formatAmount(BigInt(stream.balance))}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {hasNextPage && (
                <div className="mt-4 text-center">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => fetchNextPage()}
                        disabled={isFetchingNextPage}
                    >
                        {isFetchingNextPage ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : (
                            "Load more"
                        )}
                    </Button>
                </div>
            )}
        </div>
    )
}