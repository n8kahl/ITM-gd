import { AcademySubNav } from '@/components/academy/academy-sub-nav'

export default function AcademyLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="mx-auto w-full max-w-[1480px]">
      <AcademySubNav />
      <div className="px-1 sm:px-2">{children}</div>
    </div>
  )
}
