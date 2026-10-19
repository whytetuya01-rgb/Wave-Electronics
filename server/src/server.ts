import dotenv from 'dotenv';
dotenv.config();

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import mongoose from 'mongoose';
import { connectDB, getIsReplicaSet } from './config/db.js';
import { validateProductionEnv, resolveCorsOrigins, EnvironmentConfigError } from './config/env.js';
import authRoutes from './routes/authRoutes.js';
import mastersRoutes from './routes/mastersRoutes.js';
import componentRoutes from './routes/componentRoutes.js';
import vendorRoutes from './routes/vendorRoutes.js';
import stockInwardRoutes from './routes/stockInwardRoutes.js';
import circuitRoutes from './routes/circuitRoutes.js';
import jobRoutes from './routes/jobRoutes.js';
import challanRoutes from './routes/challanRoutes.js';
import finishedGoodsRoutes from './routes/finishedGoodsRoutes.js';
import reportRoutes from './routes/reportRoutes.js';

// Fail fast and loud on a misconfigured production environment - before
// binding a port or touching the database - rather than silently running
// with an insecure default JWT secret, an unintended local database, or a
// wide-open CORS policy.
try {
  validateProductionEnv();
} catch (err: any) {
  if (err instanceof EnvironmentConfigError) {
    console.error(`[FATAL] ${err.message}`);
    process.exit(1);
  }
  throw err;
}

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
// CSP/COEP disabled: this API serves JSON only (no HTML/assets), and a
// restrictive default CSP has no effect here while risking false positives
// if static content is ever added later without revisiting this config.
app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));

// In production, resolveCorsOrigins() already guarantees this is a
// non-empty, explicitly configured list (never a wildcard) - validated
// above. In development it defaults to `true` (reflect any origin),
// preserving the previous unrestricted local dev behavior.
const corsOrigins = resolveCorsOrigins();
app.use(cors(corsOrigins === true ? {} : { origin: corsOrigins }));

app.use(express.json());

// Request logging in development
if (process.env.NODE_ENV !== 'test') {
  app.use((req: Request, res: Response, next: NextFunction) => {
    console.log(`[${req.method}] ${req.url}`);
    next();
  });
}

// Health Check
app.get('/api/health', async (req: Request, res: Response) => {
  let helloInfo: any = null;
  let topologyInfo: any = null;
  try {
    if (mongoose.connection.db) {
      helloInfo = await mongoose.connection.db.command({ hello: 1 });
    }
    const client = typeof mongoose.connection.getClient === 'function'
      ? mongoose.connection.getClient()
      : (mongoose.connection as any).client;
    topologyInfo = {
      type: client?.topology?.description?.type,
      setName: client?.topology?.description?.setName,
      servers: Array.from(client?.topology?.description?.servers?.keys() || []),
    };
  } catch (err: any) {
    helloInfo = { error: err.message };
  }

  res.json({
    status: 'ok',
    service: 'Wave Electronics Stock & Job Management API',
    version: '1.0.0',
    time: new Date().toISOString(),
    database: {
      connected: mongoose.connection.readyState === 1,
      isReplicaSet: getIsReplicaSet(),
      host: mongoose.connection.host,
      name: mongoose.connection.name,
      hello: {
        setName: helloInfo?.setName || null,
        isWritablePrimary: helloInfo?.isWritablePrimary || helloInfo?.ismaster || false,
        msg: helloInfo?.msg || null,
        error: helloInfo?.error || null,
      },
      topology: topologyInfo,
    },
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/masters', mastersRoutes);
app.use('/api/components', componentRoutes);
app.use('/api/vendors', vendorRoutes);
app.use('/api/stock-inward', stockInwardRoutes);
app.use('/api/circuits', circuitRoutes);
app.use('/api/jobs', jobRoutes);
app.use('/api/challans', challanRoutes);
app.use('/api/finished-goods', finishedGoodsRoutes);
app.use('/api/reports', reportRoutes);

// Global 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({ message: `API route '${req.originalUrl}' not found` });
});

// Global Error Handler
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('[Global Error]:', err);
  res.status(err.status || 500).json({
    message: err.message || 'Internal Server Error',
    error: process.env.NODE_ENV === 'development' ? err.stack : undefined,
  });
});

// Start Server
async function start() {
  await connectDB();
  app.listen(PORT, () => {
    console.log(`⚡ [Wave Electronics API Server] running on http://localhost:${PORT}`);
  });
}

start();

export default app;
