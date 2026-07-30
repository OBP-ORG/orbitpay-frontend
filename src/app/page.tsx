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
  AlertTriangle,
} from "lucide-react"
import Link from "next/link"
import { useFreighter } from "@/contexts/FreighterContext"
import { useDashboard } from "@/hooks/useDashboard"

/** Small inline error affordance for a single metric card / widget. */
function WidgetError({ message }: { message: string }) {
  return (
    <span
      className="flex items-center gap-1 text-sm text-destructive"
      title={message}
    >
      <AlertTriangle className="size-4" /> Failed to load
    </span>
  )
}

export default function DashboardPage() {
  const { address, isConnected } = useFreighter()
  const { balance, payments, staticMetrics, isInitialLoading, refresh } =
    useDashboard(address)

  const isRefreshing = balance.isFetching || payments.isFetching

  const metricCards = [
    {
      label: "Treasury Balance",
      icon: Landmark,
      widget: balance,
      value: balance.data,
    },
    {
      label: "Active Streams",
      icon: ArrowRightLeft,
      widget: null,
      value: String(staticMetrics.activeStreams),
    },
    {
      label: "Vesting Schedules",
      icon: Clock,
      widget: null,
      value: String(staticMetrics.vestingSchedules),
    },
    {
      label: "Active Proposals",
      icon: Scale,
      widget: null,
      value: String(staticMetrics.activeProposals),
    },
    {
      label: "Employees",
      icon: Users,
      widget: payments,
      value: payments.data ? String(payments.data.employees) : undefined,
    },
  ] as const

  const activity = payments.data?.activity ?? []

  return (
    <div className="flex flex-col gap-8 p-6 pt-24 md:p-10">
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-semibold tracking-tight">OrbitPay</h1>
          <Button
            variant="ghost"
            size="icon"
            onClick={refresh}
            disabled={isRefreshing}
            aria-label="Refresh dashboard data"
          >
            <RefreshCw className={isRefreshing ? "animate-spin" : ""} />
          </Button>
        </div>
        <p className="text-muted-foreground">
          {isConnected
            ? `Connected as ${address?.slice(0, 8)}...${address?.slice(-4)}`
            : "Decentralized Payroll on Stellar"}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {metricCards.map(({ label, value, icon: Icon, widget }) => (
          <Card key={label} className="border">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">{label}</CardTitle>
              <Icon className="text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {widget?.isError && !widget.data ? (
                <WidgetError message={widget.error?.message ?? "Unknown error"} />
              ) : (
                <p className="text-2xl font-semibold tracking-tight">
                  {widget?.isInitialLoading || (!widget && isInitialLoading)
                    ? "..."
                    : (value ?? "—")}
                </p>
              )}
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
            {payments.isError && !payments.data && (
              <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                {payments.error?.message ?? "Failed to load recent activity."}
              </div>
            )}
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
            {!payments.isInitialLoading && !payments.isError && activity.length === 0 && (
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
