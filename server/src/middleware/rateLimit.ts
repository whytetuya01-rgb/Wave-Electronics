import rateLimit from 'express-rate-limit';

// Throttles the login endpoint specifically - the one auth route reachable
// without a valid token, and therefore the only one exposed to brute-force
// credential guessing. Keyed per-IP by express-rate-limit's default.
export const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many login attempts - please try again later' },
});
