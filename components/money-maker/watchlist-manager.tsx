import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Plus, X, Search, Settings2 } from 'lucide-react'
import { useMoneyMaker } from './money-maker-provider'
import { useMemberSession } from '@/contexts/MemberAuthContext'

const WATCHLIST_ENDPOINT = '/api/members/money-maker/watchlist'
const SYMBOL_REGEX = /^[A-Z0-9._:-]{1,10}$/

export function WatchlistManager() {
    const { session } = useMemberSession()
    const { state, setSymbols } = useMoneyMaker()
    const { symbols } = state
    const [isOpen, setIsOpen] = useState(false)
    const [newSymbol, setNewSymbol] = useState('')

    const handleSave = async (updatedSymbols: string[]) => {
        const previousSymbols = symbols
        setSymbols(updatedSymbols)

        if (!session?.access_token) return

        try {
            const response = await fetch(WATCHLIST_ENDPOINT, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${session.access_token}`
                },
                body: JSON.stringify({ symbols: updatedSymbols })
            })

            if (!response.ok) {
                throw new Error('Failed to save watchlist')
            }
        } catch (err) {
            setSymbols(previousSymbols)
            console.error('Failed to save watchlist:', err)
        }
    }

    const addSymbol = () => {
        const clean = newSymbol.trim().toUpperCase()
        if (!clean) return
        if (symbols.length >= 5) {
            alert('Maximum 5 symbols allowed')
            return
        }
        if (!SYMBOL_REGEX.test(clean)) {
            alert('Enter a valid ticker symbol')
            return
        }
        if (symbols.includes(clean)) {
            setNewSymbol('')
            return
        }
        handleSave([...symbols, clean])
        setNewSymbol('')
    }

    const removeSymbol = (sym: string) => {
        handleSave(symbols.filter(s => s !== sym))
    }

    return (
        <div className="relative">
            <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => setIsOpen(!isOpen)}
            >
                <Settings2 className="h-4 w-4" />
                Watchlist ({symbols.length}/5)
            </Button>

            {isOpen && (
                <div className="absolute right-0 top-full mt-2 w-72 rounded-xl border border-white/10 bg-[#0A0A0B]/95 p-4 shadow-xl backdrop-blur-xl z-50">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="font-semibold text-white">Manage Watchlist</h3>
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setIsOpen(false)}>
                            <X className="h-4 w-4" />
                        </Button>
                    </div>

                    <div className="flex gap-2 mb-4">
                        <div className="relative flex-1">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <input
                                type="text"
                                placeholder="Ticker..."
                                value={newSymbol}
                                onChange={e => setNewSymbol(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && addSymbol()}
                                className="w-full rounded-md border border-white/10 bg-white/5 pl-9 pr-3 py-1.5 text-sm outline-none focus:border-emerald-500/50"
                            />
                        </div>
                        <Button size="sm" onClick={addSymbol} disabled={symbols.length >= 5 || !newSymbol.trim()}>
                            <Plus className="h-4 w-4" />
                        </Button>
                    </div>

                    <div className="space-y-2 max-h-[200px] overflow-y-auto">
                        {symbols.map(sym => (
                            <div key={sym} className="flex items-center justify-between rounded-md bg-white/5 py-1.5 px-3">
                                <span className="font-medium text-sm text-ivory">{sym}</span>
                                <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-red-400" onClick={() => removeSymbol(sym)}>
                                    <X className="h-3 w-3" />
                                </Button>
                            </div>
                        ))}
                        {symbols.length === 0 && (
                            <p className="text-xs text-center text-muted-foreground py-2">No symbols added</p>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}
