import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { prisma } from './lib/prisma.js';
import authRoutes from './routes/auth.js';
import roomsRoutes from './routes/rooms.js';
import propertiesRoutes from './routes/properties.js';
import bookingsRoutes from './routes/bookings.js';
import hostRoutes from './routes/host.js';
import adminRoutes from './routes/admin.js';

const app = express();
const port = Number(process.env.PORT ?? 5001);
const frontendUrl = process.env.FRONTEND_URL?.trim();
const corsOrigins = [
  frontendUrl,
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  ...(process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
].filter((origin): origin is string => Boolean(origin));

app.set('trust proxy', 1);
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || corsOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }),
);
app.options(/^(.*)$/, cors());
app.use(express.json({ limit: '1mb' }));
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 200,
    standardHeaders: true,
    legacyHeaders: false,
  }),
);

app.get('/api/health', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`; 
    return res.json({ ok: true, database: 'connected', message: 'Sieuechxanh API is running.' });
  } catch (error) {
    console.error('Database health check failed:', error);
    return res.status(503).json({
      ok: false,
      database: 'disconnected',
      message: 'Sieuechxanh API is running, but PostgreSQL is unavailable. Configure DATABASE_URL and start the database service.',
    });
  }
});

app.use('/api/auth', authRoutes);
app.use('/api/rooms', roomsRoutes);
app.use('/api/properties', propertiesRoutes);
app.use('/api/bookings', bookingsRoutes);
app.use('/api/host', hostRoutes);
app.use('/api/admin', adminRoutes);

app.use((_req, res) => {
  res.status(404).json({ message: 'API route not found.' });
});

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);

  const isPrismaLikeError = (error: unknown): boolean => {
    if (!(error instanceof Error)) return false;
    const prismaErrorNames = [
      'PrismaClientInitializationError',
      'PrismaClientKnownRequestError',
      'PrismaClientUnknownRequestError',
      'PrismaClientValidationError',
      'PrismaClientRustPanicError',
    ];
    return prismaErrorNames.includes(error.name) || ('code' in error && typeof (error as { code?: string }).code === 'string');
  };

  if (isPrismaLikeError(err)) {
    return res.status(503).json({
      message: 'Database connection failed. Please check DATABASE_URL and ensure PostgreSQL/Supabase is reachable.',
    });
  }

  const message = err instanceof Error ? err.message : 'Unexpected server error.';
  return res.status(500).json({ message: process.env.NODE_ENV === 'development' ? message : 'Unexpected server error.' });
});

app.listen(port, () => {
  console.log(`Sieuechxanh server running on http://localhost:${port}`);
});
