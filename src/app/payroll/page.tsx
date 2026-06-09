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
import { ArrowRightLeft, Plus, Clock, CheckCircle, XCircle, Send } from "lucide-react"

const streams = [
  { id: "STR-001", recipient: "GA...XYZ", token: "USDC", totalAmount: "10,000", claimedAmount: "4,200", startTime: "2026-06-01", endTime: "2026-07-01", status: "Active" },
  { id: "STR-002", recipient: "GB...ABC", token: "XLM", totalAmount: "25,000", claimedAmount: "8,500", startTime: "2026-05-15", endTime: "2026-08-15", status: "Active" },
  { id: "STR-003", recipient: "GC...DEF", token: "USDC", totalAmount: "5,000", claimedAmount: "5,000", startTime: "2026-04-01", endTime: "2026-05-01", status: "Completed" },
]

export default function PayrollPage() {
  const [open, setOpen] = useState(false)

  return (
    <div className="flex flex-col gap-6 p-6 pt-24 md:p-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-semibold tracking-tight">Payroll</h1>
          <p className="text-muted-foreground">Continuous salary streaming on Stellar</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger render={<Button><Plus data-icon="inline-start" />Create Stream</Button>} />
          <DialogContent className="sm:max-w-lg">
            <DialogHeader><DialogTitle>Create Payroll Stream</DialogTitle></DialogHeader>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2"><label className="text-sm font-medium">Recipient Address</label><Input placeholder="G..." /></div>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2"><label className="text-sm font-medium">Amount</label><Input placeholder="0.00" /></div>
                <div className="flex flex-col gap-2"><label className="text-sm font-medium">Token</label><Input placeholder="XLM" /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2"><label className="text-sm font-medium">Start Date</label><Input type="date" /></div>
                <div className="flex flex-col gap-2"><label className="text-sm font-medium">End Date</label><Input type="date" /></div>
              </div>
              <Button onClick={() => setOpen(false)}>Create Stream</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Active Streams", value: "2", icon: ArrowRightLeft },
          { label: "Total Streamed", value: "12,700 XLM", icon: Send },
          { label: "Employees", value: "3", icon: Clock },
          { label: "Completed", value: "1", icon: CheckCircle },
        ].map(({ label, value, icon: Icon }) => (
          <Card key={label} className="border">
            <CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">{label}</CardTitle><Icon className="text-muted-foreground" /></CardHeader>
            <CardContent><p className="text-2xl font-semibold tracking-tight">{value}</p></CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="active" className="flex flex-col gap-4">
        <TabsList><TabsTrigger value="active">Active Streams</TabsTrigger><TabsTrigger value="all">All Streams</TabsTrigger></TabsList>

        <TabsContent value="active" className="flex flex-col gap-4">
          {streams.filter(s => s.status === "Active").map((s) => {
            const elapsed = 40
            return (
              <Card key={s.id} className="border">
                <CardContent className="flex flex-col gap-4 p-6">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm">{s.id}</span>
                        <Badge variant="default">Active</Badge>
                      </div>
                      <p className="text-muted-foreground text-sm">{s.recipient} · {s.totalAmount} {s.token}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{s.claimedAmount} / {s.totalAmount}</span>
                      <Button size="sm" variant="outline"><Send data-icon="inline-start" />Claim</Button>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between text-sm"><span className="text-muted-foreground">Progress</span><span>{elapsed}%</span></div>
                    <Progress value={elapsed} />
                  </div>
                  <div className="flex items-center gap-4 text-muted-foreground text-xs"><span>{s.startTime}</span><span>→</span><span>{s.endTime}</span></div>
                </CardContent>
              </Card>
            )
          })}
        </TabsContent>

        <TabsContent value="all">
          <Card className="border">
            <CardContent className="p-0"><Table><TableHeader><TableRow><TableHead>Stream</TableHead><TableHead>Recipient</TableHead><TableHead>Amount</TableHead><TableHead>Period</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
              <TableBody>{streams.map((s) => (<TableRow key={s.id}>
                <TableCell className="font-mono text-sm">{s.id}</TableCell>
                <TableCell>{s.recipient}</TableCell>
                <TableCell>{s.totalAmount} {s.token}</TableCell>
                <TableCell>{s.startTime} → {s.endTime}</TableCell>
                <TableCell><Badge variant={s.status === "Active" ? "default" : "secondary"}>{s.status}</Badge></TableCell>
              </TableRow>))}</TableBody>
            </Table></CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
