"use client"

import { createContext, useContext, useMemo, useSyncExternalStore, type ReactNode } from "react"
import {
  getNetworkDetails,
  getPublicKey,
  isAllowed,
  isConnected,
  requestAccess,
} from "@stellar/freighter-api"
import { EXPECTED_NETWORK_PASSPHRASE } from "@/lib/domain"

/**
 * Wallet connection lifecycle (issue #12). Every state a consumer needs to
 * render is represented here explicitly — no combination of booleans that
 * can drift out of sync with each other.
 *
 *   checking      → initial detection in progress (also true during SSR)
 *   not-installed → the Freighter extension was not detected
 *   locked        → installed, but this origin has no prior access grant
 *   connecting    → requestAccess() is in flight (popup open)
 *   denied        → the user declined the access request
 *   wrong-network → connected, but the wallet's network doesn't match
 *                   EXPECTED_NETWORK_PASSPHRASE
 *   connected     → installed, authorized, and on the expected network
 */
export type WalletStatus =
  | "checking"
  | "not-installed"
  | "locked"
  | "connecting"
  | "denied"
  | "wrong-network"
  | "connected"

interface WalletSnapshot {
  status: WalletStatus
  address: string | null
  /** Freighter's raw network name (e.g. "TESTNET", "PUBLIC"), for display. */
  network: string | null
  networkPassphrase: string | null
  error: string | null
}

interface WalletState extends WalletSnapshot {
  /** Derived from `status` — never set independently, so it can't drift. */
  isConnected: boolean
  isFreighterInstalled: boolean
  connect: () => Promise<void>
  disconnect: () => void
}

const NOT_YET_DETECTED_STATUSES: readonly WalletStatus[] = ["checking", "not-installed"]

const INITIAL_SNAPSHOT: WalletSnapshot = {
  status: "checking",
  address: null,
  network: null,
  networkPassphrase: null,
  error: null,
}

/** How long to wait for the extension to inject before giving up. */
const INJECTION_POLL_INTERVAL_MS = 300
const INJECTION_MAX_ATTEMPTS = 6
/** How often to re-check the wallet's network once connected. */
const NETWORK_WATCH_INTERVAL_MS = 5000

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function messageFromError(err: unknown): string {
  if (err instanceof Error) return err.message
  if (typeof err === "string") return err
  return "Something went wrong talking to Freighter."
}

/**
 * The wallet connection is external, mutable state that changes outside of
 * React's render cycle — from user actions inside the Freighter extension
 * itself (unlocking, approving, switching networks). That's exactly what
 * `useSyncExternalStore` is for, so all of the async detection/polling logic
 * lives here as a plain store rather than inside a component effect: it
 * keeps `setState`-on-resolve calls (necessarily asynchronous, since every
 * freighter-api call is a Promise) out of a linted `useEffect` body, and it
 * lets every `useFreighter()` consumer share one underlying subscription
 * instead of each mounting its own detection loop.
 *
 * A factory (rather than a bare module-level singleton) so tests can create
 * an isolated store per test instead of sharing one across the whole suite.
 */
