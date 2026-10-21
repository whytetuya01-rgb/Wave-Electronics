import rateLimit from 'express-rate-limit';

// Throttles the login endpoint specifically - the one auth route reachable
// without a valid token, and therefore the only one exposed to brute-force
// credential guessing. Keyed per-IP by express-rate-limit's default.
//
// The counts live in this process's memory. On Vercel each function instance
// keeps its own counts, and instances come and go, so an attacker spread
// across instances gets more than 20 tries per window. Acceptable for preview
// testing only: production needs a shared store (see DEPLOYMENT.md).
export const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many login attempts - please try again later' },
});
