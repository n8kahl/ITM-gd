import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { connectRedis } from './config/redis';
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
app.use(cors()); // Enable CORS
app.use(express.json({ limit: '15mb' })); // Parse JSON bodies (larger for screenshots)
app.use(express.urlencoded({ extended: true })); // Parse URL-encoded bodies
app.use(morgan('dev')); // HTTP request logging

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

// Error handler
app.use((err: Error, req: Request, res: Response, next: any) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message
  });
});

// Initialize connections and start server
async function start() {
  try {
    // Connect to Redis
    console.log('Connecting to Redis...');
    await connectRedis();
    console.log('✓ Redis connected');

    // Start Express server
    app.listen(PORT, () => {
      console.log(`✓ Server running on http://localhost:${PORT}`);
      console.log(`✓ Health check: http://localhost:${PORT}/health`);
      console.log(`✓ Detailed health check: http://localhost:${PORT}/health/detailed`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully...');
  process.exit(0);
});

// Start the server
start();
