"use client"

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react"
import {
  isConnected as freighterIsConnected,
  getPublicKey,
  requestAccess,
  getNetworkDetails,
  signTransaction as freighterSignTransaction,
} from "@stellar/freighter-api"
import { SOROBAN_NETWORK_PASSPHRASE } from "@/lib/soroban/config"

/** Matches `contract.ClientOptions["signTransaction"]` from `@stellar/stellar-sdk`. */
export type SignTransaction = (
  tx: string,
  opts?: { network?: string; networkPassphrase?: string; accountToSign?: string },
) => Promise<string>

interface WalletState {
  address: string | null
  isConnected: boolean
  isConnecting: boolean
  isFreighterInstalled: boolean
  /** True once we've checked `getNetworkDetails()` against the expected passphrase and they differ. */
  isWrongNetwork: boolean
  error: string | null
  connect: () => Promise<void>
  disconnect: () => void
  /** Bound to the connected wallet; pass straight through to `contract.Client` options. */
  signTransaction: SignTransaction
}

const NOOP_SIGN: SignTransaction = () => Promise.reject(new Error("No wallet connected"))

const FreighterContext = createContext<WalletState>({
  address: null,
  isConnected: false,
  isConnecting: false,
  isFreighterInstalled: false,
  isWrongNetwork: false,
  error: null,
  connect: async () => {},
  disconnect: () => {},
  signTransaction: NOOP_SIGN,
})

export function useFreighter() {
  return useContext(FreighterContext)
}

export function FreighterProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<string | null>(null)
  const [isConnecting, setIsConnecting] = useState(false)
  const [isFreighterInstalled, setIsFreighterInstalled] = useState(false)
  const [isWrongNetwork, setIsWrongNetwork] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const checkNetwork = useCallback(async () => {
    try {
      const { networkPassphrase } = await getNetworkDetails()
      setIsWrongNetwork(Boolean(networkPassphrase) && networkPassphrase !== SOROBAN_NETWORK_PASSPHRASE)
    } catch {
      // Some wallet states can't report network details up front; don't block on it.
      setIsWrongNetwork(false)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const connected = await freighterIsConnected()
        if (cancelled) return
        setIsFreighterInstalled(connected)
        if (!connected) return

        const key = await getPublicKey()
        if (cancelled) return
        if (key) {
          setAddress(key)
          await checkNetwork()
        }
      } catch {
        // Not installed, or no persisted session — leave state at defaults.
      }
    })()
    return () => {
      cancelled = true
    }
  }, [checkNetwork])

  const connect = useCallback(async () => {
    setIsConnecting(true)
    setError(null)
    try {
      const connected = await freighterIsConnected()
      setIsFreighterInstalled(connected)
      if (!connected) {
        setError("Freighter wallet not installed. Visit freighter.app")
        return
      }

      let key = await getPublicKey()
      if (!key) {
        key = await requestAccess()
      }
      if (!key) {
        setError("Wallet connection was declined")
        return
      }

      setAddress(key)
      await checkNetwork()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to connect wallet")
    } finally {
      setIsConnecting(false)
    }
  }, [checkNetwork])

  const disconnect = useCallback(() => {
    setAddress(null)
    setError(null)
    setIsWrongNetwork(false)
  }, [])

  const signTransaction: SignTransaction = useCallback(
    (tx, opts) =>
      freighterSignTransaction(tx, {
        networkPassphrase: SOROBAN_NETWORK_PASSPHRASE,
        accountToSign: address ?? undefined,
        ...opts,
      }),
    [address],
  )

  return (
    <FreighterContext.Provider
      value={{
        address,
        isConnected: !!address,
        isConnecting,
        isFreighterInstalled,
        isWrongNetwork,
        error,
        connect,
        disconnect,
        signTransaction,
      }}
    >
      {children}
    </FreighterContext.Provider>
  )
}
