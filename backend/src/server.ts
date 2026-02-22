import './instrument';
import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';

import { initSentry, flushSentry, Sentry } from './config/sentry';
import { logger } from './lib/logger';
import { connectRedis } from './config/redis';
import { requestIdMiddleware } from './middleware/requestId';
import { validateEnv } from './config/env';
import { generalLimiter, chatLimiter, screenshotLimiter } from './middleware/rateLimiter';
import { authenticateToken } from './middleware/auth';
import healthRouter from './routes/health';
import levelsRouter from './routes/levels';
import chatRouter from './routes/chat';
import optionsRouter from './routes/options';
import chartRouter from './routes/chart';
import screenshotRouter from './routes/screenshot';
import alertsRouter from './routes/alerts';
import leapsRouter from './routes/leaps';
import marketRouter from './routes/market';
import macroRouter from './routes/macro';
import scannerRouter from './routes/scanner';
import watchlistRouter from './routes/watchlist';
import briefRouter from './routes/brief';
import trackedSetupsRouter from './routes/trackedSetups';
import symbolsRouter from './routes/symbols';
import earningsRouter from './routes/earnings';
import economicRouter from './routes/economic';
import fibonacciRouter from './routes/fibonacci';
import spxRouter from './routes/spx';
import { startAlertWorker, stopAlertWorker } from './workers/alertWorker';
import { startMorningBriefWorker, stopMorningBriefWorker } from './workers/morningBriefWorker';
import { startSetupPushWorker, stopSetupPushWorker } from './workers/setupPushWorker';
import { startPositionTrackerWorker, stopPositionTrackerWorker } from './workers/positionTrackerWorker';
import { startSessionCleanupWorker, stopSessionCleanupWorker } from './workers/sessionCleanupWorker';
import { startWorkerHealthAlertWorker, stopWorkerHealthAlertWorker } from './workers/workerHealthAlertWorker';
import { startSPXDataLoop, stopSPXDataLoop } from './workers/spxDataLoop';
import { startSPXOptimizerWorker, stopSPXOptimizerWorker } from './workers/spxOptimizerWorker';
import { startPortfolioSyncWorker, stopPortfolioSyncWorker } from './workers/portfolioSyncWorker';
import { initWebSocket, shutdownWebSocket } from './services/websocket';
import { startMassiveTickStream, stopMassiveTickStream } from './services/massiveTickStream';
import { startSetupDetectorService, stopSetupDetectorService } from './services/setupDetector';
import { initializeMarketHolidays } from './services/marketHours';

const app: Application = express();
const PORT = process.env.PORT || 3001;

// Initialize Sentry FIRST — before any other middleware
initSentry(app);

// Trust proxy - required when running behind Railway/reverse proxy
app.set('trust proxy', 1);

// Middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  crossOriginOpenerPolicy: false,
}));
app.use(requestIdMiddleware);

// CORS configuration
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '').split(',').filter(Boolean);
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (allowedOrigins.length === 0) {
      if (process.env.NODE_ENV !== 'production') return callback(null, true);
      return callback(new Error('CORS: No allowed origins configured for production'));
    }
    if (allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error(`CORS: Origin ${origin} not allowed`));
  },
  credentials: true,
  methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID', 'x-e2e-bypass-auth'],
  maxAge: 86400,
}));

app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

// Request timeout middleware
app.use((req: Request, res: Response, next: any) => {
  const timeout = req.path.startsWith('/api/chat')
    ? 60000
    : req.path.startsWith('/api/spx/snapshot')
      ? 75000
      : req.path.startsWith('/api/spx/contract-select')
        ? 60000
        : req.path.startsWith('/api/spx')
          ? 45000
    : (req.path.startsWith('/api/brief') || req.path.startsWith('/api/market'))
      ? 45000
      : 30000;
  res.setTimeout(timeout, () => {
    if (!res.headersSent) {
      res.status(408).json({ error: 'Request timeout', message: 'The request took too long to process. Please try again.' });
    }
  });
  next();
});

// Sentry request context — attach requestId and userId to error reports
app.use((req: Request, _res: Response, next: any) => {
  Sentry.setTag('requestId', (req as any).requestId);
  const userId = (req as any).userId;
  if (userId) {
    Sentry.setUser({ id: userId });
  }
  next();
});

// Rate limiting
app.use('/api/', generalLimiter);
app.use('/api/chat', chatLimiter);
app.use('/api/screenshot', screenshotLimiter);

// Routes
app.use('/health', healthRouter);
app.use('/api/levels', levelsRouter);
app.use('/api/chat', chatRouter);
app.use('/api/options', optionsRouter);
app.use('/api/positions', optionsRouter);
app.use('/api/chart', chartRouter);
app.use('/api/screenshot', screenshotRouter);
app.use('/api/alerts', alertsRouter);
app.use('/api/leaps', leapsRouter);
app.use('/api/market', marketRouter);
app.use('/api/macro', macroRouter);
app.use('/api/scanner', scannerRouter);
app.use('/api/watchlist', watchlistRouter);
app.use('/api/brief', briefRouter);
app.use('/api/tracked-setups', trackedSetupsRouter);
app.use('/api/symbols', symbolsRouter);
app.use('/api/earnings', earningsRouter);
app.use('/api/economic', economicRouter);
app.use('/api/fibonacci', fibonacciRouter);
app.use('/api/spx', spxRouter);
// Backward-compatible auth-gated endpoint retained for legacy clients and E2E checks.
app.get('/api/journal/trades', authenticateToken, (_req: Request, res: Response) => {
  res.status(410).json({
    error: 'Endpoint moved',
    message: 'Use members journal APIs for trade history.',
  });
});

