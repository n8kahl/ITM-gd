'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  List,
  Plus,
  X,
  Loader2,
  Trash2,
  CandlestickChart,
  Check,
  Pencil,
  ChevronDown,
  Star,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useMemberAuth } from '@/contexts/MemberAuthContext'
import { motion, AnimatePresence } from 'framer-motion'
import { SymbolSearch } from './symbol-search'
import {
  getWatchlists,
  createWatchlist,
  updateWatchlist,
  deleteWatchlist,
  AICoachAPIError,
  type Watchlist,
} from '@/lib/api/ai-coach'

// ============================================
// TYPES
// ============================================

interface WatchlistPanelProps {
  onClose: () => void
  onNavigateChart?: (symbol: string) => void
}

const PRESSABLE_PROPS = {
  whileHover: { y: -1 },
  whileTap: { scale: 0.98 },
}

// ============================================
// COMPONENT
// ============================================

export function WatchlistPanel({ onClose, onNavigateChart }: WatchlistPanelProps) {
  const { session } = useMemberAuth()
  const token = session?.access_token

  const [watchlists, setWatchlists] = useState<Watchlist[]>([])
  const [activeWatchlistId, setActiveWatchlistId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [newListName, setNewListName] = useState('')
  const [editingName, setEditingName] = useState<string | null>(null)
  const [editNameValue, setEditNameValue] = useState('')
  const [showSelector, setShowSelector] = useState(false)
  const [symbolSearchValue, setSymbolSearchValue] = useState('')

  const editInputRef = useRef<HTMLInputElement>(null)
  const createInputRef = useRef<HTMLInputElement>(null)

  const activeWatchlist = watchlists.find((w) => w.id === activeWatchlistId) ?? watchlists[0] ?? null

  // Fetch watchlists on mount
  const fetchWatchlists = useCallback(async () => {
    if (!token) return
    setIsLoading(true)
    setError(null)

    try {
      const data = await getWatchlists(token)
      setWatchlists(data.watchlists)
      if (!activeWatchlistId && data.watchlists.length > 0) {
        const defaultList = data.defaultWatchlist ?? data.watchlists[0]
        setActiveWatchlistId(defaultList.id)
      }
    } catch (err) {
      const message = err instanceof AICoachAPIError
        ? err.apiError.message
        : 'Failed to load watchlists'
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }, [token, activeWatchlistId])

  useEffect(() => {
    fetchWatchlists()
  }, [fetchWatchlists])

  // Add symbol to active watchlist
  const handleAddSymbol = useCallback(async (symbol: string) => {
    if (!token || !activeWatchlist) return
    if (activeWatchlist.symbols.includes(symbol)) {
      setSymbolSearchValue('')
      return
    }

    setIsSaving(true)
    try {
      const result = await updateWatchlist(activeWatchlist.id, token, {
        symbols: [...activeWatchlist.symbols, symbol],
      })
      setWatchlists(result.watchlists)
      setSymbolSearchValue('')
    } catch (err) {
      const message = err instanceof AICoachAPIError
        ? err.apiError.message
        : 'Failed to add symbol'
      setError(message)
    } finally {
      setIsSaving(false)
    }
  }, [token, activeWatchlist])

  // Remove symbol from active watchlist
  const handleRemoveSymbol = useCallback(async (symbol: string) => {
    if (!token || !activeWatchlist) return

    setIsSaving(true)
    try {
      const result = await updateWatchlist(activeWatchlist.id, token, {
        symbols: activeWatchlist.symbols.filter((s) => s !== symbol),
      })
      setWatchlists(result.watchlists)
    } catch (err) {
      const message = err instanceof AICoachAPIError
        ? err.apiError.message
        : 'Failed to remove symbol'
      setError(message)
    } finally {
      setIsSaving(false)
    }
  }, [token, activeWatchlist])

  // Create new watchlist
  const handleCreateWatchlist = useCallback(async () => {
    if (!token || !newListName.trim()) return

    setIsSaving(true)
    try {
      const result = await createWatchlist(token, {
        name: newListName.trim(),
        symbols: [],
      })
      setWatchlists(result.watchlists)
      setActiveWatchlistId(result.watchlist.id)
      setNewListName('')
      setShowCreateForm(false)
    } catch (err) {
      const message = err instanceof AICoachAPIError
        ? err.apiError.message
        : 'Failed to create watchlist'
      setError(message)
    } finally {
      setIsSaving(false)
    }
  }, [token, newListName])

  // Rename watchlist
  const handleRenameWatchlist = useCallback(async () => {
    if (!token || !editingName || !editNameValue.trim()) {
      setEditingName(null)
      return
    }

    setIsSaving(true)
    try {
      const result = await updateWatchlist(editingName, token, {
        name: editNameValue.trim(),
      })
      setWatchlists(result.watchlists)
      setEditingName(null)
    } catch (err) {
      const message = err instanceof AICoachAPIError
        ? err.apiError.message
        : 'Failed to rename watchlist'
      setError(message)
    } finally {
      setIsSaving(false)
    }
  }, [token, editingName, editNameValue])

  // Delete watchlist
  const handleDeleteWatchlist = useCallback(async (id: string) => {
    if (!token) return

    setIsSaving(true)
    try {
      const result = await deleteWatchlist(id, token)
      setWatchlists(result.watchlists)
      if (activeWatchlistId === id) {
        setActiveWatchlistId(result.defaultWatchlist?.id ?? result.watchlists[0]?.id ?? null)
      }
    } catch (err) {
      const message = err instanceof AICoachAPIError
        ? err.apiError.message
        : 'Failed to delete watchlist'
      setError(message)
    } finally {
      setIsSaving(false)
    }
  }, [token, activeWatchlistId])

  useEffect(() => {
    if (editingName && editInputRef.current) {
      editInputRef.current.focus()
      editInputRef.current.select()
    }
  }, [editingName])

  useEffect(() => {
    if (showCreateForm && createInputRef.current) {
      createInputRef.current.focus()
    }
  }, [showCreateForm])

  // ============================================
  // RENDER
  // ============================================

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="border-b border-white/5 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <List className="w-4 h-4 text-emerald-500" />
            <h2 className="text-sm font-medium text-white">Watchlists</h2>
            {activeWatchlist && (
              <span className="text-[10px] text-white/30 px-1.5 py-0.5 rounded bg-white/5">
                {activeWatchlist.symbols.length} symbols
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <motion.button
              type="button"
              onClick={() => setShowCreateForm(true)}
              className="inline-flex items-center gap-1 rounded border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-[11px] text-emerald-300 transition-colors hover:bg-emerald-500/15"
              {...PRESSABLE_PROPS}
            >
              <Plus className="w-3 h-3" />
              New List
            </motion.button>
          </div>
        </div>

        {/* Watchlist selector */}
        {watchlists.length > 1 && (
          <div className="mt-2 relative">
            <button
              type="button"
              onClick={() => setShowSelector(!showSelector)}
              className="w-full flex items-center justify-between rounded-md border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs text-white/75 hover:bg-white/8 transition-colors"
            >
              <span className="flex items-center gap-1.5">
                {activeWatchlist?.is_default && <Star className="w-3 h-3 text-amber-300 fill-amber-300" />}
                {activeWatchlist?.name ?? 'Select watchlist'}
              </span>
              <ChevronDown className={cn('w-3.5 h-3.5 text-white/35 transition-transform', showSelector && 'rotate-180')} />
            </button>

            <AnimatePresence>
              {showSelector && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.15 }}
                  className="absolute z-40 mt-1 w-full rounded-md border border-white/10 bg-[#0b0f14] shadow-xl"
                >
                  {watchlists.map((wl) => (
                    <button
                      key={wl.id}
                      type="button"
                      onClick={() => {
                        setActiveWatchlistId(wl.id)
                        setShowSelector(false)
                      }}
                      className={cn(
                        'w-full flex items-center justify-between px-3 py-2 text-xs transition-colors hover:bg-white/10',
                        wl.id === activeWatchlistId ? 'text-emerald-300 bg-emerald-500/10' : 'text-white/65'
                      )}
                    >
                      <span className="flex items-center gap-1.5">
                        {wl.is_default && <Star className="w-3 h-3 text-amber-300 fill-amber-300" />}
                        {wl.name}
                        <span className="text-white/30">({wl.symbols.length})</span>
                      </span>
                      {!wl.is_default && (
                        <span
                          className="p-1 rounded hover:bg-red-500/20 text-white/30 hover:text-red-300"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDeleteWatchlist(wl.id)
                          }}
                        >
                          <Trash2 className="w-3 h-3" />
                        </span>
                      )}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* Create watchlist form */}
        <AnimatePresence>
          {showCreateForm && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.15 }}
              className="overflow-hidden"
            >
              <div className="mt-2 flex items-center gap-2">
                <input
                  ref={createInputRef}
                  value={newListName}
                  onChange={(e) => setNewListName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleCreateWatchlist()
                    if (e.key === 'Escape') { setShowCreateForm(false); setNewListName('') }
                  }}
                  placeholder="Watchlist name..."
                  className="flex-1 h-8 rounded-md border border-white/10 bg-white/5 px-2.5 text-xs text-white placeholder:text-white/35 focus:border-emerald-500/40 focus:outline-none"
                />
                <motion.button
                  type="button"
                  onClick={handleCreateWatchlist}
                  disabled={!newListName.trim() || isSaving}
                  className="h-8 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 text-xs text-emerald-300 transition-colors hover:bg-emerald-500/15 disabled:opacity-50"
                  {...PRESSABLE_PROPS}
                >
                  {isSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                </motion.button>
                <motion.button
                  type="button"
                  onClick={() => { setShowCreateForm(false); setNewListName('') }}
                  className="h-8 rounded-md border border-white/10 bg-white/5 px-2 text-xs text-white/45 transition-colors hover:text-white/65"
                  {...PRESSABLE_PROPS}
                >
                  <X className="w-3 h-3" />
                </motion.button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Add symbol search */}
      {activeWatchlist && !isLoading && (
        <div className="border-b border-white/5 px-4 py-2">
          <SymbolSearch
            value={symbolSearchValue}
            onChange={handleAddSymbol}
            className="w-full"
          />
          {isSaving && (
            <p className="mt-1 text-[10px] text-white/35 flex items-center gap-1">
              <Loader2 className="w-3 h-3 animate-spin" /> Saving...
            </p>
          )}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <Loader2 className="w-5 h-5 text-emerald-500 animate-spin mx-auto mb-2" />
              <p className="text-xs text-white/45">Loading watchlists...</p>
            </div>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <p className="text-sm text-red-400 mb-2">{error}</p>
              <button
                onClick={() => { setError(null); fetchWatchlists() }}
                className="text-xs text-emerald-500 hover:text-emerald-400 transition-colors"
              >
                Retry
              </button>
            </div>
          </div>
        ) : !activeWatchlist ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center px-6">
              <List className="w-8 h-8 text-white/20 mx-auto mb-3" />
              <p className="text-sm text-white/45 mb-2">No watchlists yet</p>
              <motion.button
                type="button"
                onClick={() => setShowCreateForm(true)}
                className="inline-flex items-center gap-1.5 rounded border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs text-emerald-300 transition-colors hover:bg-emerald-500/15"
                {...PRESSABLE_PROPS}
              >
                <Plus className="w-3.5 h-3.5" />
                Create Your First Watchlist
              </motion.button>
            </div>
          </div>
        ) : activeWatchlist.symbols.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center px-6">
              <List className="w-8 h-8 text-white/20 mx-auto mb-3" />
              <p className="text-sm text-white/45 mb-1">No symbols in this watchlist</p>
              <p className="text-xs text-white/30">Use the search above to add tickers</p>
            </div>
          </div>
        ) : (
          <div className="p-2">
            {/* Watchlist name with inline edit */}
            <div className="px-2 py-1.5 mb-1 flex items-center justify-between">
              {editingName === activeWatchlist.id ? (
                <div className="flex items-center gap-1.5 flex-1">
                  <input
                    ref={editInputRef}
                    value={editNameValue}
                    onChange={(e) => setEditNameValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleRenameWatchlist()
                      if (e.key === 'Escape') setEditingName(null)
                    }}
                    onBlur={handleRenameWatchlist}
                    className="flex-1 h-6 rounded border border-emerald-500/40 bg-white/5 px-2 text-xs text-white focus:outline-none"
                  />
                </div>
              ) : (
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-medium text-white/60">{activeWatchlist.name}</span>
                  {activeWatchlist.is_default && (
                    <Star className="w-3 h-3 text-amber-300 fill-amber-300" />
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setEditingName(activeWatchlist.id)
                      setEditNameValue(activeWatchlist.name)
                    }}
                    className="p-0.5 rounded text-white/25 hover:text-white/50 transition-colors"
                  >
                    <Pencil className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>

            {/* Symbol list */}
            <div className="space-y-0.5">
              {activeWatchlist.symbols.map((symbol) => (
                <motion.div
                  key={symbol}
                  layout
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 8 }}
                  className="group flex items-center justify-between rounded-lg px-3 py-2.5 transition-colors hover:bg-white/5"
                >
                  <button
                    type="button"
                    onClick={() => onNavigateChart?.(symbol)}
                    className="flex items-center gap-2.5 text-left min-w-0 flex-1"
                  >
                    <div className="w-7 h-7 rounded-md bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
                      <CandlestickChart className="w-3.5 h-3.5 text-emerald-500" />
                    </div>
                    <span className="text-sm font-medium text-white group-hover:text-emerald-300 transition-colors">
                      {symbol}
                    </span>
                  </button>

                  <motion.button
                    type="button"
                    onClick={() => handleRemoveSymbol(symbol)}
                    className="p-1.5 rounded-md text-white/20 hover:text-red-300 hover:bg-red-500/10 transition-colors opacity-0 group-hover:opacity-100"
                    aria-label={`Remove ${symbol} from watchlist`}
                    {...PRESSABLE_PROPS}
                  >
                    <X className="w-3.5 h-3.5" />
                  </motion.button>
                </motion.div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
