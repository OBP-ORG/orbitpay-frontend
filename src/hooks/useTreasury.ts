"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useFreighter } from "@/contexts/FreighterContext"
import {
  approveWithdrawal,
  executeWithdrawal,
  getTreasuryConfig,
  getWithdrawal,
  isTreasuryConfigured,
  proposeWithdrawal,
  type TreasuryConfigView,
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

export function useTreasury() {
  const { address, signTransaction } = useFreighter()
  const configured = isTreasuryConfigured()

  const [config, setConfig] = useState<TreasuryConfigView | null>(null)
  const [configError, setConfigError] = useState<string | null>(null)
  const [configLoading, setConfigLoading] = useState(false)

  const [knownIds, setKnownIds] = useState<number[]>([])
  const [withdrawals, setWithdrawals] = useState<Record<number, WithdrawalView>>({})
  const [withdrawalErrors, setWithdrawalErrors] = useState<Record<number, string>>({})

  const [actions, setActions] = useState<Record<string, ActionState>>({})

  const setAction = useCallback((key: string, state: ActionState) => {
    setActions((prev) => ({ ...prev, [key]: state }))
  }, [])

  const refreshConfig = useCallback(async () => {
    if (!configured) return
    setConfigLoading(true)
    setConfigError(null)
    const result = await getTreasuryConfig()
    if (result.status === "success") {
      setConfig(result.result)
    } else {
      setConfigError(result.message)
    }
    setConfigLoading(false)
  }, [configured])

  const refreshWithdrawal = useCallback(
    async (id: number) => {
      const result = await getWithdrawal(id)
      if (result.status === "success") {
        setWithdrawals((prev) => ({ ...prev, [id]: result.result }))
        setWithdrawalErrors((prev) => {
          const next = { ...prev }
          delete next[id]
          return next
        })
      } else {
        setWithdrawalErrors((prev) => ({ ...prev, [id]: result.message }))
      }
    },
    [],
  )

  const refreshAll = useCallback(() => {
    void refreshConfig()
    knownIds.forEach((id) => void refreshWithdrawal(id))
  }, [refreshConfig, refreshWithdrawal, knownIds])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time hydration of persisted state on mount
    setKnownIds(loadKnownIds())
  }, [])

  useEffect(() => {
    if (!configured) return
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data fetch on mount, standard pattern
    void refreshConfig()
  }, [configured, refreshConfig])

  useEffect(() => {
    knownIds.forEach((id) => void refreshWithdrawal(id))
  }, [knownIds, refreshWithdrawal])

  const trackId = useCallback((id: number) => {
    setKnownIds((prev) => {
      if (prev.includes(id)) return prev
      const next = [...prev, id]
      saveKnownIds(next)
      return next
    })
  }, [])

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
        void refreshWithdrawal(id)
      } else {
        setAction(key, { stage: "error", message: result.message })
      }
    },
    [address, signTransaction, setAction, refreshWithdrawal],
  )

  const execute = useCallback(
    async (id: number) => {
      if (!address) return
      const key = `execute-${id}`
      const onStage = (stage: LifecycleStage) => setAction(key, { stage, message: null })
      const result = await executeWithdrawal({ publicKey: address, signTransaction }, id, onStage)
      if (result.status === "success") {
        setAction(key, { stage: "success", message: "Withdrawal executed." })
        void refreshWithdrawal(id)
      } else {
        setAction(key, { stage: "error", message: result.message })
      }
    },
    [address, signTransaction, setAction, refreshWithdrawal],
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
    config,
    configError,
    configLoading,
    withdrawals,
    withdrawalErrors,
    pendingWithdrawals,
    executedWithdrawals,
    actionState,
    propose,
    approve,
    execute,
    trackId,
    refresh: refreshAll,
    currentSigner: address,
  }
}
