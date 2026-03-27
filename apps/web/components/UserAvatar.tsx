import { cn } from '@/lib/utils'

interface UserAvatarProps {
  src?: string | null
  name: string
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  className?: string
}

const SIZES = {
  xs: 'size-5 text-[9px]',
  sm: 'size-7 text-[10px]',
  md: 'size-9 text-xs',
  lg: 'size-12 text-base',
  xl: 'size-20 text-2xl sm:size-16 sm:text-xl',
} as const

export function UserAvatar({ src, name, size = 'md', className }: UserAvatarProps) {
  const initial = (name[0] ?? '?').toUpperCase()
  const sizeClass = SIZES[size]

  if (src) {
    return (
      <img
        src={src}
        alt={name}
        className={cn(
          'shrink-0 rounded-full object-cover',
          sizeClass,
          className
        )}
      />
    )
  }

  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full bg-primary/10 font-semibold text-primary',
        sizeClass,
        className
      )}
    >
      {initial}
    </div>
  )
}
