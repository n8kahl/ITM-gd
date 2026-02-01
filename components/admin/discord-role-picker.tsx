'use client'

import { useEffect, useState, useRef } from 'react'
import { Check, ChevronsUpDown, Loader2, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

interface DiscordRole {
  id: string
  name: string
  color: number
}

interface DiscordRolePickerProps {
  value: string
  onChange: (roleId: string, roleName: string) => void
  disabled?: boolean
}

export function DiscordRolePicker({ value, onChange, disabled }: DiscordRolePickerProps) {
  const [open, setOpen] = useState(false)
  const [roles, setRoles] = useState<DiscordRole[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const dropdownRef = useRef<HTMLDivElement>(null)

  const fetchRoles = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/discord/roles')
      const data = await res.json()
      if (data.success) {
        setRoles(data.roles)
      } else {
        setError(data.error)
      }
    } catch (e) {
      setError('Failed to load roles')
    } finally {
      setLoading(false)
    }
  }

  // Load on first open
  useEffect(() => {
    if (open && roles.length === 0) {
      fetchRoles()
    }
  }, [open])

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    if (open) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [open])

  const selectedRole = roles.find((role) => role.id === value)
  const filteredRoles = roles.filter(role =>
    role.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="relative" ref={dropdownRef}>
      <Button
        type="button"
        variant="outline"
        role="combobox"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen(!open)}
        className="w-full justify-between bg-white/5 border-white/10 text-white hover:bg-white/10"
      >
        {value ? (
          <div className="flex items-center gap-2">
            {selectedRole && (
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: selectedRole.color ? `#${selectedRole.color.toString(16).padStart(6, '0')}` : '#99aab5' }}
              />
            )}
            {selectedRole ? selectedRole.name : value}
          </div>
        ) : (
          <span className="text-white/40">Select a Discord Role...</span>
        )}
        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
      </Button>

      {open && (
        <div className="absolute z-50 w-full mt-1 bg-[#0a0a0b] border border-white/10 rounded-md shadow-lg overflow-hidden">
          <div className="p-2 border-b border-white/10">
            <input
              type="text"
              placeholder="Search roles..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-white/5 border border-white/10 rounded-md text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-white/20"
            />
          </div>

          <div className="max-h-[300px] overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center p-4 text-white/50">
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                Fetching from Discord...
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center p-4 text-red-400">
                <span className="text-xs mb-2">{error}</span>
                <Button size="sm" variant="ghost" onClick={fetchRoles}>
                  Retry
                </Button>
              </div>
            ) : filteredRoles.length === 0 ? (
              <div className="p-4 text-center text-white/40 text-sm">
                No role found.
              </div>
            ) : (
              <div>
                {filteredRoles.map((role) => (
                  <button
                    key={role.id}
                    type="button"
                    onClick={() => {
                      onChange(role.id, role.name)
                      setOpen(false)
                      setSearchTerm('')
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-white hover:bg-white/10 transition-colors"
                  >
                    <span
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: role.color ? `#${role.color.toString(16).padStart(6, '0')}` : '#99aab5' }}
                    />
                    <span className="truncate flex-1 text-left">{role.name}</span>
                    <Check
                      className={cn(
                        "h-4 w-4",
                        value === role.id ? "opacity-100" : "opacity-0"
                      )}
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="p-1 border-t border-white/10 bg-[#0F0F10]">
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault()
                fetchRoles()
              }}
              className="w-full flex items-center justify-center gap-2 p-2 text-xs text-white/40 hover:text-white transition-colors"
            >
              <RefreshCw className={cn("w-3 h-3", loading && "animate-spin")} />
              Sync from Discord
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
