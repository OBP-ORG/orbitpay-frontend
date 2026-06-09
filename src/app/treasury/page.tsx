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
import { ArrowDown, ArrowUp, Check, Clock, Landmark, RefreshCw, X } from "lucide-react"

const config = { balance: "450,000 XLM", threshold: 3, signerCount: 5, txCount: 8 }
const signers = ["GA...ABC", "GB...DEF", "GC...GHI", "GD...JKL", "GE...MNO"]
const currentSigner = "GA...ABC"

const pending = [
  { id: "TX-001", to: "GA...XYZ", amount: "25,000 XLM", memo: "Dev team salary", approvals: ["GA...ABC", "GB...DEF"], proposer: "GA...ABC", createdAt: "2026-06-01" },
  { id: "TX-002", to: "GC...MNO", amount: "12,000 XLM", memo: "Infra costs", approvals: ["GA...ABC"], proposer: "GB...DEF", createdAt: "2026-06-03" },
]

const history = [
  { id: "TX-000", to: "GD...PQR", amount: "8,000 XLM", memo: "Audit fee", status: "Executed", date: "2026-05-28" },
]

const stats = [
  { label: "Balance", value: config.balance, icon: Landmark },
  { label: "Threshold", value: `${config.threshold} of ${config.signerCount}`, icon: Check },
  { label: "Signers", value: String(config.signerCount), icon: Check },
  { label: "Pending", value: String(pending.length), icon: Clock },
]

export default function TreasuryPage() {
  const [depositOpen, setDepositOpen] = useState(false)
  const [withdrawOpen, setWithdrawOpen] = useState(false)

  return (
    <div className="flex flex-col gap-6 p-6 pt-24 md:p-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-semibold tracking-tight">Treasury</h1>
          <p className="text-muted-foreground">Multi-sig fund management on Stellar Soroban</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Badge variant="outline" className="rounded-full">Testnet</Badge>
          <Button variant="outline" size="sm"><RefreshCw data-icon="inline-start" />Refresh</Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map(({ label, value, icon: Icon }) => (
          <Card key={label} className="border">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">{label}</CardTitle>
              <Icon className="text-muted-foreground" />
            </CardHeader>
            <CardContent><p className="text-2xl font-semibold tracking-tight">{value}</p></CardContent>
          </Card>
        ))}
      </div>

      <div className="flex flex-wrap gap-3">
        <Dialog open={depositOpen} onOpenChange={setDepositOpen}>
          <DialogTrigger render={<Button><ArrowDown data-icon="inline-start" />Deposit</Button>} />
          <DialogContent>
            <DialogHeader><DialogTitle>Deposit XLM</DialogTitle></DialogHeader>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2"><label className="text-sm font-medium">Amount (XLM)</label><Input placeholder="0.00" /></div>
              <Button onClick={() => setDepositOpen(false)}>Confirm Deposit</Button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={withdrawOpen} onOpenChange={setWithdrawOpen}>
          <DialogTrigger render={<Button variant="outline"><ArrowUp data-icon="inline-start" />Propose Withdrawal</Button>} />
          <DialogContent>
            <DialogHeader><DialogTitle>Propose Withdrawal</DialogTitle></DialogHeader>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2"><label className="text-sm font-medium">Recipient</label><Input placeholder="G..." /></div>
              <div className="flex flex-col gap-2"><label className="text-sm font-medium">Amount (XLM)</label><Input placeholder="0.00" /></div>
              <div className="flex flex-col gap-2"><label className="text-sm font-medium">Memo</label><Input placeholder="Purpose" maxLength={28} /></div>
              <Button onClick={() => setWithdrawOpen(false)}>Submit Proposal</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="pending" className="flex flex-col gap-4">
        <TabsList>
          <TabsTrigger value="pending">Pending Transactions</TabsTrigger>
          <TabsTrigger value="history">Execution History</TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="flex flex-col gap-4">
          {pending.map((tx) => {
            const count = tx.approvals.length
            const met = count >= config.threshold
            const hasApproved = tx.approvals.includes(currentSigner)
            return (
              <Card key={tx.id} className="border">
                <CardContent className="flex flex-col gap-4 p-6">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-medium">{tx.id}</span>
                        <Badge variant={met ? "default" : "secondary"}>{met ? "Ready" : "Pending"}</Badge>
                      </div>
                      <p className="text-muted-foreground text-sm">To: {tx.to} · {tx.amount} · {tx.memo}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {!hasApproved && <Button size="sm" variant="outline"><Check data-icon="inline-start" />Approve</Button>}
                      {met && <Button size="sm">Execute</Button>}
                      {hasApproved && <Badge variant="outline">Approved</Badge>}
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Approvals</span>
                      <span className="font-medium">{count} / {config.threshold}</span>
                    </div>
                    <Progress value={(count / config.threshold) * 100} />
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </TabsContent>

        <TabsContent value="history">
          <Card className="border">
            <CardContent className="p-0">
              <Table>
                <TableHeader><TableRow><TableHead>Transaction</TableHead><TableHead>Recipient</TableHead><TableHead>Amount</TableHead><TableHead>Date</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                <TableBody>
                  {history.map((tx) => (
                    <TableRow key={tx.id}>
                      <TableCell className="font-mono text-sm">{tx.id}</TableCell>
                      <TableCell>{tx.to}</TableCell>
                      <TableCell>{tx.amount}</TableCell>
                      <TableCell>{tx.date}</TableCell>
                      <TableCell><Badge>{tx.status}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
