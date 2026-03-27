'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Compass, MessageCircle, User, Backpack } from 'lucide-react'

import { cn } from '@/lib/utils'

const NAV_ITEMS = [
  { href: '/discover', label: 'Discover', icon: Compass },
  { href: '/trips', label: 'My Trips', icon: Backpack },
  { href: '/social', label: 'Social', icon: MessageCircle },
  { href: '/profile', label: 'Profile', icon: User },
] as const

export function NavBar() {
  const pathname = usePathname()

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-border/40 bg-background/70 backdrop-blur-xl backdrop-saturate-150">
      <div className="mx-auto flex h-14 w-full items-center justify-between px-4 sm:px-6 lg:max-w-6xl">
        <Link href="/discover" className="flex items-center gap-2">
          <div className="flex size-7 items-center justify-center rounded-lg bg-primary text-xs font-bold text-primary-foreground">
            G
          </div>
          <span className="text-lg font-bold tracking-tight">Groute</span>
        </Link>
        <nav className="flex items-center gap-0.5">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const isActive = pathname.startsWith(href)
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  'relative flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium transition-all duration-200 sm:px-3.5 sm:py-2',
                  isActive
                    ? 'bg-primary/10 text-primary shadow-sm'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground hover:shadow-sm'
                )}
              >
                <Icon className="size-[18px] sm:size-4" />
                <span className="hidden sm:inline">{label}</span>
                {isActive && (
                  <span className="absolute -bottom-[9px] left-1/2 h-0.5 w-6 -translate-x-1/2 rounded-full bg-primary" />
                )}
              </Link>
            )
          })}
        </nav>
      </div>
    </header>
  )
}
