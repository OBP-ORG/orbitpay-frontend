"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Landmark, ArrowRightLeft, Clock, Scale, Users, ArrowRight } from "lucide-react"
import Link from "next/link"
import { useFreighter } from "@/contexts/FreighterContext"

const metrics = [
  { label: "Treasury Balance", value: "450,000 XLM", icon: Landmark },
  { label: "Active Streams", value: "8", icon: ArrowRightLeft },
  { label: "Vesting Schedules", value: "12", icon: Clock },
  { label: "Active Proposals", value: "3", icon: Scale },
  { label: "Employees", value: "23", icon: Users },
]

const recentActivity = [
  { action: "Salary claimed", detail: "GA...XYZ · 4,200 XLM", time: "2 min ago", status: "success" },
  { action: "Stream created", detail: "GB...ABC · 25,000 XLM", time: "1 hr ago", status: "active" },
  { action: "Withdrawal executed", detail: "GC...MNO · 8,000 XLM", time: "3 hrs ago", status: "success" },
  { action: "Proposal created", detail: "Q3 Engineering Budget", time: "5 hrs ago", status: "active" },
]

export default function DashboardPage() {
  const { address, isConnected } = useFreighter()
  return (
    <div className="flex flex-col gap-8 p-6 pt-24 md:p-10">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-semibold tracking-tight">OrbitPay</h1>
        <p className="text-muted-foreground">
          {isConnected ? `Connected as ${address?.slice(0, 8)}...${address?.slice(-4)}` : "Decentralized Payroll on Stellar"}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {metrics.map(({ label, value, icon: Icon }) => (
          <Card key={label} className="border">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">{label}</CardTitle>
              <Icon className="text-muted-foreground" />
            </CardHeader>
            <CardContent><p className="text-2xl font-semibold tracking-tight">{value}</p></CardContent>
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
            {recentActivity.map((item) => (
              <div key={item.detail} className="flex items-center justify-between gap-4">
                <div className="flex flex-col gap-0.5">
                  <p className="text-sm font-medium">{item.action}</p>
                  <p className="text-muted-foreground text-sm">{item.detail}</p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant={item.status === "success" ? "default" : "secondary"}>{item.status}</Badge>
                  <span className="text-muted-foreground text-xs">{item.time}</span>
                </div>
              </div>
            ))}
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
              <Button key={label} variant="outline" className="justify-start" render={<Link href={href} />} nativeButton={false}>
                <Icon data-icon="inline-start" />{label}<ArrowRight data-icon="inline-end" className="ml-auto" />
              </Button>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
