"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  Tag,
  RefreshCw,
  Edit2,
  Save,
  X,
  ExternalLink,
  DollarSign,
  Calendar,
  Check
} from "lucide-react"
import { getAllPricingTiers, updatePricingTier, PricingTier } from "@/lib/supabase"

export default function PackagesPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [tiers, setTiers] = useState<PricingTier[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<Partial<PricingTier>>({})
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  // Check admin access
  useEffect(() => {
    const checkAuth = () => {
      const cookies = document.cookie.split(';')
      const adminCookie = cookies.find(c => c.trim().startsWith('titm_admin='))

      if (!adminCookie || !adminCookie.includes('true')) {
        router.push('/')
      }
    }

    checkAuth()
  }, [router])

  // Load pricing tiers
  const loadData = async () => {
    setLoading(true)
    try {
      const data = await getAllPricingTiers()
      setTiers(data || [])
    } catch (error) {
      console.error('Failed to load pricing tiers:', error)
      showToast('Failed to load pricing tiers', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  // Show toast notification
  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  // Start editing a tier
  const startEdit = (tier: PricingTier) => {
    setEditingId(tier.id)
    setEditForm({
      monthly_price: tier.monthly_price,
      yearly_price: tier.yearly_price,
      monthly_link: tier.monthly_link,
      yearly_link: tier.yearly_link || '',
      is_active: tier.is_active,
    })
  }

  // Cancel editing
  const cancelEdit = () => {
    setEditingId(null)
    setEditForm({})
  }

  // Save changes
  const saveChanges = async (id: string) => {
    setSaving(id)
    try {
      await updatePricingTier(id, {
        monthly_price: editForm.monthly_price,
        yearly_price: editForm.yearly_price,
        monthly_link: editForm.monthly_link,
        yearly_link: editForm.yearly_link || null,
        is_active: editForm.is_active,
      })

      // Update local state
      setTiers(prev => prev.map(tier =>
        tier.id === id
          ? { ...tier, ...editForm, yearly_link: editForm.yearly_link || null }
          : tier
      ))

      showToast('Pricing tier updated successfully', 'success')
      setEditingId(null)
      setEditForm({})
    } catch (error) {
      console.error('Failed to update pricing tier:', error)
      showToast('Failed to update pricing tier', 'error')
    } finally {
      setSaving(null)
    }
  }

  // Truncate URL for display
  const truncateUrl = (url: string | null, maxLength = 40) => {
    if (!url) return '—'
    if (url.length <= maxLength) return url
    return url.substring(0, maxLength) + '...'
  }

  // Tier styling
  const getTierStyle = (id: string) => {
    switch (id) {
      case 'core':
        return { accent: '#10B981', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30' }
      case 'pro':
        return { accent: '#D4AF37', bg: 'bg-amber-500/10', border: 'border-amber-500/30' }
      case 'execute':
        return { accent: '#E8E4D9', bg: 'bg-zinc-400/10', border: 'border-zinc-400/30' }
      default:
        return { accent: '#9CA3AF', bg: 'bg-gray-500/10', border: 'border-gray-500/30' }
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-onyx via-onyx-light to-onyx p-4 md:p-8">
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 ${
          toast.type === 'success'
            ? 'bg-emerald-500/20 border border-emerald-500/30 text-emerald-400'
            : 'bg-red-500/20 border border-red-500/30 text-red-400'
        }`}>
          {toast.type === 'success' ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
          <span className="text-sm font-medium">{toast.message}</span>
        </div>
      )}

      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-champagne flex items-center gap-2">
              <Tag className="w-6 h-6 md:w-8 md:h-8" />
              Package Management
            </h1>
            <p className="text-muted-foreground mt-1">
              Manage pricing tiers and Whop checkout links
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={loadData}
              disabled={loading}
              className="gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push('/admin/analytics')}
            >
              Analytics
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push('/admin/leads')}
            >
              Leads
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                document.cookie = 'titm_admin=; path=/; max-age=0'
                router.push('/')
              }}
            >
              Logout
            </Button>
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-20">
            <RefreshCw className="w-8 h-8 animate-spin text-champagne" />
          </div>
        )}

        {/* Pricing Tiers Grid */}
        {!loading && (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {tiers.map((tier) => {
              const style = getTierStyle(tier.id)
              const isEditing = editingId === tier.id

              return (
                <Card
                  key={tier.id}
                  className={`relative overflow-hidden transition-all duration-300 ${
                    !tier.is_active ? 'opacity-60' : ''
                  } ${isEditing ? 'ring-2 ring-champagne' : ''}`}
                  style={{ borderColor: style.accent + '40' }}
                >
                  {/* Tier Badge */}
                  <div
                    className={`absolute top-0 left-0 right-0 h-1`}
                    style={{ backgroundColor: style.accent }}
                  />

                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg" style={{ color: style.accent }}>
                        {tier.name}
                      </CardTitle>
                      {!isEditing ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => startEdit(tier)}
                          className="h-8 w-8 p-0"
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>
                      ) : (
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={cancelEdit}
                            className="h-8 w-8 p-0 text-red-400 hover:text-red-300"
                          >
                            <X className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => saveChanges(tier.id)}
                            disabled={saving === tier.id}
                            className="h-8 w-8 p-0 text-emerald-400 hover:text-emerald-300"
                          >
                            {saving === tier.id ? (
                              <RefreshCw className="w-4 h-4 animate-spin" />
                            ) : (
                              <Save className="w-4 h-4" />
                            )}
                          </Button>
                        </div>
                      )}
                    </div>
                    <CardDescription className="text-xs">
                      {tier.description}
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="space-y-4">
                    {/* Prices */}
                    <div className="grid grid-cols-2 gap-3">
                      {/* Monthly Price */}
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground flex items-center gap-1">
                          <DollarSign className="w-3 h-3" /> Monthly
                        </Label>
                        {isEditing ? (
                          <Input
                            value={editForm.monthly_price || ''}
                            onChange={(e) => setEditForm({ ...editForm, monthly_price: e.target.value })}
                            placeholder="$199"
                            className="h-8 text-sm"
                          />
                        ) : (
                          <div className="text-lg font-bold" style={{ color: style.accent }}>
                            {tier.monthly_price}
                          </div>
                        )}
                      </div>

                      {/* Yearly Price */}
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground flex items-center gap-1">
                          <Calendar className="w-3 h-3" /> Yearly
                        </Label>
                        {isEditing ? (
                          <Input
                            value={editForm.yearly_price || ''}
                            onChange={(e) => setEditForm({ ...editForm, yearly_price: e.target.value })}
                            placeholder="$1,990"
                            className="h-8 text-sm"
                          />
                        ) : (
                          <div className="text-lg font-bold" style={{ color: style.accent }}>
                            {tier.yearly_price}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Links */}
                    <div className="space-y-3">
                      {/* Monthly Link */}
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Monthly Checkout Link</Label>
                        {isEditing ? (
                          <Input
                            value={editForm.monthly_link || ''}
                            onChange={(e) => setEditForm({ ...editForm, monthly_link: e.target.value })}
                            placeholder="https://whop.com/..."
                            className="h-8 text-xs font-mono"
                          />
                        ) : (
                          <div className="flex items-center gap-2">
                            <code className="text-xs text-muted-foreground font-mono truncate flex-1">
                              {truncateUrl(tier.monthly_link)}
                            </code>
                            {tier.monthly_link && (
                              <a
                                href={tier.monthly_link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-muted-foreground hover:text-champagne"
                              >
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Yearly Link */}
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">
                          Yearly Checkout Link
                          {!tier.yearly_link && !isEditing && (
                            <span className="ml-1 text-amber-500">(not set)</span>
                          )}
                        </Label>
                        {isEditing ? (
                          <Input
                            value={editForm.yearly_link || ''}
                            onChange={(e) => setEditForm({ ...editForm, yearly_link: e.target.value })}
                            placeholder="https://whop.com/..."
                            className="h-8 text-xs font-mono"
                          />
                        ) : (
                          <div className="flex items-center gap-2">
                            <code className="text-xs text-muted-foreground font-mono truncate flex-1">
                              {truncateUrl(tier.yearly_link)}
                            </code>
                            {tier.yearly_link && (
                              <a
                                href={tier.yearly_link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-muted-foreground hover:text-champagne"
                              >
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Active Toggle */}
                    {isEditing && (
                      <div className="flex items-center justify-between pt-2 border-t border-white/10">
                        <Label className="text-xs text-muted-foreground">Active</Label>
                        <Switch
                          checked={editForm.is_active ?? true}
                          onCheckedChange={(checked) => setEditForm({ ...editForm, is_active: checked })}
                        />
                      </div>
                    )}

                    {/* Status Badge */}
                    {!isEditing && (
                      <div className="flex items-center justify-end pt-2 border-t border-white/10">
                        <span className={`text-xs px-2 py-1 rounded-full ${
                          tier.is_active
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : 'bg-red-500/20 text-red-400'
                        }`}>
                          {tier.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}

        {/* Help Text */}
        <Card className="border-champagne/20">
          <CardContent className="py-4">
            <p className="text-sm text-muted-foreground">
              <strong className="text-champagne">How to add yearly links:</strong>{' '}
              Create the annual product in Whop, copy the checkout URL, and paste it here.
              The landing page will automatically use the correct link based on the billing toggle.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
