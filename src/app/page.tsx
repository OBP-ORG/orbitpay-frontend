"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Landmark,
  ArrowRightLeft,
  Clock,
  Scale,
  Users,
  ArrowRight,
  RefreshCw,
} from "lucide-react"
import Link from "next/link"
import { useFreighter } from "@/contexts/FreighterContext"
import { useDashboard } from "@/hooks/useDashboard"

export default function DashboardPage() {
  const { address, isConnected } = useFreighter()
  const { metrics, activity, loading, error, refresh } = useDashboard(address)

  const metricCards = [
    { label: "Treasury Balance", value: metrics.treasuryBalance, icon: Landmark },
    { label: "Active Streams", value: String(metrics.activeStreams), icon: ArrowRightLeft },
    { label: "Vesting Schedules", value: String(metrics.vestingSchedules), icon: Clock },
    { label: "Active Proposals", value: String(metrics.activeProposals), icon: Scale },
    { label: "Employees", value: String(metrics.employees), icon: Users },
  ]

  return (
    <div className="flex flex-col gap-8 p-6 pt-24 md:p-10">
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-semibold tracking-tight">OrbitPay</h1>
          <Button
            variant="ghost"
            size="icon"
            onClick={refresh}
            disabled={loading}
            aria-label="Refresh dashboard data"
          >
            <RefreshCw className={loading ? "animate-spin" : ""} />
          </Button>
        </div>
        <p className="text-muted-foreground">
          {isConnected
            ? `Connected as ${address?.slice(0, 8)}...${address?.slice(-4)}`
            : "Decentralized Payroll on Stellar"}
        </p>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {metricCards.map(({ label, value, icon: Icon }) => (
          <Card key={label} className="border">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">{label}</CardTitle>
              <Icon className="text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold tracking-tight">
                {loading && !value ? "..." : value}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Recent Activity</CardTitle>
            <Button variant="ghost" size="sm" render={<Link href="/treasury" />} nativeButton={false}>
              View All <ArrowRight data-icon="inline-end" />
            </Button>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {activity.map((item) => (
              <div key={item.detail} className="flex items-center justify-between gap-4">
                <div className="flex flex-col gap-0.5">
                  <p className="text-sm font-medium">{item.action}</p>
                  <p className="text-muted-foreground text-sm">{item.detail}</p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge
                    variant={
                      item.status === "success"
                        ? "default"
                        : item.status === "failed"
                          ? "destructive"
                          : "secondary"
                    }
                  >
                    {item.status}
                  </Badge>
                  <span className="text-muted-foreground text-xs">{item.time}</span>
                </div>
              </div>
            ))}
            {!loading && activity.length === 0 && (
              <p className="text-muted-foreground text-sm py-4 text-center">
                No recent activity to display.
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="border">
          <CardHeader><CardTitle>Quick Actions</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-3">
            {[
              { label: "Create Payroll Stream", href: "/payroll", icon: ArrowRightLeft },
              { label: "Propose Withdrawal", href: "/treasury", icon: Landmark },
              { label: "Create Vesting Schedule", href: "/vesting", icon: Clock },
              { label: "New Proposal", href: "/governance", icon: Scale },
            ].map(({ label, href, icon: Icon }) => (
              <Button
                key={label}
                variant="outline"
                className="justify-start"
                render={<Link href={href} />}
                nativeButton={false}
              >
                <Icon data-icon="inline-start" />
                {label}
                <ArrowRight data-icon="inline-end" className="ml-auto" />
              </Button>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
