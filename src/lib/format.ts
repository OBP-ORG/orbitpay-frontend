export function formatAmount(amount: bigint | string, decimals = 0): string {
  const num = typeof amount === "string" ? BigInt(amount) : amount
  if (decimals === 0) return num.toString()
  const str = num.toString()
  if (str.length <= decimals) {
    return "0." + "0".repeat(decimals - str.length) + str
  }
  return str.slice(0, -decimals) + "." + str.slice(-decimals)
}

export function formatAddress(address: string, prefix = 6, suffix = 4): string {
  if (address.length <= prefix + suffix) return address
  return `${address.slice(0, prefix)}…${address.slice(-suffix)}`
}

export function formatTimeAgo(timestamp: number): string {
  const diff = Date.now() - timestamp
  if (diff < 1000) return "just now"
  if (diff < 60_000) return `${Math.floor(diff / 1000)}s ago`
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)}m ago`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`
  return `${Math.floor(diff / 86_400_000)}d ago`
}
