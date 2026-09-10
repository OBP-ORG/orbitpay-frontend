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
import { Scale, ThumbsUp, ThumbsDown, Plus, Clock, Users, ShieldAlert } from "lucide-react"
import { useFreighter } from "@/contexts/FreighterContext"
import { useGovernance } from "@/hooks/useGovernance"
import { TxStatusBanner } from "@/components/tx-status-banner"
import { isStellarAddress } from "@/lib/validation"
import { stroopsToXLM, xlmToStroops } from "@/lib/amount"
import { type ProposalView, isGovernanceWritesEnabled } from "@/lib/soroban/governance"

export default function GovernancePage() {
  const { isConnected } = useFreighter()
  const gov = useGovernance()
  const writesEnabled = isGovernanceWritesEnabled()
  const [open, setOpen] = useState(false)
  const [trackIdInput, setTrackIdInput] = useState("")
  const [form, setForm] = useState<{
    title: string
    description: string
    action: ProposalView["action"]
    amount: string
    recipient: string
  }>({ title: "", description: "", action: "Funding", amount: "", recipient: "" })
  const [formError, setFormError] = useState<string | null>(null)

  if (!gov.configured) {
    return (
      <div className="flex flex-col gap-6 p-6 pt-24 md:p-10">
        <h1 className="text-3xl font-semibold tracking-tight">Governance</h1>
        <Card className="border-dashed">
          <CardContent className="text-muted-foreground flex items-center gap-3 p-6 text-sm">
            <ShieldAlert className="size-5 shrink-0" />
            Governance contract is not configured. Set{" "}
            <code className="bg-muted rounded px-1">NEXT_PUBLIC_GOVERNANCE_CONTRACT_ID</code> to a
            deployed governance contract to enable this page.
          </CardContent>
        </Card>
      </div>
    )
  }

  const proposeAction = gov.actionState("propose")

  const submitProposal = async () => {
    setFormError(null)
    if (!form.title.trim()) {
      setFormError("Title is required")
      return
    }
    let amount: bigint | null = null
    let recipient: string | null = null
    if (form.action === "Funding") {
      if (!form.recipient || !isStellarAddress(form.recipient)) {
        setFormError("Funding proposals require a valid recipient address")
        return
      }
      try {
        amount = BigInt(xlmToStroops(form.amount))
      } catch (e) {
        setFormError(e instanceof Error ? e.message : "Enter a valid amount")
        return
      }
      recipient = form.recipient
    }
    await gov.propose({
      title: form.title,
      description: form.description,
      action: form.action,
      amount,
      recipient,
    })
  }

  const statCards = [
    { label: "Total Proposals", value: gov.config ? String(gov.config.proposalCount) : "…", icon: Scale },
    { label: "Active", value: String(gov.activeProposals.length), icon: Clock },
    { label: "Quorum", value: gov.config ? String(gov.config.quorum) : "…", icon: Users },
    { label: "Total Weight", value: gov.config ? String(gov.config.totalWeight) : "…", icon: Users },
  ]

  return (
    <div className="flex flex-col gap-6 p-6 pt-24 md:p-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-semibold tracking-tight">Governance</h1>
          <p className="text-muted-foreground">DAO proposals, weighted voting, on-chain execution</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger render={<Button disabled={!isConnected || !writesEnabled}><Plus data-icon="inline-start" />Create Proposal</Button>} />
          <DialogContent className="sm:max-w-lg">
            <DialogHeader><DialogTitle>Create Proposal</DialogTitle></DialogHeader>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium">Title</label>
                <Input placeholder="Proposal title" maxLength={100} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium">Description</label>
                <Textarea placeholder="Describe the proposal..." rows={3} maxLength={500} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium">Action Type</label>
                <Select value={form.action} onValueChange={(v) => setForm({ ...form, action: v as ProposalView["action"] })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Funding">Funding</SelectItem>
                    <SelectItem value="PolicyChange">Policy Change</SelectItem>
                    <SelectItem value="General">General</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {form.action === "Funding" && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-medium">Amount</label>
                    <Input placeholder="0.00" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-medium">Recipient</label>
                    <Input placeholder="G..." value={form.recipient} onChange={(e) => setForm({ ...form, recipient: e.target.value })} />
                  </div>
                </div>
              )}
              {formError && <TxStatusBanner stage="error" errorMessage={formError} />}
              <TxStatusBanner stage={proposeAction.stage} errorMessage={proposeAction.message} successMessage={proposeAction.message} />
              <Button onClick={submitProposal} disabled={proposeAction.stage !== null && proposeAction.stage !== "success" && proposeAction.stage !== "error"}>
                Submit Proposal
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {gov.configError && <TxStatusBanner stage="error" errorMessage={gov.configError} />}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map(({ label, value, icon: Icon }) => (
          <Card key={label} className="border">
            <CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">{label}</CardTitle><Icon className="text-muted-foreground" /></CardHeader>
            <CardContent><p className="text-2xl font-semibold tracking-tight">{value}</p></CardContent>
          </Card>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <Input placeholder="Track proposal #ID" className="w-44" value={trackIdInput} onChange={(e) => setTrackIdInput(e.target.value)} />
        <Button
          variant="outline"
          onClick={() => {
            const id = Number(trackIdInput)
            if (Number.isInteger(id) && id >= 0) {
              gov.trackId(id)
              setTrackIdInput("")
            }
          }}
        >
          Track
        </Button>
      </div>

      <div>
        <h2 className="mb-4 text-xl font-semibold">Active Proposals</h2>
        {gov.activeProposals.length === 0 && (
          <p className="text-muted-foreground text-sm">No tracked active proposals.</p>
        )}
        <div className="flex flex-col gap-4">
          {gov.activeProposals.map((p) => {
            const voteAction = gov.actionState(`vote-${p.id}`)
            const executeAction = gov.actionState(`execute-${p.id}`)
            const met = p.votesFor + p.votesAgainst >= p.quorum
            return (
              <Card key={p.id} className="border">
                <CardContent className="flex flex-col gap-4 p-6">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm">#{p.id}</span>
                        <Badge variant="default">Active</Badge>
                        <Badge variant="outline">{p.action}</Badge>
                      </div>
                      <h3 className="text-lg font-semibold">{p.title}</h3>
                      <p className="text-muted-foreground text-sm line-clamp-2">{p.description}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button size="sm" disabled={!isConnected} onClick={() => gov.castVote(p.id, true)}>
                        <ThumbsUp data-icon="inline-start" />Yes
                      </Button>
                      <Button size="sm" variant="outline" disabled={!isConnected} onClick={() => gov.castVote(p.id, false)}>
                        <ThumbsDown data-icon="inline-start" />No
                      </Button>
                      {met && (
                        <Button size="sm" variant="outline" disabled={!isConnected} onClick={() => gov.execute(p.id)}>
                          Execute
                        </Button>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-primary font-medium">{p.votesFor} Yes</span>
                      <span className="text-muted-foreground text-xs">Quorum: {p.quorum}/{p.totalWeight}</span>
                      <span className="text-destructive font-medium">{p.votesAgainst} No</span>
                    </div>
                    <Progress value={(p.votesFor / Math.max(p.totalWeight, 1)) * 100} />
                  </div>
                  <div className="flex items-center gap-4 text-muted-foreground text-xs">
                    <span className="flex items-center gap-1"><Users /> {p.totalWeight} weight</span>
                    <span className="flex items-center gap-1"><Clock /> Ends {new Date(p.endTime * 1000).toLocaleDateString()}</span>
                    {p.amount !== null && <span>· {stroopsToXLM(String(p.amount))}</span>}
                  </div>
                  <TxStatusBanner stage={voteAction.stage} errorMessage={voteAction.message} successMessage={voteAction.message} />
                  <TxStatusBanner stage={executeAction.stage} errorMessage={executeAction.message} successMessage={executeAction.message} />
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>

      <div>
        <h2 className="mb-4 text-xl font-semibold">Past Proposals</h2>
        <Card className="border">
          <CardContent className="p-0">
            <Table>
              <TableHeader><TableRow><TableHead>ID</TableHead><TableHead>Title</TableHead><TableHead>Votes</TableHead></TableRow></TableHeader>
              <TableBody>
                {gov.pastProposals.length === 0 && (
                  <TableRow><TableCell colSpan={3} className="text-muted-foreground">No tracked past proposals.</TableCell></TableRow>
                )}
                {gov.pastProposals.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-mono text-sm">#{p.id}</TableCell>
                    <TableCell className="font-medium">{p.title}</TableCell>
                    <TableCell><span className="text-primary">{p.votesFor} Yes</span> / <span className="text-destructive">{p.votesAgainst} No</span></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
