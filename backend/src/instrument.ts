import dotenv from 'dotenv';
import { initSentryBootstrap } from './config/sentry';

// Load env before early Sentry bootstrap.
dotenv.config();

// Initialize Sentry before any express imports so auto-instrumentation can patch correctly.
initSentryBootstrap();
