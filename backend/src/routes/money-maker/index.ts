import { Router } from 'express'
import { getSnapshot, getWatchlist, updateWatchlist } from '../../controllers/money-maker'

const router = Router()

router.get('/snapshot', getSnapshot)
router.get('/watchlist', getWatchlist)
router.post('/watchlist', updateWatchlist)

export default router
