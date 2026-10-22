import rateLimit from 'express-rate-limit';
import { MongoRateLimitStore } from './mongoRateLimitStore.js';

// Throttles the login endpoint specifically - the one auth route reachable
// without a valid token, and therefore the only one exposed to brute-force
// credential guessing. Keyed per-IP by express-rate-limit's default.
//
// Counts live in MongoDB (the ratelimitcounters collection), not in process
// memory: on Vercel every function instance shares them, so spreading
// attempts across instances doesn't buy extra tries.
export const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  store: new MongoRateLimitStore('login:'),
  message: { message: 'Too many login attempts - please try again later' },
});
