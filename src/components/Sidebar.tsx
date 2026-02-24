'use client'

import Link from 'next/link'
import { X } from 'lucide-react'
import { navigationLinks } from '@/components/navigation'

type SidebarProps = {
  isOpen: boolean
  onClose: () => void
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  return (
    <>
      {isOpen && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/60 md:hidden"
          onClick={onClose}
          aria-label="Close menu overlay"
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-72 border-r border-slate-800 bg-slate-950 p-6 transition-transform duration-200 md:hidden ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        aria-hidden={!isOpen}
      >
        <div className="mb-8 flex items-center justify-between">
          <span className="text-lg font-semibold text-sky-400">OrbitPay</span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-2 text-slate-200 hover:bg-slate-900"
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <nav className="flex flex-col gap-2">
          {navigationLinks.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              className="rounded-md px-3 py-2 text-sm text-slate-300 hover:bg-slate-900 hover:text-slate-100"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>
    </>
  )
}
