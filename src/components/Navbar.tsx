'use client'

import Link from 'next/link'
import { Menu } from 'lucide-react'
import WalletButton from '@/components/WalletButton'
import Sidebar from '@/components/Sidebar'
import { navigationLinks } from '@/components/navigation'
import { useState } from 'react'

export default function Navbar() {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <header className="sticky top-0 z-30 border-b border-slate-800 bg-slate-950/90 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="rounded-md p-2 text-slate-200 hover:bg-slate-900 md:hidden"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open navigation menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <Link href="/" className="text-xl font-semibold tracking-tight text-sky-400">
            OrbitPay
          </Link>
        </div>

        <nav className="hidden items-center gap-1 md:flex">
          {navigationLinks.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-md px-3 py-2 text-sm text-slate-300 hover:bg-slate-900 hover:text-slate-100"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <WalletButton />
      </div>

      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
    </header>
  )
}
