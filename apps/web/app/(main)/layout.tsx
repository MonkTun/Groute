import { NavBar } from '@/components/NavBar'

export default function MainLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-full flex-col">
      <NavBar />
      <main className="flex-1 pt-14">{children}</main>
    </div>
  )
}
