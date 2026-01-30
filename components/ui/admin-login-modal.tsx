"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Lock } from "lucide-react"
import { useRouter } from "next/navigation"

interface AdminLoginModalProps {
  isOpen: boolean
  onClose: () => void
}

const ADMIN_PASSWORD = "billions"

export function AdminLoginModal({ isOpen, onClose }: AdminLoginModalProps) {
  const [password, setPassword] = useState("")
  const [error, setError] = useState(false)
  const [isShaking, setIsShaking] = useState(false)
  const router = useRouter()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (password === ADMIN_PASSWORD) {
      // Set admin session cookie
      document.cookie = `titm_admin=true; path=/; max-age=${60 * 60 * 24}` // 24 hours

      // Navigate to analytics dashboard
      router.push("/admin/analytics")
      onClose()
      setPassword("")
      setError(false)
    } else {
      // Show error and shake animation
      setError(true)
      setIsShaking(true)

      setTimeout(() => setIsShaking(false), 500)
      setTimeout(() => setError(false), 2000)

      setPassword("")
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        className={`
          glass-card-heavy border-champagne/30 max-w-md
          ${isShaking ? 'animate-shake' : ''}
        `}
      >
        <DialogHeader>
          <div className="flex items-center justify-center mb-4">
            <div className="h-16 w-16 rounded-full bg-gradient-to-br from-champagne/20 to-wealth-emerald/20 flex items-center justify-center">
              <Lock className="h-8 w-8 text-champagne" />
            </div>
          </div>
          <DialogTitle className="text-2xl text-center">Admin Access</DialogTitle>
          <DialogDescription className="text-center text-muted-foreground">
            Enter the access code to view analytics
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div>
            <Input
              type="password"
              placeholder="Enter access code"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={`
                text-center text-lg tracking-widest
                ${error ? 'border-red-500 focus-visible:ring-red-500' : 'border-champagne/30'}
              `}
              autoFocus
            />
            {error && (
              <p className="text-red-400 text-sm text-center mt-2 animate-pulse">
                ❌ Incorrect access code
              </p>
            )}
          </div>

          <Button
            type="submit"
            variant="luxury-champagne"
            className="w-full"
            size="lg"
          >
            Access Dashboard
          </Button>
        </form>

        <style jsx>{`
          @keyframes shake {
            0%, 100% { transform: translateX(0); }
            10%, 30%, 50%, 70%, 90% { transform: translateX(-10px); }
            20%, 40%, 60%, 80% { transform: translateX(10px); }
          }

          .animate-shake {
            animation: shake 0.5s;
          }
        `}</style>
      </DialogContent>
    </Dialog>
  )
}
