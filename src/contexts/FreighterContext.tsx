"use client"

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react"

interface WalletState {
  address: string | null
  isConnected: boolean
  isConnecting: boolean
  isFreighterInstalled: boolean
  error: string | null
  connect: () => Promise<void>
  disconnect: () => void
}

const FreighterContext = createContext<WalletState>({
  address: null,
  isConnected: false,
  isConnecting: false,
  isFreighterInstalled: false,
  error: null,
  connect: async () => {},
  disconnect: () => {},
})

export function useFreighter() {
  return useContext(FreighterContext)
}

export function FreighterProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<string | null>(null)
  const [isConnecting, setIsConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isFreighterInstalled = typeof window !== "undefined" && !!(window as any).freighter

  useEffect(() => {
    if (!isFreighterInstalled) return
    // Check if already connected
    try {
      ;(window as any).freighter
        .getPublicKey()
        .then((key: string) => {
          if (key) setAddress(key)
        })
        .catch(() => {})
    } catch {}
  }, [isFreighterInstalled])

  const connect = useCallback(async () => {
    if (!isFreighterInstalled) {
      setError("Freighter wallet not installed. Visit freighter.app")
      return
    }
    setIsConnecting(true)
    setError(null)
    try {
      const pubKey = await (window as any).freighter.getPublicKey()
      if (pubKey) {
        setAddress(pubKey)
      } else {
        await (window as any).freighter.requestAccess()
        const key = await (window as any).freighter.getPublicKey()
        setAddress(key)
      }
    } catch (e: any) {
      setError(e?.message || "Failed to connect wallet")
    } finally {
      setIsConnecting(false)
    }
  }, [isFreighterInstalled])

  const disconnect = useCallback(() => {
    setAddress(null)
    setError(null)
  }, [])

  return (
    <FreighterContext.Provider
      value={{
        address,
        isConnected: !!address,
        isConnecting,
        isFreighterInstalled,
        error,
        connect,
        disconnect,
      }}
    >
      {children}
    </FreighterContext.Provider>
  )
}
