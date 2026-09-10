"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { useFreighter } from "@/contexts/FreighterContext"
import {
  approveWithdrawal,
  checkSufficientBalance,
  checkWithdrawalAuthorization,
  executeWithdrawal,
  getTokenBalance,
  getTreasuryConfig,
  getWithdrawal,
  isAuthorizedSigner,
  isTreasuryConfigured,
  isWithdrawalPolicyStale,
  proposeWithdrawal,
  type TreasuryConfigView,
  type WithdrawalView,
} from "@/lib/soroban/treasury"
import type { LifecycleStage } from "@/lib/soroban/txLifecycle"
import { NATIVE_TOKEN_CONTRACT_ID, TREASURY_CONTRACT_ID } from "@/lib/soroban/config"

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
  let queryClient: ReturnType<typeof useQueryClient> | null = null
  try {
    queryClient = useQueryClient()
  } catch {
    // Gracefully handle harness running without QueryClientProvider
  }
  const configured = isTreasuryConfigured()

  const [config, setConfig] = useState<TreasuryConfigView | null>(null)
  const [configError, setConfigError] = useState<string | null>(null)
  const [configLoading, setConfigLoading] = useState(false)

  /**
   * `get_config` carries no balance field (the contract's real spec — see
   * `treasury.ts` module doc), so the treasury's funds are read live and
   * separately, per asset, straight from that asset's own SEP-41 token
   * contract. Only one asset's balance is tracked here (native XLM, the
   * only asset this UI currently proposes withdrawals in — see
   * `NATIVE_TOKEN_CONTRACT_ID`'s doc) but `refreshBalance`/`getTokenBalance`
   * underneath already take any token contract ID.
   */
  const [balance, setBalance] = useState<bigint | null>(null)
  const [balanceError, setBalanceError] = useState<string | null>(null)
  const [balanceLoading, setBalanceLoading] = useState(false)

  const [knownIds, setKnownIds] = useState<number[]>([])
  const [withdrawals, setWithdrawals] = useState<Record<number, WithdrawalView>>({})
  const [withdrawalErrors, setWithdrawalErrors] = useState<Record<number, string>>({})
  const [actions, setActions] = useState<Record<string, ActionState>>({})

  const setAction = useCallback((key: string, state: ActionState) => {
    setActions((prev) => ({ ...prev, [key]: state }))
  }, [])

  /**
   * A propose/approve/execute result (success or error) belongs to the
   * wallet that signed it. If the connected account changes — the user
   * switches accounts in Freighter — any in-progress or just-finished action
   * banner from the previous account must not linger and read as if it
   * applies to the new one, so this state is cleared on every account
   * change (a signature from account A is never optimistically attributed
   * to account B).
   */
  const prevAddressRef = useRef(address)
  useEffect(() => {
    if (prevAddressRef.current !== address) {
      prevAddressRef.current = address
      setActions({})
    }
  }, [address])

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

  const refreshBalance = useCallback(async (token: string = NATIVE_TOKEN_CONTRACT_ID) => {
    if (!configured) return
    setBalanceLoading(true)
    setBalanceError(null)
    const result = await getTokenBalance(token)
    if (result.status === "success") {
      setBalance(result.result)
    } else {
      setBalanceError(result.message)
    }
    setBalanceLoading(false)
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
    void refreshBalance()
    knownIds.forEach((id) => void refreshWithdrawal(id))
  }, [refreshConfig, refreshBalance, refreshWithdrawal, knownIds])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time hydration of persisted state on mount
    setKnownIds(loadKnownIds())
  }, [])

  useEffect(() => {
    if (!configured) return
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data fetch on mount, standard pattern
    void refreshConfig()
    void refreshBalance()
  }, [configured, refreshConfig, refreshBalance])

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
  }, [setKnownIds])

  /**
   * Authorization (paused / not-a-signer) is checked synchronously against
   * the already-fetched config; sufficiency is checked against a *live*
   * per-token balance read fetched fresh for this specific call, since the
   * asset being withdrawn — and thus the balance that matters — is only
   * known once the caller picks it, and the config carries no balance to
   * fall back on at all (see `treasury.ts` module doc).
   */
  const checkProposalPolicy = useCallback(
    async (token: string, amount: bigint): Promise<string | null> => {
      if (!address) return "Connect a wallet to propose a withdrawal."
      if (config) {
        const authError = checkWithdrawalAuthorization(config, address)
        if (authError) return authError
      }
      const balanceResult = await getTokenBalance(token)
      if (balanceResult.status !== "success") return balanceResult.message
      return checkSufficientBalance(balanceResult.result, amount)
    },
    [address, config],
  )

  const propose = useCallback(
    async (args: { token: string; recipient: string; amount: bigint; memo: string }) => {
      if (!address) return
      const key = "propose"
      const violation = await checkProposalPolicy(args.token, args.amount)
      if (violation) {
        setAction(key, { stage: "error", message: violation })
        return
      }
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
    [address, checkProposalPolicy, signTransaction, setAction, trackId],
  )

  const approve = useCallback(
    async (id: number) => {
      if (!address) return
      const key = `approve-${id}`
      const authError = config && checkWithdrawalAuthorization(config, address)
      if (authError) {
        setAction(key, { stage: "error", message: authError })
        return
      }
      const onStage = (stage: LifecycleStage) => setAction(key, { stage, message: null })
      const result = await approveWithdrawal({ publicKey: address, signTransaction }, id, onStage)
      if (result.status === "success") {
        setAction(key, { stage: "success", message: "Approval recorded." })
        if (queryClient) void queryClient.invalidateQueries({ queryKey: treasuryKeys.withdrawal(address, id) })
        void refreshWithdrawal(id)
      } else {
        setAction(key, { stage: "error", message: result.message })
      }
    },
    [address, config, signTransaction, setAction, refreshWithdrawal],
  )

  const execute = useCallback(
    async (id: number) => {
      if (!address) return
      const key = `execute-${id}`
      const authError = config && checkWithdrawalAuthorization(config, address)
      if (authError) {
        setAction(key, { stage: "error", message: authError })
        return
      }
      const onStage = (stage: LifecycleStage) => setAction(key, { stage, message: null })
      const result = await executeWithdrawal({ publicKey: address, signTransaction }, id, onStage)
      if (result.status === "success") {
        setAction(key, { stage: "success", message: "Withdrawal executed." })
        if (queryClient) {
          void queryClient.invalidateQueries({ queryKey: treasuryKeys.withdrawal(address, id) })
          void queryClient.invalidateQueries({ queryKey: treasuryKeys.config(address) })
        }
      } else {
        setAction(key, { stage: "error", message: result.message })
      }
    },
    [address, config, signTransaction, setAction, refreshWithdrawal],
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

  /** Always evaluated against the withdrawal's own frozen threshold (a chain
   * read), never the treasury's *current* config threshold — see
   * `isWithdrawalPolicyStale` doc for why those can diverge. */
  const isWithdrawalMet = useCallback(
    (w: WithdrawalView) => w.approvals.length >= w.threshold,
    [],
  )

  const isWithdrawalStale = useCallback(
    (w: WithdrawalView) => (config ? isWithdrawalPolicyStale(config, w) : false),
    [config],
  )

  const isSigner = useMemo(
    () => (config && address ? isAuthorizedSigner(config, address) : false),
    [config, address],
  )

  return {
    configured,
    config,
    configError,
    configLoading,
    balance,
    balanceError,
    balanceLoading,
    refreshBalance,
    withdrawals,
    withdrawalErrors,
    pendingWithdrawals,
    executedWithdrawals,
    actionState,
    propose,
    approve,
    execute,
    trackId,
    refresh: () => { refreshAll(); if (queryClient) void queryClient.invalidateQueries({ queryKey: treasuryKeys.all }) },
    currentSigner: address,
    isSigner,
    isWithdrawalMet,
    isWithdrawalStale,
    checkProposalPolicy,
  }
}
