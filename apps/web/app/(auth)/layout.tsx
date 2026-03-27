export const dynamic = 'force-dynamic'

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-full flex-1 flex-col items-center justify-center px-4 py-8 sm:py-12">
      <div className="mb-8 flex items-center gap-2">
        <div className="flex size-9 items-center justify-center rounded-xl bg-primary text-sm font-bold text-primary-foreground shadow-md">
          G
        </div>
        <span className="text-2xl font-bold tracking-tight">Groute</span>
      </div>
      <div className="w-full max-w-[min(24rem,100%)]">{children}</div>
    </div>
  )
}
