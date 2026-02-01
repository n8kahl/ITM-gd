import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import { isAdminUser } from '@/lib/supabase-server'
import { AdminLayoutShell } from '@/components/admin/admin-layout-shell'

/**
 * Admin Layout - Server Component
 *
 * This layout provides server-side authentication verification as a second layer
 * of defense after the middleware. If a user somehow bypasses middleware without
 * admin access, they will see a 404 page.
 *
 * Access is granted if:
 * 1. User has is_admin=true in their JWT app_metadata (set by Discord role sync)
 * 2. User has a valid magic link cookie (backup access method)
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Server-side verification - defense in depth
  const hasAdminAccess = await isAdminUser()

  if (!hasAdminAccess) {
    // Return 404 to not reveal the existence of admin routes
    notFound()
  }

  return (
    <Suspense fallback={null}>
      <AdminLayoutShell>{children}</AdminLayoutShell>
    </Suspense>
  )
}
