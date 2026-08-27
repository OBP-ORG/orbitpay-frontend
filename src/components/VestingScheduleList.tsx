"use client"

import { useMemo } from "react"
import { useVestingSchedules, type VestingSchedule } from "@/hooks/use-payroll-streams"
import { formatAmount, formatAddress } from "@/lib/format"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Loader2, ChevronRight } from "lucide-react"

/**
 * Paginated list of vesting schedules for an account (issue #26).
 */
export function VestingScheduleList({ account }: { account: string | null }) {
    const {
        data,
        isPending,
        isFetching,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage,
    } = useVestingSchedules(account)

    const schedules = useMemo<VestingSchedule[]>(
        () => data?.pages.flatMap((p) => p.items) ?? [],
        [data],
    )

    if (!account) {
        return (
            <div className="text-center text-muted-foreground py-8">
                Connect wallet to view schedules
            </div>
        )
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">Vesting Schedules</h2>
                {isFetching && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
            </div>

            <div className="rounded-xl border border-border bg-card p-4 overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b border-border">
                            <th className="text-left p-3 font-medium text-muted-foreground">Schedule</th>
                            <th className="text-left p-3 font-medium text-muted-foreground">Beneficiary</th>
                            <th className="text-right p-3 font-medium text-muted-foreground">Total</th>
                            <th className="text-center p-3 font-medium text-muted-foreground">Status</th>
                            <th className="text-center p-3 font-medium text-muted-foreground">Claimed</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50">
                        {isPending ? (
                            <tr>
                                <td colSpan={5} className="text-center text-muted-foreground py-8">
                                    Loading schedules...
                                </td>
                            </tr>
                        ) : schedules.length === 0 ? (
                            <tr>
                                <td colSpan={5} className="text-center text-muted-foreground py-8">
                                    No vesting schedules found
                                </td>
                            </tr>
                        ) : (
                            schedules.map((schedule) => {
                                const claimedPct =
                                    Number(schedule.total_amount) > 0
                                        ? Math.min(
                                              100,
                                              Math.floor(
                                                  (Number(schedule.claimed_amount) * 100) /
                                                      Number(schedule.total_amount)
                                              )
                                          )
                                        : 0
                                return (
                                    <tr key={schedule.id} className="hover:bg-muted/30 transition-colors">
                                        <td className="p-3">
                                            <div className="font-mono text-sm font-medium">
                                                {formatAddress(schedule.contract)}
                                            </div>
                                            <div className="text-xs text-muted-foreground">
                                                ID: {schedule.id}
                                            </div>
                                        </td>
                                        <td className="p-3">
                                            <div className="font-mono text-sm truncate max-w-[150px]">
                                                {formatAddress(schedule.beneficiary)}
                                            </div>
                                        </td>
                                        <td className="text-right p-3 font-mono text-sm">
                                            {formatAmount(BigInt(schedule.total_amount), 0)}
                                        </td>
                                        <td className="text-center p-3">
                                            <Badge variant={schedule.status === "active" ? "default" : "secondary"}>
                                                {schedule.status}
                                            </Badge>
                                        </td>
                                        <td className="text-center p-3">
                                            <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                                                <div
                                                    className="h-full bg-primary transition-all duration-300"
                                                    style={{ width: `${claimedPct}%` }}
                                                />
                                            </div>
                                            <div className="text-xs text-muted-foreground mt-1">
                                                {claimedPct}%
                                            </div>
                                        </td>
                                    </tr>
                                )
                            })
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
                            <ChevronRight className="h-4 w-4 mr-1" />
                        )}
                        Load more
                    </Button>
                </div>
            )}
        </div>
    )
}