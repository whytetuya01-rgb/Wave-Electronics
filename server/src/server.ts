import dotenv from 'dotenv';
dotenv.config();

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { connectDB } from './config/db.js';
import authRoutes from './routes/authRoutes.js';
import mastersRoutes from './routes/mastersRoutes.js';
import componentRoutes from './routes/componentRoutes.js';
import vendorRoutes from './routes/vendorRoutes.js';
import stockInwardRoutes from './routes/stockInwardRoutes.js';
import circuitRoutes from './routes/circuitRoutes.js';
import jobRoutes from './routes/jobRoutes.js';
import challanRoutes from './routes/challanRoutes.js';

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Request logging in development
if (process.env.NODE_ENV !== 'test') {
  app.use((req: Request, res: Response, next: NextFunction) => {
    console.log(`[${req.method}] ${req.url}`);
    next();
  });
}

// Health Check
app.get('/api/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'Wave Electronics Stock & Job Management API',
    version: '1.0.0',
    time: new Date().toISOString(),
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
