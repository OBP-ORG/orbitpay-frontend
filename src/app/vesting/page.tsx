"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Clock, Plus, Lock, Unlock, Shield } from "lucide-react"

const schedules = [
  { id: "V-001", beneficiary: "GA...XYZ", label: "Team", totalAmount: "50,000 XLM", claimedAmount: "12,500", cliff: "90 days", duration: "365 days", revocable: true, status: "Active" },
  { id: "V-002", beneficiary: "GB...ABC", label: "Advisor", totalAmount: "15,000 XLM", claimedAmount: "0", cliff: "180 days", duration: "365 days", revocable: false, status: "Active" },
  { id: "V-003", beneficiary: "GC...DEF", label: "Seed", totalAmount: "100,000 XLM", claimedAmount: "100,000", cliff: "365 days", duration: "730 days", revocable: false, status: "FullyClaimed" },
]

const statCards = [
  { label: "Total Locked", value: "165,000 XLM", icon: Lock },
  { label: "Active", value: "2", icon: Clock },
  { label: "Fully Vested", value: "1", icon: Unlock },
  { label: "Claimed", value: "112,500 XLM", icon: Shield },
]

export default function VestingPage() {
  const [open, setOpen] = useState(false)

  return (
    <div className="flex flex-col gap-6 p-6 pt-24 md:p-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-semibold tracking-tight">Token Vesting</h1>
          <p className="text-muted-foreground">Cliff + linear vesting schedules on Stellar</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger render={<Button><Plus data-icon="inline-start" />Create Schedule</Button>} />
          <DialogContent className="sm:max-w-lg">
            <DialogHeader><DialogTitle>Create Vesting Schedule</DialogTitle></DialogHeader>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2"><label className="text-sm font-medium">Beneficiary</label><Input placeholder="G..." /></div>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2"><label className="text-sm font-medium">Total Amount</label><Input placeholder="0.00" /></div>
                <div className="flex flex-col gap-2"><label className="text-sm font-medium">Token</label><Input placeholder="XLM" /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2"><label className="text-sm font-medium">Cliff (days)</label><Input placeholder="90" /></div>
                <div className="flex flex-col gap-2"><label className="text-sm font-medium">Duration (days)</label><Input placeholder="365" /></div>
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium">Label</label>
                <Select defaultValue="Team"><SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="Team">Team</SelectItem><SelectItem value="Advisor">Advisor</SelectItem><SelectItem value="Seed">Seed</SelectItem><SelectItem value="Custom">Custom</SelectItem></SelectContent>
                </Select>
              </div>
              <Button onClick={() => setOpen(false)}>Create Schedule</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map(({ label, value, icon: Icon }) => (
          <Card key={label} className="border">
            <CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">{label}</CardTitle><Icon className="text-muted-foreground" /></CardHeader>
            <CardContent><p className="text-2xl font-semibold tracking-tight">{value}</p></CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="active" className="flex flex-col gap-4">
        <TabsList><TabsTrigger value="active">Active</TabsTrigger><TabsTrigger value="all">All Schedules</TabsTrigger></TabsList>

        <TabsContent value="active" className="flex flex-col gap-4">
          {schedules.filter(s => s.status === "Active").map((s) => {
            const pct = Math.round((parseInt(s.claimedAmount.replace(/,/g,"")) / parseInt(s.totalAmount.replace(/,/g,""))) * 100)
            return (
              <Card key={s.id} className="border">
                <CardContent className="flex flex-col gap-4 p-6">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm">{s.id}</span>
                        <Badge>{s.label}</Badge>
                        {s.revocable ? <Badge variant="outline">Revocable</Badge> : <Badge variant="secondary">Locked</Badge>}
                      </div>
                      <p className="text-muted-foreground text-sm">{s.beneficiary} · {s.totalAmount}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="outline"><Unlock data-icon="inline-start" />Claim</Button>
                      {s.revocable && <Button size="sm" variant="ghost" className="text-destructive">Revoke</Button>}
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between text-sm"><span className="text-muted-foreground">Vested</span><span>{pct}%</span></div>
                    <Progress value={pct} />
                  </div>
                  <div className="flex items-center gap-4 text-muted-foreground text-xs"><span>Cliff: {s.cliff}</span><span>·</span><span>Duration: {s.duration}</span><span>·</span><span>{s.claimedAmount} claimed</span></div>
                </CardContent>
              </Card>
            )
          })}
        </TabsContent>

        <TabsContent value="all">
          <Card className="border"><CardContent className="p-0"><Table><TableHeader><TableRow><TableHead>Schedule</TableHead><TableHead>Beneficiary</TableHead><TableHead>Amount</TableHead><TableHead>Label</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
            <TableBody>{schedules.map((s) => (<TableRow key={s.id}>
              <TableCell className="font-mono text-sm">{s.id}</TableCell><TableCell>{s.beneficiary}</TableCell><TableCell>{s.totalAmount}</TableCell>
              <TableCell><Badge variant="outline">{s.label}</Badge></TableCell>
              <TableCell><Badge variant={s.status === "Active" ? "default" : "secondary"}>{s.status}</Badge></TableCell>
            </TableRow>))}</TableBody></Table></CardContent></Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
