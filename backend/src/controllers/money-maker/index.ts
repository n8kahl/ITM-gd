import { Request, Response } from 'express'
import { buildSnapshot } from '../../services/money-maker/snapshotBuilder'
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

const supabaseUrl = process.env.SUPABASE_URL || ''
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const supabase = createClient(supabaseUrl, supabaseKey)

// GET /api/money-maker/snapshot
export async function getSnapshot(req: Request, res: Response) {
    try {
        const authHeader = req.headers.authorization
        if (!authHeader) {
            return res.status(401).json({ error: 'Missing authorization header' })
        }

        // Get user from token
        const token = authHeader.replace('Bearer ', '')
        const { data: { user }, error: userError } = await supabase.auth.getUser(token)

        if (userError || !user) {
            return res.status(401).json({ error: 'Invalid token' })
        }

        // 1. Get user's watchlist symbols
        const { data: watchlists, error } = await supabase
            .from('money_maker_watchlists')
            .select('symbol')
            .eq('user_id', user.id)
            .eq('is_active', true)

        let symbols: string[] = []

        if (error || !watchlists || watchlists.length === 0) {
            // Fallback to default symbols if error or empty
            const { data: defaults } = await supabase
                .from('money_maker_default_symbols')
                .select('symbol')
                .eq('is_active', true)

            symbols = defaults ? defaults.map(d => d.symbol) : ['SPY', 'QQQ', 'IWM']
        } else {
            symbols = watchlists.map(w => w.symbol)
        }

        // 2. Build snapshot using the engine
        const snapshot = await buildSnapshot(symbols, user.id)

        // 3. Return snapshot
        return res.status(200).json(snapshot)
    } catch (err: any) {
        console.error('[getSnapshot] Error:', err)
        return res.status(500).json({ error: 'Failed to build snapshot' })
    }
}

// GET /api/money-maker/watchlist
export async function getWatchlist(req: Request, res: Response) {
    try {
        const authHeader = req.headers.authorization
        if (!authHeader) return res.status(401).json({ error: 'Unauthorized' })

        const token = authHeader.replace('Bearer ', '')
        const { data: { user }, error: userError } = await supabase.auth.getUser(token)

        if (userError || !user) return res.status(401).json({ error: 'Unauthorized' })

        const { data, error } = await supabase
            .from('money_maker_watchlists')
            .select('*')
            .eq('user_id', user.id)
            .eq('is_active', true)
            .order('display_order', { ascending: true })

        if (error) throw error

        return res.status(200).json({ watchlists: data })
    } catch (err: any) {
        return res.status(500).json({ error: err.message })
    }
}

// POST /api/money-maker/watchlist
export async function updateWatchlist(req: Request, res: Response) {
    try {
        const { symbols } = req.body // Array of strings e.g. ['TSLA', 'AAPL', 'NVDA']

        if (!Array.isArray(symbols)) {
            return res.status(400).json({ error: 'symbols must be an array' })
        }

        if (symbols.length > 5) {
            return res.status(400).json({ error: 'maximum 5 symbols allowed in watchlist' })
        }

        const authHeader = req.headers.authorization
        if (!authHeader) return res.status(401).json({ error: 'Unauthorized' })

        const token = authHeader.replace('Bearer ', '')
        const { data: { user }, error: userError } = await supabase.auth.getUser(token)

        if (userError || !user) return res.status(401).json({ error: 'Unauthorized' })

        // A simple overwrite strategy (deactivate all old, insert new)
        // 1. Deactivate old
        await supabase
            .from('money_maker_watchlists')
            .update({ is_active: false })
            .eq('user_id', user.id)

        // 2. Insert new or reactivate
        const inserts = symbols.map((sym: string, i: number) => ({
            user_id: user.id,
            symbol: sym.trim().toUpperCase(),
            display_order: i,
            is_active: true
        }))

        const { error: upsertError } = await supabase
            .from('money_maker_watchlists')
            .upsert(inserts, { onConflict: 'user_id, symbol' })

        if (upsertError) throw upsertError

        return res.status(200).json({ message: 'Watchlist updated' })
    } catch (err: any) {
        return res.status(500).json({ error: err.message })
    }
}
