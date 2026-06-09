"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Progress } from "@/components/ui/progress"
import { Scale, ThumbsUp, ThumbsDown, Plus, Clock, Users } from "lucide-react"

const proposals = [
  { id: "P-001", title: "Q3 Engineering Payroll Budget", description: "Allocate 150,000 XLM for Q3 engineering team salaries via streaming payroll", status: "Active", action: "Funding", votesFor: 12, votesAgainst: 3, totalWeight: 25, quorum: 15, proposer: "GA...XYZ", endTime: "2026-06-15", amount: "150,000 XLM" },
  { id: "P-002", title: "Update Treasury Threshold", description: "Increase multi-sig threshold from 3-of-5 to 4-of-7", status: "Active", action: "PolicyChange", votesFor: 8, votesAgainst: 2, totalWeight: 25, quorum: 15, proposer: "GB...ABC", endTime: "2026-06-10", amount: null },
  { id: "P-003", title: "Community Grant Distribution", description: "Distribute 50,000 XLM to community contributors via vesting", status: "Approved", action: "Funding", votesFor: 20, votesAgainst: 1, totalWeight: 25, quorum: 15, proposer: "GC...DEF", endTime: "2026-05-20", amount: "50,000 XLM" },
]

const statCards = [
  { label: "Total Proposals", value: "8", icon: Scale },
  { label: "Active", value: "2", icon: Clock },
  { label: "Quorum", value: "60%", icon: Users },
  { label: "Members", value: "15", icon: Users },
]

export default function GovernancePage() {
  const [open, setOpen] = useState(false)
  const active = proposals.filter(p => p.status === "Active")
  const past = proposals.filter(p => p.status !== "Active")

  return (
    <div className="flex flex-col gap-6 p-6 pt-24 md:p-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-semibold tracking-tight">Governance</h1>
          <p className="text-muted-foreground">DAO proposals, weighted voting, on-chain execution</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger render={<Button><Plus data-icon="inline-start" />Create Proposal</Button>} />
          <DialogContent className="sm:max-w-lg">
            <DialogHeader><DialogTitle>Create Proposal</DialogTitle></DialogHeader>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2"><label className="text-sm font-medium">Title</label><Input placeholder="Proposal title" maxLength={100} /></div>
              <div className="flex flex-col gap-2"><label className="text-sm font-medium">Description</label><Textarea placeholder="Describe the proposal..." rows={3} maxLength={500} /></div>
              <div className="flex flex-col gap-2"><label className="text-sm font-medium">Action Type</label>
                <Select defaultValue="Funding"><SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="Funding">Funding</SelectItem><SelectItem value="PolicyChange">Policy Change</SelectItem><SelectItem value="General">General</SelectItem></SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2"><label className="text-sm font-medium">Amount</label><Input placeholder="0.00" /></div>
                <div className="flex flex-col gap-2"><label className="text-sm font-medium">Recipient</label><Input placeholder="G..." /></div>
              </div>
              <Button onClick={() => setOpen(false)}>Submit Proposal</Button>
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

      <div>
        <h2 className="mb-4 text-xl font-semibold">Active Proposals</h2>
        <div className="flex flex-col gap-4">
          {active.map((p) => (
            <Card key={p.id} className="border">
              <CardContent className="flex flex-col gap-4 p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm">#{p.id}</span>
                      <Badge variant="default">{p.status}</Badge>
                      <Badge variant="outline">{p.action}</Badge>
                    </div>
                    <h3 className="text-lg font-semibold">{p.title}</h3>
                    <p className="text-muted-foreground text-sm line-clamp-2">{p.description}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="sm"><ThumbsUp data-icon="inline-start" />Yes</Button>
                    <Button size="sm" variant="outline"><ThumbsDown data-icon="inline-start" />No</Button>
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-primary font-medium">{p.votesFor} Yes</span>
                    <span className="text-muted-foreground text-xs">Quorum: {p.quorum}/{p.totalWeight}</span>
                    <span className="text-destructive font-medium">{p.votesAgainst} No</span>
                  </div>
                  <Progress value={(p.votesFor / p.totalWeight) * 100} />
                </div>
                <div className="flex items-center gap-4 text-muted-foreground text-xs">
                  <span className="flex items-center gap-1"><Users /> {p.totalWeight} weight</span>
                  <span className="flex items-center gap-1"><Clock /> Ends {p.endTime}</span>
                  {p.amount && <span>· {p.amount}</span>}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <div>
        <h2 className="mb-4 text-xl font-semibold">Past Proposals</h2>
        <Card className="border"><CardContent className="p-0"><Table><TableHeader><TableRow><TableHead>ID</TableHead><TableHead>Title</TableHead><TableHead>Status</TableHead><TableHead>Votes</TableHead></TableRow></TableHeader>
          <TableBody>{past.map((p) => (<TableRow key={p.id}>
            <TableCell className="font-mono text-sm">#{p.id}</TableCell>
            <TableCell className="font-medium">{p.title}</TableCell>
            <TableCell><Badge variant={p.status === "Approved" ? "default" : "secondary"}>{p.status}</Badge></TableCell>
            <TableCell><span className="text-primary">{p.votesFor} Yes</span> / <span className="text-destructive">{p.votesAgainst} No</span></TableCell>
          </TableRow>))}</TableBody></Table></CardContent></Card>
      </div>
    </div>
  )
}
