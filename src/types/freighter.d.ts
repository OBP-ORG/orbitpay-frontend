export {}

declare global {
  interface Window {
    /**
     * Set to `true` by the Freighter extension's content script once it has
     * injected into the page. Used only as a fast, synchronous "is it
     * installed" signal — all actual wallet operations go through the typed
     * `@stellar/freighter-api` functions, never direct calls on this object.
     */
    freighter?: boolean
  }
}
