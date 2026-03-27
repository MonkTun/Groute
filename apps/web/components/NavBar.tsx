'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Compass, MessageCircle, Backpack } from 'lucide-react'

import { cn } from '@/lib/utils'

interface NavBarProps {
  avatarUrl?: string | null
}

const NAV_ITEMS = [
  { href: '/discover', label: 'Discover', icon: Compass },
  { href: '/trips', label: 'My Trips', icon: Backpack },
  { href: '/social', label: 'Social', icon: MessageCircle },
] as const

export function NavBar({ avatarUrl }: NavBarProps) {
  const pathname = usePathname()
  const isProfileActive = pathname.startsWith('/profile')

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-border/40 bg-background/70 backdrop-blur-xl backdrop-saturate-150">
      <div className="mx-auto flex h-14 w-full items-center justify-between px-4 sm:px-6 lg:max-w-6xl">
        <Link href="/discover" className="text-lg font-bold tracking-tight">
          Groute
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

          {/* Profile tab — avatar instead of icon */}
          <Link
            href="/profile"
            className={cn(
              'relative flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-sm font-medium transition-all duration-200 sm:px-3 sm:py-1.5',
              isProfileActive
                ? 'bg-primary/10 text-primary shadow-sm'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground hover:shadow-sm'
            )}
          >
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt="Profile"
                className={cn(
                  'size-6 rounded-full object-cover ring-1.5 sm:size-5',
                  isProfileActive ? 'ring-primary' : 'ring-border'
                )}
              />
            ) : (
              <div
                className={cn(
                  'flex size-6 items-center justify-center rounded-full text-[10px] font-bold sm:size-5',
                  isProfileActive
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground'
                )}
              >
                ?
              </div>
            )}
            <span className="hidden sm:inline">Profile</span>
            {isProfileActive && (
              <span className="absolute -bottom-[9px] left-1/2 h-0.5 w-6 -translate-x-1/2 rounded-full bg-primary" />
            )}
          </Link>
        </nav>
      </div>
    </header>
  )
}