// Root endpoint
app.get('/', (_req: Request, res: Response) => {
  res.json({
    name: 'TITM AI Coach Backend',
    version: '1.0.0',
    status: 'running',
    endpoints: {
      health: '/health', healthReady: '/health/ready', levels: '/api/levels/:symbol', chat: '/api/chat/message',
      sessions: '/api/chat/sessions', sessionMessages: '/api/chat/sessions/:sessionId/messages',
      optionsChain: '/api/options/:symbol/chain', optionsExpirations: '/api/options/:symbol/expirations',
      optionsGex: '/api/options/:symbol/gex', optionsZeroDte: '/api/options/:symbol/0dte', optionsIv: '/api/options/:symbol/iv',
      earningsCalendar: '/api/earnings/calendar', earningsAnalysis: '/api/earnings/:symbol/analysis',
      economicCalendar: '/api/economic/calendar', economicUpcoming: '/api/economic/calendar/upcoming',
      positionsAnalyze: '/api/positions/analyze', positionsLive: '/api/positions/live', positionsAdvice: '/api/positions/advice',
      chart: '/api/chart/:symbol', screenshotAnalyze: '/api/screenshot/analyze',
      alerts: '/api/alerts', alertCancel: '/api/alerts/:id/cancel', leaps: '/api/leaps', leapsDetail: '/api/leaps/:id',
      leapsRoll: '/api/leaps/:id/roll-calculation', macroContext: '/api/macro', macroImpact: '/api/macro/impact/:symbol',
      scannerScan: '/api/scanner/scan', watchlist: '/api/watchlist', briefToday: '/api/brief/today', spx: '/api/spx/*',
      trackedSetups: '/api/tracked-setups', symbolSearch: '/api/symbols/search', chatStream: '/api/chat/stream', wsPrices: '/ws/prices',
      fibonacci: '/api/fibonacci',
    }
  });
});

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({ error: 'Not found', message: `Route ${req.method} ${req.path} not found` });
});

// Error handler
app.use((err: Error, _req: Request, res: Response, _next: any) => {
  logger.error('Unhandled error', { error: err.stack || err.message });
  if (err.message.startsWith('CORS:')) {
    res.status(403).json({ error: 'Forbidden', message: 'Origin not allowed' });
    return;
  }
  // Report non-CORS errors to Sentry
  Sentry.captureException(err);
  const isProduction = process.env.NODE_ENV === 'production';
  res.status(500).json({ error: 'Internal server error', message: isProduction ? 'An unexpected error occurred' : err.message });
});

let httpServer: any;

async function start() {
  try {
    const env = validateEnv();
    logger.info(`Starting server in ${env.NODE_ENV} mode...`);

    try {
      logger.info('Connecting to Redis...');
      await connectRedis();
      logger.info('Redis connected (or skipped if not configured)');
    } catch (redisError) {
      logger.warn('Redis connection failed - running without cache', { error: redisError instanceof Error ? redisError.message : String(redisError) });
    }

    httpServer = app.listen(PORT, () => { logger.info(`Server running on http://localhost:${PORT}`); });
    httpServer.setTimeout(90000);

    // Initialize WebSocket server for real-time price updates
    initWebSocket(httpServer);
    startMassiveTickStream();

    // Start background alert worker
    startAlertWorker();
    startMorningBriefWorker();
    startSetupPushWorker();
    startPositionTrackerWorker();
    startSessionCleanupWorker();
    startSetupDetectorService();
    startWorkerHealthAlertWorker();
    startSPXDataLoop();
    startSPXOptimizerWorker();
    startPortfolioSyncWorker();

    // Initialize market holidays (async, but don't block server start completely)
    initializeMarketHolidays().catch(err => logger.error('Failed to init market holidays', { error: err }));
  } catch (error) {
    logger.error('Failed to start server', { error: error instanceof Error ? error.message : String(error) });
    process.exit(1);
  }
}

let isShuttingDown = false;
async function gracefulShutdown(signal: string) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  logger.info(`${signal} received. Starting graceful shutdown...`);
  if (httpServer) { httpServer.close(() => { logger.info('HTTP server closed'); }); }
  const shutdownTimeout = setTimeout(() => { logger.error('Graceful shutdown timed out, forcing exit'); process.exit(1); }, 30000);
  try {
    // Stop background services
    stopAlertWorker();
    stopMorningBriefWorker();
    stopSetupPushWorker();
    stopPositionTrackerWorker();
    stopSessionCleanupWorker();
    stopSetupDetectorService();
    stopWorkerHealthAlertWorker();
    stopSPXDataLoop();
    stopSPXOptimizerWorker();
    stopPortfolioSyncWorker();
    stopMassiveTickStream();
    shutdownWebSocket();
    // Flush pending Sentry events before shutdown
    await flushSentry();
    logger.info('Sentry flushed');
    const { redisClient } = require('./config/redis');
    if (redisClient?.isOpen) { await redisClient.quit(); logger.info('Redis connection closed'); }
  } catch (err) { logger.error('Error during shutdown', { error: err instanceof Error ? err.message : String(err) }); }
  clearTimeout(shutdownTimeout);
  logger.info('Graceful shutdown complete');
  process.exit(0);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

start();
