"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Menu, Send, Wallet, LogOut, ExternalLink } from "lucide-react"
import { useFreighter } from "@/contexts/FreighterContext"

const navLinks = [
  { label: "Dashboard", href: "/" },
  { label: "Treasury", href: "/treasury" },
  { label: "Payroll", href: "/payroll" },
  { label: "Vesting", href: "/vesting" },
  { label: "Governance", href: "/governance" },
]

function formatAddress(addr: string) {
  return `${addr.slice(0, 4)}...${addr.slice(-4)}`
}

export default function Navbar() {
  const pathname = usePathname()
  const { address, isConnected, isConnecting, isFreighterInstalled, error, connect, disconnect } = useFreighter()

  const walletButton = () => {
    if (!isFreighterInstalled) {
      return (
        <Button size="sm" variant="outline" render={<a href="https://freighter.app" target="_blank" rel="noopener noreferrer" />} nativeButton={false}>
          <ExternalLink data-icon="inline-start" />
          Install Freighter
        </Button>
      )
    }
    if (isConnecting) {
      return <Button size="sm" disabled>Connecting...</Button>
    }
    if (isConnected && address) {
      return (
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="font-mono text-xs">{formatAddress(address)}</Badge>
          <Button size="sm" variant="ghost" onClick={disconnect}>
            <LogOut data-icon="inline-start" />
          </Button>
        </div>
      )
    }
    return (
      <Button size="sm" onClick={connect}>
        <Wallet data-icon="inline-start" />
        Connect Wallet
      </Button>
    )
  }

  return (
    <nav className="fixed inset-x-0 top-0 z-20 w-full border-b bg-background/95 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-6">
        <Link href="/" className="flex shrink-0 items-center gap-2">
          <div className="flex size-7 items-center justify-center rounded-lg bg-primary">
            <Send className="text-primary-foreground" size={14} />
          </div>
          <span className="text-lg font-semibold tracking-tight">OrbitPay</span>
        </Link>

        <div className="hidden items-center gap-1 md:flex">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                pathname === link.href
                  ? "text-foreground bg-muted"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </div>

        <div className="hidden items-center gap-2 md:flex">
          {walletButton()}
        </div>

        <Sheet>
          <SheetTrigger className="md:hidden">
            <Button variant="ghost" size="icon"><Menu /></Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-72 pt-12">
            <SheetHeader><SheetTitle>OrbitPay</SheetTitle></SheetHeader>
            <div className="mt-6 flex flex-col gap-2">
              {navLinks.map((link) => (
                <Link key={link.href} href={link.href} className={`rounded-lg px-3 py-2 text-sm font-medium ${
                  pathname === link.href ? "text-foreground bg-muted" : "text-muted-foreground"
                }`}>{link.label}</Link>
              ))}
            </div>
            <div className="mt-6 flex flex-col gap-2 border-t pt-4">
              {walletButton()}
              {error && <p className="text-destructive text-xs">{error}</p>}
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </nav>
  )
}
