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
import { ArrowUp, Check, Clock, Landmark, RefreshCw, ShieldAlert } from "lucide-react"
import { useFreighter } from "@/contexts/FreighterContext"
import { useTreasury } from "@/hooks/useTreasury"
import { TxStatusBanner } from "@/components/tx-status-banner"
import { isStellarAddress } from "@/lib/validation"
import { stroopsToXLM, xlmToStroops } from "@/lib/amount"
import { NATIVE_TOKEN_CONTRACT_ID } from "@/lib/soroban/config"

export default function TreasuryPage() {
  const { isConnected, address } = useFreighter()
  const treasury = useTreasury()
  const [withdrawOpen, setWithdrawOpen] = useState(false)
  const [trackIdInput, setTrackIdInput] = useState("")
  const [form, setForm] = useState({ recipient: "", amount: "", memo: "" })
  const [formError, setFormError] = useState<string | null>(null)
  const [checkingPolicy, setCheckingPolicy] = useState(false)

  if (!treasury.configured) {
    return (
      <div className="flex flex-col gap-6 p-6 pt-24 md:p-10">
        <h1 className="text-3xl font-semibold tracking-tight">Treasury</h1>
        <Card className="border-dashed">
          <CardContent className="text-muted-foreground flex items-center gap-3 p-6 text-sm">
            <ShieldAlert className="size-5 shrink-0" />
            Treasury contract is not configured. Set{" "}
            <code className="bg-muted rounded px-1">NEXT_PUBLIC_TREASURY_CONTRACT_ID</code> to a
            deployed treasury contract to enable this page.
          </CardContent>
        </Card>
      </div>
    )
  }

  // eslint-disable-next-line react-hooks/purity -- one-time snapshot for a disabled-state check, not render output
  const nowSeconds = Math.floor(Date.now() / 1000)
  const proposeAction = treasury.actionState("propose")

  const submitWithdrawal = async () => {
    setFormError(null)
    if (!isStellarAddress(form.recipient)) {
      setFormError("Enter a valid recipient Stellar address")
      return
    }
    let amount: bigint
    try {
      amount = BigInt(xlmToStroops(form.amount))
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Enter a valid amount")
      return
    }
    if (amount <= BigInt(0)) {
      setFormError("Amount must be greater than zero")
      return
    }
    // Policy prerequisites (paused / authorized signer / sufficient live
    // balance for this specific asset) are checked before a transaction is
    // ever built or simulated — see `checkWithdrawalAuthorization` and
    // `checkSufficientBalance` in lib/soroban/treasury.ts.
    setCheckingPolicy(true)
    const policyViolation = await treasury.checkProposalPolicy(NATIVE_TOKEN_CONTRACT_ID, amount)
    setCheckingPolicy(false)
    if (policyViolation) {
      setFormError(policyViolation)
      return
    }
    await treasury.propose({ token: NATIVE_TOKEN_CONTRACT_ID, recipient: form.recipient, amount, memo: form.memo })
  }

  const stats = [
    {
      label: "Balance",
      value: treasury.balance !== null ? stroopsToXLM(String(treasury.balance)) : treasury.balanceError ? "—" : "…",
      icon: Landmark,
    },
    {
      label: "Threshold",
      value: treasury.config ? `${treasury.config.threshold} of ${treasury.config.signers.length}` : "…",
      icon: Check,
    },
    { label: "Signers", value: treasury.config ? String(treasury.config.signers.length) : "…", icon: Check },
    { label: "Pending", value: String(treasury.pendingWithdrawals.length), icon: Clock },
  ]

  return (
    <div className="flex flex-col gap-6 p-6 pt-24 md:p-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-semibold tracking-tight">Treasury</h1>
          <p className="text-muted-foreground">Multi-sig fund management on Stellar Soroban</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Badge variant="outline" className="rounded-full">Testnet</Badge>
          <Button variant="outline" size="sm" onClick={treasury.refresh}>
            <RefreshCw data-icon="inline-start" />Refresh
          </Button>
        </div>
      </div>

      {treasury.config?.paused && (
        <div className="border-destructive/40 bg-destructive/10 text-destructive flex items-center gap-2 rounded-md border p-3 text-sm">
          <ShieldAlert className="size-4 shrink-0" />
          The treasury is paused. Proposing, approving, and executing withdrawals are disabled
          until an admin resumes it.
        </div>
      )}
      {isConnected && treasury.config && !treasury.config.paused && !treasury.isSigner && (
        <div className="border-destructive/40 bg-destructive/10 text-destructive flex items-center gap-2 rounded-md border p-3 text-sm">
          <ShieldAlert className="size-4 shrink-0" />
          Your connected wallet is not an authorized treasury signer. It can view withdrawals but
          cannot propose, approve, or execute them.
        </div>
      )}
      {treasury.configError && <TxStatusBanner stage="error" errorMessage={treasury.configError} />}
      {treasury.balanceError && <TxStatusBanner stage="error" errorMessage={treasury.balanceError} />}

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

      <div className="flex flex-wrap items-center gap-3">
        <Dialog open={withdrawOpen} onOpenChange={setWithdrawOpen}>
          <DialogTrigger
            render={
              <Button disabled={!isConnected || treasury.config?.paused || !treasury.isSigner}>
                <ArrowUp data-icon="inline-start" />Propose Withdrawal
              </Button>
            }
          />
          <DialogContent>
            <DialogHeader><DialogTitle>Propose Withdrawal</DialogTitle></DialogHeader>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium">Recipient</label>
                <Input placeholder="G..." value={form.recipient} onChange={(e) => setForm({ ...form, recipient: e.target.value })} />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium">Amount (XLM)</label>
                <Input placeholder="0.00" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium">Memo</label>
                <Input placeholder="Purpose" maxLength={28} value={form.memo} onChange={(e) => setForm({ ...form, memo: e.target.value })} />
              </div>
              {formError && <TxStatusBanner stage="error" errorMessage={formError} />}
              <TxStatusBanner stage={proposeAction.stage} errorMessage={proposeAction.message} successMessage={proposeAction.message} />
              <Button
                onClick={submitWithdrawal}
                disabled={checkingPolicy || (proposeAction.stage !== null && proposeAction.stage !== "success" && proposeAction.stage !== "error")}
              >
                Submit Proposal
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <div className="flex items-center gap-2">
          <Input
            placeholder="Track withdrawal #ID"
            className="w-44"
            value={trackIdInput}
            onChange={(e) => setTrackIdInput(e.target.value)}
          />
          <Button
            variant="outline"
            onClick={() => {
              const id = Number(trackIdInput)
              if (Number.isInteger(id) && id >= 0) {
                treasury.trackId(id)
                setTrackIdInput("")
              }
            }}
          >
            Track
          </Button>
        </div>
      </div>

      <Tabs defaultValue="pending" className="flex flex-col gap-4">
        <TabsList>
          <TabsTrigger value="pending">Pending Transactions</TabsTrigger>
          <TabsTrigger value="history">Execution History</TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="flex flex-col gap-4">
          {treasury.pendingWithdrawals.length === 0 && (
            <p className="text-muted-foreground text-sm">No tracked pending withdrawals.</p>
          )}
          {treasury.pendingWithdrawals.map((w) => {
            // Always judged against this withdrawal's own frozen threshold
            // (a chain read), never the treasury's *current* config
            // threshold — those can diverge if the signer policy changed
            // after this withdrawal was proposed (see `isWithdrawalStale`).
            const threshold = w.threshold
            const count = w.approvals.length
            const met = treasury.isWithdrawalMet(w)
            const stale = treasury.isWithdrawalStale(w)
            const hasApproved = !!address && w.approvals.includes(address)
            const timelockOpen = nowSeconds >= w.timelockExpiresAt
            const canAct = isConnected && !treasury.config?.paused && treasury.isSigner
            const approveAction = treasury.actionState(`approve-${w.id}`)
            const executeAction = treasury.actionState(`execute-${w.id}`)
            return (
              <Card key={w.id} className="border">
                <CardContent className="flex flex-col gap-4 p-6">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-medium">TX-{w.id}</span>
                        <Badge variant={met ? "default" : "secondary"}>{met ? "Ready" : "Pending"}</Badge>
                        {!timelockOpen && <Badge variant="outline">Timelocked</Badge>}
                        {stale && <Badge variant="outline">Policy changed</Badge>}
                      </div>
                      <p className="text-muted-foreground text-sm">
                        To: {w.recipient} · {stroopsToXLM(String(w.amount))} · {w.memo}
                      </p>
                      {stale && (
                        <p className="text-muted-foreground text-xs">
                          The treasury&apos;s signer threshold has changed since this withdrawal was
                          proposed. Refresh to confirm current requirements before acting on it.
                        </p>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {!hasApproved && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={!canAct}
                          onClick={() => treasury.approve(w.id)}
                        >
                          <Check data-icon="inline-start" />Approve
                        </Button>
                      )}
                      {met && (
                        <Button
                          size="sm"
                          disabled={!canAct || !timelockOpen}
                          onClick={() => treasury.execute(w.id)}
                        >
                          Execute
                        </Button>
                      )}
                      {hasApproved && <Badge variant="outline">Approved</Badge>}
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Approvals</span>
                      <span className="font-medium">{count} / {threshold}</span>
                    </div>
                    <Progress value={(count / threshold) * 100} />
                  </div>
                  <TxStatusBanner stage={approveAction.stage} errorMessage={approveAction.message} successMessage={approveAction.message} />
                  <TxStatusBanner stage={executeAction.stage} errorMessage={executeAction.message} successMessage={executeAction.message} />
                </CardContent>
              </Card>
            )
          })}
        </TabsContent>

        <TabsContent value="history">
          <Card className="border">
            <CardContent className="p-0">
              <Table>
                <TableHeader><TableRow><TableHead>Transaction</TableHead><TableHead>Recipient</TableHead><TableHead>Amount</TableHead><TableHead>Memo</TableHead></TableRow></TableHeader>
                <TableBody>
                  {treasury.executedWithdrawals.length === 0 && (
                    <TableRow><TableCell colSpan={4} className="text-muted-foreground">No tracked executed withdrawals.</TableCell></TableRow>
                  )}
                  {treasury.executedWithdrawals.map((w) => (
                    <TableRow key={w.id}>
                      <TableCell className="font-mono text-sm">TX-{w.id}</TableCell>
                      <TableCell>{w.recipient}</TableCell>
                      <TableCell>{stroopsToXLM(String(w.amount))}</TableCell>
                      <TableCell>{w.memo}</TableCell>
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
