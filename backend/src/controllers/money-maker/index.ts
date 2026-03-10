import { Request, Response } from 'express'
import { buildSnapshot } from '../../services/money-maker/snapshotBuilder'
import { supabase } from '../../config/database'
import { isValidSymbol, normalizeSymbol } from '../../lib/symbols'

const DEFAULT_WATCHLIST_SYMBOLS = ['SPY', 'TSLA', 'AAPL', 'NVDA', 'META']

interface AuthenticatedUser {
    id: string
}

interface WatchlistRow {
    id?: string
    user_id?: string
    symbol: string
    display_order: number
    is_active: boolean
}

async function getAuthenticatedUser(req: Request): Promise<AuthenticatedUser | null> {
    const authHeader = req.headers.authorization
    if (!authHeader?.startsWith('Bearer ')) {
        return null
    }

    const token = authHeader.slice('Bearer '.length).trim()
    if (!token) {
        return null
    }

    const { data: { user }, error } = await supabase.auth.getUser(token)
    if (error || !user) {
        return null
    }

    return { id: user.id }
}

async function listDefaultWatchlist(): Promise<WatchlistRow[]> {
    const { data, error } = await supabase
        .from('money_maker_default_symbols')
        .select('symbol, display_order')
        .eq('is_active', true)
        .order('display_order', { ascending: true })

    if (error || !data || data.length === 0) {
        return DEFAULT_WATCHLIST_SYMBOLS.map((symbol, index) => ({
            symbol,
            display_order: index + 1,
            is_active: true,
        }))
    }

    return data.map((row) => ({
        symbol: row.symbol,
        display_order: row.display_order,
        is_active: true,
    }))
}

async function listEffectiveWatchlist(userId: string): Promise<WatchlistRow[]> {
    const { data, error } = await supabase
        .from('money_maker_watchlists')
        .select('id, user_id, symbol, display_order, is_active')
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('display_order', { ascending: true })

    if (error || !data || data.length === 0) {
        return listDefaultWatchlist()
    }

    return data
}

function sanitizeWatchlistSymbols(symbols: unknown[]): string[] {
    const normalized = symbols
        .filter((symbol): symbol is string => typeof symbol === 'string')
        .map((symbol) => normalizeSymbol(symbol))
        .filter(Boolean)

    const uniqueSymbols = Array.from(new Set(normalized))
    const invalidSymbols = uniqueSymbols.filter((symbol) => !isValidSymbol(symbol))

    if (invalidSymbols.length > 0) {
        throw new Error(`invalid symbols: ${invalidSymbols.join(', ')}`)
    }

    return uniqueSymbols.slice(0, 5)
}

// GET /api/money-maker/snapshot
export async function getSnapshot(req: Request, res: Response) {
    try {
        const user = await getAuthenticatedUser(req)
        if (!user) {
            return res.status(401).json({ error: 'Unauthorized' })
        }

        const watchlist = await listEffectiveWatchlist(user.id)
        const symbols = watchlist.map((row) => row.symbol)
        const snapshot = await buildSnapshot(symbols, user.id)

        return res.status(200).json({
            ...snapshot,
            symbols,
        })
    } catch (err: any) {
        console.error('[getSnapshot] Error:', err)
        return res.status(500).json({ error: 'Failed to build snapshot' })
    }
}

// GET /api/money-maker/watchlist
export async function getWatchlist(req: Request, res: Response) {
    try {
        const user = await getAuthenticatedUser(req)
        if (!user) return res.status(401).json({ error: 'Unauthorized' })

        const watchlists = await listEffectiveWatchlist(user.id)

        return res.status(200).json({ watchlists })
    } catch (err: any) {
        return res.status(500).json({ error: err.message })
    }
}

// POST /api/money-maker/watchlist
export async function updateWatchlist(req: Request, res: Response) {
    try {
        const symbols = req.body?.symbols

        if (!Array.isArray(symbols) || symbols.some((symbol) => typeof symbol !== 'string')) {
            return res.status(400).json({ error: 'symbols must be an array' })
        }

        if (symbols.length > 5) {
            return res.status(400).json({ error: 'maximum 5 symbols allowed in watchlist' })
        }

        const normalizedSymbols = sanitizeWatchlistSymbols(symbols)
        const user = await getAuthenticatedUser(req)
        if (!user) return res.status(401).json({ error: 'Unauthorized' })

        const now = new Date().toISOString()

        const { error: deactivateError } = await supabase
            .from('money_maker_watchlists')
            .update({ is_active: false, updated_at: now })
            .eq('user_id', user.id)

        if (deactivateError) throw deactivateError

        if (normalizedSymbols.length > 0) {
            const inserts = normalizedSymbols.map((symbol, index) => ({
                user_id: user.id,
                symbol,
                display_order: index + 1,
                is_active: true,
                updated_at: now,
            }))

            const { error: upsertError } = await supabase
                .from('money_maker_watchlists')
                .upsert(inserts, { onConflict: 'user_id,symbol' })

            if (upsertError) throw upsertError
        }

        return res.status(200).json({
            message: 'Watchlist updated',
            watchlists: normalizedSymbols.map((symbol, index) => ({
                symbol,
                display_order: index + 1,
                is_active: true,
            })),
        })
    } catch (err: any) {
        if (err instanceof Error && err.message.startsWith('invalid symbols:')) {
            return res.status(400).json({ error: err.message })
        }
        return res.status(500).json({ error: err.message })
    }
}
