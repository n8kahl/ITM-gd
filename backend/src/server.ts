import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { logger } from './lib/logger';
import { connectRedis } from './config/redis';
import { requestIdMiddleware } from './middleware/requestId';
import { validateEnv } from './config/env';
import { generalLimiter, chatLimiter, screenshotLimiter } from './middleware/rateLimiter';
import healthRouter from './routes/health';
import levelsRouter from './routes/levels';
import chatRouter from './routes/chat';
import optionsRouter from './routes/options';
import chartRouter from './routes/chart';
import screenshotRouter from './routes/screenshot';
import journalRouter from './routes/journal';
import alertsRouter from './routes/alerts';
import leapsRouter from './routes/leaps';
import macroRouter from './routes/macro';

dotenv.config();

const app: Application = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(helmet()); // Security headers
app.use(requestIdMiddleware); // Request ID tracking

// CORS configuration - restrict to known origins
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '').split(',').filter(Boolean);
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (server-to-server, curl, mobile apps)
    if (!origin) return callback(null, true);
    if (allowedOrigins.length === 0) {
      // Development: allow all if no origins configured
      if (process.env.NODE_ENV !== 'production') return callback(null, true);
      return callback(new Error('CORS: No allowed origins configured for production'));
    }
    if (allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error(`CORS: Origin ${origin} not allowed`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
  maxAge: 86400,
}));

app.use(express.json({ limit: '15mb' })); // Parse JSON bodies (larger for screenshots)
app.use(express.urlencoded({ extended: true })); // Parse URL-encoded bodies
app.use(morgan('dev')); // HTTP request logging

// Request timeout middleware
app.use((req: Request, res: Response, next: any) => {
  // 60 seconds for chat endpoints, 30 seconds for everything else
  const timeout = req.path.startsWith('/api/chat') ? 60000 : 30000;
  res.setTimeout(timeout, () => {
    if (!res.headersSent) {
      res.status(408).json({
        error: 'Request timeout',
        message: 'The request took too long to process. Please try again.',
      });
    }
  });
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
app.use('/api/journal', journalRouter);
app.use('/api/alerts', alertsRouter);
app.use('/api/leaps', leapsRouter);
app.use('/api/macro', macroRouter);

// Root endpoint
app.get('/', (req: Request, res: Response) => {
  res.json({
    name: 'TITM AI Coach Backend',
    version: '1.0.0',
    status: 'running',
    endpoints: {
      health: '/health',
      healthDetailed: '/health/detailed',
      levels: '/api/levels/:symbol',
      chat: '/api/chat/message',
      sessions: '/api/chat/sessions',
      sessionMessages: '/api/chat/sessions/:sessionId/messages',
      optionsChain: '/api/options/:symbol/chain',
      optionsExpirations: '/api/options/:symbol/expirations',
      positionsAnalyze: '/api/positions/analyze',
      chart: '/api/chart/:symbol',
      screenshotAnalyze: '/api/screenshot/analyze',
      journalTrades: '/api/journal/trades',
      journalAnalytics: '/api/journal/analytics',
      journalImport: '/api/journal/import',
      alerts: '/api/alerts',
      alertCancel: '/api/alerts/:id/cancel',
      leaps: '/api/leaps',
      leapsDetail: '/api/leaps/:id',
      leapsRoll: '/api/leaps/:id/roll-calculation',
      macroContext: '/api/macro',
      macroImpact: '/api/macro/impact/:symbol'
    }
  });
});

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    error: 'Not found',
    message: `Route ${req.method} ${req.path} not found`
  });
});

// Error handler - never leak internal details in production
app.use((err: Error, req: Request, res: Response, _next: any) => {
  logger.error('Unhandled error', { error: err.stack || err.message });

  // CORS errors
  if (err.message.startsWith('CORS:')) {
    res.status(403).json({ error: 'Forbidden', message: 'Origin not allowed' });
    return;
  }

  const isProduction = process.env.NODE_ENV === 'production';
  res.status(500).json({
    error: 'Internal server error',
    message: isProduction ? 'An unexpected error occurred' : err.message,
  });
});

// Initialize connections and start server
let httpServer: any;

async function start() {
  try {
    // Validate all environment variables
    const env = validateEnv();
    logger.info(`Starting server in ${env.NODE_ENV} mode...`);

    logger.info('Connecting to Redis...');
    await connectRedis();
    logger.info('Redis connected');

    httpServer = app.listen(PORT, () => {
      logger.info(`Server running on http://localhost:${PORT}`);
    });

    // Set request timeout to prevent hung connections
    httpServer.setTimeout(30000);
  } catch (error) {
    logger.error('Failed to start server', { error: error instanceof Error ? error.message : String(error) });
    process.exit(1);
  }
}

// Graceful shutdown handler
let isShuttingDown = false;

async function gracefulShutdown(signal: string) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  logger.info(`${signal} received. Starting graceful shutdown...`);

  // Stop accepting new connections
  if (httpServer) {
    httpServer.close(() => {
      logger.info('HTTP server closed');
    });
  }

  // Give in-flight requests time to complete
  const shutdownTimeout = setTimeout(() => {
    logger.error('Graceful shutdown timed out, forcing exit');
    process.exit(1);
  }, 30000);

  try {
    // Close Redis connection
    const { redisClient } = require('./config/redis');
    if (redisClient?.isOpen) {
      await redisClient.quit();
      logger.info('Redis connection closed');
    }
  } catch (err) {
    logger.error('Error during shutdown', { error: err instanceof Error ? err.message : String(err) });
  }

  clearTimeout(shutdownTimeout);
  logger.info('Graceful shutdown complete');
  process.exit(0);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Start the server
start();
