"use client"

import { Loader2, CheckCircle2, AlertCircle } from "lucide-react"
import type { LifecycleStage } from "@/lib/soroban/txLifecycle"

const STAGE_LABEL: Record<LifecycleStage, string> = {
  simulating: "Simulating transaction…",
  "awaiting-signature": "Waiting for Freighter signature…",
  submitting: "Submitting to the network…",
  polling: "Confirming on-chain…",
  success: "Confirmed",
  error: "Failed",
}

export interface TxStatusBannerProps {
  stage: LifecycleStage | null
  errorMessage?: string | null
  successMessage?: string | null
}

/** Inline status line for a single in-flight (or just-finished) contract call. */
export function TxStatusBanner({ stage, errorMessage, successMessage }: TxStatusBannerProps) {
  if (!stage) return null

  if (stage === "error") {
    return (
      <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
        <AlertCircle className="mt-0.5 size-4 shrink-0" />
        <span>{errorMessage ?? "Something went wrong."}</span>
      </div>
    )
  }

  if (stage === "success") {
    return (
      <div className="flex items-start gap-2 rounded-md border border-primary/30 bg-primary/10 p-3 text-sm">
        <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" />
        <span>{successMessage ?? "Transaction confirmed."}</span>
      </div>
    )
  }

  return (
    <div className="text-muted-foreground flex items-center gap-2 rounded-md border p-3 text-sm">
      <Loader2 className="size-4 shrink-0 animate-spin" />
      <span>{STAGE_LABEL[stage]}</span>
    </div>
  )
}