export function createFreighterStore() {
  let snapshot: WalletSnapshot = INITIAL_SNAPSHOT
  const listeners = new Set<() => void>()

  let started = false
  let mounted = false
  let networkWatchTimer: ReturnType<typeof setInterval> | null = null

  function setSnapshot(partial: Partial<WalletSnapshot>) {
    snapshot = { ...snapshot, ...partial }
    for (const listener of listeners) listener()
  }

  function applyNetworkDetails(details: { network: string; networkPassphrase: string }) {
    if (details.networkPassphrase === EXPECTED_NETWORK_PASSPHRASE) {
      setSnapshot({ status: "connected", network: details.network, networkPassphrase: details.networkPassphrase, error: null })
    } else {
      setSnapshot({
        status: "wrong-network",
        network: details.network,
        networkPassphrase: details.networkPassphrase,
        error: `Freighter is connected to ${details.network}. Switch to the expected network to continue.`,
      })
    }
  }

  function stopNetworkWatch() {
    if (networkWatchTimer) {
      clearInterval(networkWatchTimer)
      networkWatchTimer = null
    }
  }

  function startNetworkWatch() {
    if (networkWatchTimer) return
    networkWatchTimer = setInterval(async () => {
      try {
        const details = await getNetworkDetails()
        if (mounted) applyNetworkDetails(details)
      } catch {
        // A transient messaging hiccup isn't a state change on its own;
        // the next tick (or a focus re-check) will retry.
      }
    }, NETWORK_WATCH_INTERVAL_MS)
  }

  /** Polls the (cheap, synchronous) install marker the extension sets on
   * `window.freighter`, to catch it injecting shortly after page load. */
  async function waitForInjection(): Promise<boolean> {
    for (let attempt = 0; attempt < INJECTION_MAX_ATTEMPTS; attempt++) {
      if (typeof window !== "undefined" && window.freighter) return true
      if (attempt < INJECTION_MAX_ATTEMPTS - 1) await sleep(INJECTION_POLL_INTERVAL_MS)
    }
    return false
  }

  // Reading through a function (rather than `snapshot.status` inline) keeps
  // TypeScript from narrowing the status literal type across the `await`s
  // below — `snapshot` can be reassigned by a concurrent connect() call
  // while `detect()` is suspended, so every check here needs a fresh read.
  function isConnecting(): boolean {
    return snapshot.status === "connecting"
  }

  /** Establishes wallet state without prompting: used at start and on focus. */
  async function detect() {
    // Never interfere with an in-flight requestAccess() popup — connect()
    // owns the transition out of "connecting" once it resolves.
    if (isConnecting()) return

    const injected = (typeof window !== "undefined" && !!window.freighter) || (await waitForInjection())
    if (!injected) {
      const reachable = await isConnected().catch(() => false)
      if (!reachable) {
        if (!mounted || isConnecting()) return
        setSnapshot({ status: "not-installed" })
        return
      }
    }

    const allowed = await isAllowed().catch(() => false)
    if (!allowed) {
      if (!mounted || isConnecting()) return
      setSnapshot({ status: "locked" })
      return
    }

    try {
      const key = await getPublicKey()
      const details = await getNetworkDetails()
      if (!mounted || isConnecting()) return
      if (!key) {
        setSnapshot({ status: "locked" })
        return
      }
      setSnapshot({ address: key })
      applyNetworkDetails(details)
      startNetworkWatch()
    } catch (err) {
      if (!mounted || isConnecting()) return
      setSnapshot({ status: "locked", error: messageFromError(err) })
    }
  }

  function onFocus() {
    void detect()
  }

  function start() {
    if (started) return
    started = true
    mounted = true
    void detect()
    if (typeof window !== "undefined") {
      window.addEventListener("focus", onFocus)
      document.addEventListener("visibilitychange", onFocus)
    }
  }

  function stop() {
    started = false
    mounted = false
    stopNetworkWatch()
    if (typeof window !== "undefined") {
      window.removeEventListener("focus", onFocus)
      document.removeEventListener("visibilitychange", onFocus)
    }
  }

  async function connect() {
    setSnapshot({ status: "connecting", error: null })
    try {
      const key = await requestAccess()
      if (!key) {
        setSnapshot({ status: "denied", error: "Connection request was declined. Click Connect to try again." })
        return
      }
      const details = await getNetworkDetails()
      setSnapshot({ address: key })
      applyNetworkDetails(details)
      startNetworkWatch()
    } catch (err) {
      setSnapshot({
        status: "denied",
        error: messageFromError(err) || "Connection request was declined. Click Connect to try again.",
      })
    }
  }

  function disconnect() {
    stopNetworkWatch()
    setSnapshot({ status: "locked", address: null, network: null, networkPassphrase: null, error: null })
  }

  function subscribe(listener: () => void): () => void {
    listeners.add(listener)
    start()
    return () => {
      listeners.delete(listener)
      if (listeners.size === 0) stop()
    }
  }

  function getSnapshot(): WalletSnapshot {
    return snapshot
  }

  function getServerSnapshot(): WalletSnapshot {
    return INITIAL_SNAPSHOT
  }

  return { subscribe, getSnapshot, getServerSnapshot, connect, disconnect }
}

export type FreighterStore = ReturnType<typeof createFreighterStore>

const freighterStore = createFreighterStore()

const FreighterContext = createContext<WalletState>({
  ...INITIAL_SNAPSHOT,
  isConnected: false,
  isFreighterInstalled: false,
  connect: async () => {},
  disconnect: () => {},
})

export function useFreighter() {
  return useContext(FreighterContext)
}

export function FreighterProvider({
  children,
  store = freighterStore,
}: {
  children: ReactNode
  store?: FreighterStore
}) {
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot)

  const value = useMemo<WalletState>(
    () => ({
      ...snapshot,
      isConnected: snapshot.status === "connected",
      isFreighterInstalled: !NOT_YET_DETECTED_STATUSES.includes(snapshot.status),
      connect: store.connect,
      disconnect: store.disconnect,
    }),
    [snapshot, store]
  )

  return <FreighterContext.Provider value={value}>{children}</FreighterContext.Provider>
}
