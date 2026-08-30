"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useQueries, useQuery, useQueryClient } from "@tanstack/react-query"
import { useFreighter } from "@/contexts/FreighterContext"
import {
  approveWithdrawal,
  executeWithdrawal,
  getTreasuryConfig,
  getWithdrawal,
  isTreasuryConfigured,
  proposeWithdrawal,
  type WithdrawalView,
} from "@/lib/soroban/treasury"
import type { LifecycleStage } from "@/lib/soroban/txLifecycle"
import { TREASURY_CONTRACT_ID } from "@/lib/soroban/config"

const KNOWN_IDS_STORAGE_KEY = `orbitpay:treasury:known-withdrawal-ids:${TREASURY_CONTRACT_ID}`

function loadKnownIds(): number[] {
  if (typeof window === "undefined") return []
  try {
    const raw = window.localStorage.getItem(KNOWN_IDS_STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((id): id is number => typeof id === "number") : []
  } catch {
    return []
  }
}

function saveKnownIds(ids: number[]) {
  if (typeof window === "undefined") return
  window.localStorage.setItem(KNOWN_IDS_STORAGE_KEY, JSON.stringify(ids))
}

export interface ActionState {
  stage: LifecycleStage | null
  message: string | null
}

const IDLE_ACTION: ActionState = { stage: null, message: null }

/** Account-specific keys prevent a previous wallet's reads from becoming the current wallet's UI. */
export const treasuryKeys = {
  all: ["orbitpay", "treasury"] as const,
  config: (address: string | null) => [...treasuryKeys.all, "config", address] as const,
  withdrawal: (address: string | null, id: number) => [...treasuryKeys.all, "withdrawal", address, id] as const,
}

export function useTreasury() {
  const { address, signTransaction } = useFreighter()
  const queryClient = useQueryClient()
  const configured = isTreasuryConfigured()

  const [knownIds, setKnownIds] = useState<number[]>([])
  const [actions, setActions] = useState<Record<string, ActionState>>({})

  const configQuery = useQuery({
    queryKey: treasuryKeys.config(address),
    queryFn: getTreasuryConfig,
    enabled: configured && address !== null,
  })
  const withdrawalQueries = useQueries({
    queries: knownIds.map((id) => ({
      queryKey: treasuryKeys.withdrawal(address, id),
      queryFn: () => getWithdrawal(id),
      enabled: configured && address !== null,
    })),
  })

  const withdrawals = useMemo(
    () => Object.fromEntries(withdrawalQueries.flatMap((query, index) => query.data ? [[knownIds[index], query.data]] : [])) as Record<number, WithdrawalView>,
    [knownIds, withdrawalQueries],
  )
  const withdrawalErrors = useMemo(
    () => Object.fromEntries(withdrawalQueries.flatMap((query, index) => query.error ? [[knownIds[index], query.error.message]] : [])) as Record<number, string>,
    [knownIds, withdrawalQueries],
  )

  const setAction = useCallback((key: string, state: ActionState) => {
    setActions((prev) => ({ ...prev, [key]: state }))
  }, [setActions])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time hydration of persisted state on mount
    setKnownIds(loadKnownIds())
  }, [setKnownIds])

  const trackId = useCallback((id: number) => {
    setKnownIds((prev) => {
      if (prev.includes(id)) return prev
      const next = [...prev, id]
      saveKnownIds(next)
      return next
    })
  }, [setKnownIds])

  const propose = useCallback(
    async (args: { recipient: string; amount: bigint; memo: string }) => {
      if (!address) return
      const key = "propose"
      const onStage = (stage: LifecycleStage) => setAction(key, { stage, message: null })
      const result = await proposeWithdrawal(
        { publicKey: address, signTransaction },
        args,
        onStage,
      )
      if (result.status === "success") {
        setAction(key, { stage: "success", message: `Withdrawal #${result.result} proposed.` })
        trackId(result.result)
      } else {
        setAction(key, { stage: "error", message: result.message })
      }
    },
    [address, signTransaction, setAction, trackId],
  )

  const approve = useCallback(
    async (id: number) => {
      if (!address) return
      const key = `approve-${id}`
      const onStage = (stage: LifecycleStage) => setAction(key, { stage, message: null })
      const result = await approveWithdrawal({ publicKey: address, signTransaction }, id, onStage)
      if (result.status === "success") {
        setAction(key, { stage: "success", message: "Approval recorded." })
        void queryClient.invalidateQueries({ queryKey: treasuryKeys.withdrawal(address, id) })
      } else {
        setAction(key, { stage: "error", message: result.message })
      }
    },
    [address, signTransaction, setAction, queryClient],
  )

  const execute = useCallback(
    async (id: number) => {
      if (!address) return
      const key = `execute-${id}`
      const onStage = (stage: LifecycleStage) => setAction(key, { stage, message: null })
      const result = await executeWithdrawal({ publicKey: address, signTransaction }, id, onStage)
      if (result.status === "success") {
        setAction(key, { stage: "success", message: "Withdrawal executed." })
        void queryClient.invalidateQueries({ queryKey: treasuryKeys.withdrawal(address, id) })
        void queryClient.invalidateQueries({ queryKey: treasuryKeys.config(address) })
      } else {
        setAction(key, { stage: "error", message: result.message })
      }
    },
    [address, signTransaction, setAction, queryClient],
  )

  const actionState = useCallback((key: string): ActionState => actions[key] ?? IDLE_ACTION, [actions])

  const pendingWithdrawals = useMemo(
    () => knownIds.map((id) => withdrawals[id]).filter((w): w is WithdrawalView => !!w && !w.executed),
    [knownIds, withdrawals],
  )
  const executedWithdrawals = useMemo(
    () => knownIds.map((id) => withdrawals[id]).filter((w): w is WithdrawalView => !!w && w.executed),
    [knownIds, withdrawals],
  )

  return {
    configured,
    config: configQuery.data ?? null,
    configError: configQuery.error?.message ?? null,
    configLoading: configQuery.isPending && configQuery.isFetching,
    withdrawals,
    withdrawalErrors,
    pendingWithdrawals,
    executedWithdrawals,
    actionState,
    propose,
    approve,
    execute,
    trackId,
    refresh: () => { void queryClient.invalidateQueries({ queryKey: treasuryKeys.all }) },
    currentSigner: address,
  }
}
