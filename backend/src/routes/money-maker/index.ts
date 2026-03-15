import { Router } from 'express'
import {
  getContracts,
  getPlan,
  getSnapshot,
  getWatchlist,
  getWorkspace,
  updateWatchlist,
} from '../../controllers/money-maker'

const router = Router()

router.get('/snapshot', getSnapshot)
router.get('/workspace', getWorkspace)
router.get('/plan', getPlan)
router.get('/contracts', getContracts)
router.get('/watchlist', getWatchlist)
router.post('/watchlist', updateWatchlist)

export default router
