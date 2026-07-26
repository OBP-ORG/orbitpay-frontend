"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useFreighter } from "@/contexts/FreighterContext"
import {
  createProposal,
  executeProposal,
  getGovernanceConfig,
  getProposal,
  isGovernanceConfigured,
  vote,
  type GovernanceConfigView,
  type ProposalView,
} from "@/lib/soroban/governance"
import type { LifecycleStage } from "@/lib/soroban/txLifecycle"
import { GOVERNANCE_CONTRACT_ID } from "@/lib/soroban/config"
import type { ActionState } from "./useTreasury"

const KNOWN_IDS_STORAGE_KEY = `orbitpay:governance:known-proposal-ids:${GOVERNANCE_CONTRACT_ID}`

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

const IDLE_ACTION: ActionState = { stage: null, message: null }

export function useGovernance() {
  const { address, signTransaction } = useFreighter()
  const configured = isGovernanceConfigured()

  const [config, setConfig] = useState<GovernanceConfigView | null>(null)
  const [configError, setConfigError] = useState<string | null>(null)
  const [configLoading, setConfigLoading] = useState(false)

  const [knownIds, setKnownIds] = useState<number[]>([])
  const [proposals, setProposals] = useState<Record<number, ProposalView>>({})
  const [proposalErrors, setProposalErrors] = useState<Record<number, string>>({})

  const [actions, setActions] = useState<Record<string, ActionState>>({})

  const setAction = useCallback((key: string, state: ActionState) => {
    setActions((prev) => ({ ...prev, [key]: state }))
  }, [])

  const refreshConfig = useCallback(async () => {
    if (!configured) return
    setConfigLoading(true)
    setConfigError(null)
    const result = await getGovernanceConfig()
    if (result.status === "success") {
      setConfig(result.result)
    } else {
      setConfigError(result.message)
    }
    setConfigLoading(false)
  }, [configured])

  const refreshProposal = useCallback(async (id: number) => {
    const result = await getProposal(id)
    if (result.status === "success") {
      setProposals((prev) => ({ ...prev, [id]: result.result }))
      setProposalErrors((prev) => {
        const next = { ...prev }
        delete next[id]
        return next
      })
    } else {
      setProposalErrors((prev) => ({ ...prev, [id]: result.message }))
    }
  }, [])

  const refreshAll = useCallback(() => {
    void refreshConfig()
    knownIds.forEach((id) => void refreshProposal(id))
  }, [refreshConfig, refreshProposal, knownIds])

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
    knownIds.forEach((id) => void refreshProposal(id))
  }, [knownIds, refreshProposal])

  const trackId = useCallback((id: number) => {
    setKnownIds((prev) => {
      if (prev.includes(id)) return prev
      const next = [...prev, id]
      saveKnownIds(next)
      return next
    })
  }, [])

  const propose = useCallback(
    async (args: {
      title: string
      description: string
      action: ProposalView["action"]
      amount: bigint | null
      recipient: string | null
    }) => {
      if (!address) return
      const key = "propose"
      const onStage = (stage: LifecycleStage) => setAction(key, { stage, message: null })
      const result = await createProposal({ publicKey: address, signTransaction }, args, onStage)
      if (result.status === "success") {
        setAction(key, { stage: "success", message: `Proposal #${result.result} created.` })
        trackId(result.result)
      } else {
        setAction(key, { stage: "error", message: result.message })
      }
    },
    [address, signTransaction, setAction, trackId],
  )

  const castVote = useCallback(
    async (id: number, support: boolean) => {
      if (!address) return
      const key = `vote-${id}`
      const onStage = (stage: LifecycleStage) => setAction(key, { stage, message: null })
      const result = await vote({ publicKey: address, signTransaction }, id, support, onStage)
      if (result.status === "success") {
        setAction(key, { stage: "success", message: "Vote recorded." })
        void refreshProposal(id)
      } else {
        setAction(key, { stage: "error", message: result.message })
      }
    },
    [address, signTransaction, setAction, refreshProposal],
  )

  const execute = useCallback(
    async (id: number) => {
      if (!address) return
      const key = `execute-${id}`
      const onStage = (stage: LifecycleStage) => setAction(key, { stage, message: null })
      const result = await executeProposal({ publicKey: address, signTransaction }, id, onStage)
      if (result.status === "success") {
        setAction(key, { stage: "success", message: "Proposal executed." })
        void refreshProposal(id)
      } else {
        setAction(key, { stage: "error", message: result.message })
      }
    },
    [address, signTransaction, setAction, refreshProposal],
  )

  const actionState = useCallback((key: string): ActionState => actions[key] ?? IDLE_ACTION, [actions])

  const activeProposals = useMemo(
    () => knownIds.map((id) => proposals[id]).filter((p): p is ProposalView => !!p && !p.executed),
    [knownIds, proposals],
  )
  const pastProposals = useMemo(
    () => knownIds.map((id) => proposals[id]).filter((p): p is ProposalView => !!p && p.executed),
    [knownIds, proposals],
  )

  return {
    configured,
    config,
    configError,
    configLoading,
    proposals,
    proposalErrors,
    activeProposals,
    pastProposals,
    actionState,
    propose,
    castVote,
    execute,
    trackId,
    refresh: refreshAll,
    currentSigner: address,
  }
}
