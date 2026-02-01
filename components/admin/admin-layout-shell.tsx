'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { Bell, Menu, X, Search, Command } from 'lucide-react'
import { AdminSidebar } from '@/components/admin/admin-sidebar'
import { cn } from '@/lib/utils'

interface AdminLayoutShellProps {
  children: React.ReactNode
}

export function AdminLayoutShell({ children }: AdminLayoutShellProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  // Close mobile menu on route change
  useEffect(() => setMobileMenuOpen(false), [pathname])

  const handleLogout = async () => {
    try {
      await fetch('/api/admin/logout', { method: 'POST' })
      router.push('/')
    } catch (error) {
      console.error('Logout error:', error)
      router.push('/')
    }
  }

  return (
    <div className="flex h-screen w-full bg-[#050505] text-ivory overflow-hidden">
      {/* 1. Desktop Sidebar (Fixed) */}
      <aside className="hidden lg:flex w-72 flex-col border-r border-white/5 bg-[#0A0A0B]/95 backdrop-blur-xl relative z-20">
        <AdminSidebar />
      </aside>

      {/* 2. Mobile Sidebar (Drawer) */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="absolute left-0 top-0 bottom-0 w-72 bg-[#0A0A0B] border-r border-white/10 shadow-2xl transform transition-transform duration-300">
            <div className="flex justify-end p-4">
              <button onClick={() => setMobileMenuOpen(false)} className="text-white/40 hover:text-white">
                <X className="w-6 h-6" />
              </button>
            </div>
            <AdminSidebar />
          </div>
        </div>
      )}

      {/* 3. Main Application Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-gradient-to-br from-[#050505] to-[#0A0A0B]">

        {/* Header - Fixed Height */}
        <header className="h-16 flex-none border-b border-white/5 px-6 flex items-center justify-between bg-[#0A0A0B]/50 backdrop-blur-md z-10">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 -ml-2 text-white/60 hover:text-white"
            >
              <Menu className="w-6 h-6" />
            </button>

            {/* Breadcrumb / Page Title */}
            <div className="flex items-center gap-2">
              <span className="text-white/40 font-mono text-xs uppercase tracking-widest hidden sm:inline">Admin /</span>
              <h1 className="text-lg font-semibold text-white tracking-tight">
                {pathname === '/admin' ? 'Command Center' :
                 pathname.split('/').pop()?.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-4">
             {/* Global Search Mockup */}
             <div className="hidden md:flex items-center px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-white/40 w-64 hover:border-white/20 transition-colors cursor-pointer">
                <Search className="w-3.5 h-3.5 mr-2" />
                <span>Search...</span>
                <span className="ml-auto flex items-center gap-1">
                  <Command className="w-3 h-3" />
                  <span>K</span>
                </span>
             </div>

             {/* Actions */}
             <button className="relative p-2 text-white/40 hover:text-emerald-500 transition-colors">
               <Bell className="w-5 h-5" />
               <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full animate-pulse" />
             </button>

             <div className="h-8 w-[1px] bg-white/10 mx-1" />

             <button
               onClick={handleLogout}
               className="text-xs font-medium text-white/60 hover:text-white px-3 py-1.5 rounded-md hover:bg-white/5 transition-all"
             >
               Exit
             </button>
          </div>
        </header>

        {/* Content - Scrollable Viewport */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden p-6 lg:p-8 scroll-smooth admin-content-area relative">
          {/* Subtle Grid Background */}
          <div className="absolute inset-0 pointer-events-none opacity-[0.02] bg-[url('/grid-pattern.svg')] bg-center [mask-image:linear-gradient(to_bottom,transparent,black)]" />

          <div className="max-w-7xl mx-auto space-y-8 relative z-10">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
