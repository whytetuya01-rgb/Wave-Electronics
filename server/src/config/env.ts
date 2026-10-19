// Centralized environment/configuration validation. Every value that is
// security-sensitive (JWT signing secret, CORS trust list, database target)
// is resolved through here instead of being read inline with a hardcoded
// fallback at the call site - so there is exactly one place that decides
// what's safe to default in development and what must be explicitly
// configured in production.
//
// Every resolver takes an optional `env` parameter (defaulting to
// process.env) so they can be unit-tested with an arbitrary environment
// object, without needing to spawn a subprocess or mutate global state.

export class EnvironmentConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EnvironmentConfigError';
  }
}

const MIN_JWT_SECRET_LENGTH = 32;
const DEV_ONLY_JWT_SECRET = 'dev_only_insecure_jwt_secret_do_not_use_in_production';

function isProduction(env: NodeJS.ProcessEnv): boolean {
  return env.NODE_ENV === 'production';
}

// Resolves the JWT signing secret. Production REQUIRES an explicit,
// sufficiently long secret - there is no hardcoded fallback compiled into
// the source that a forgotten deployment could silently rely on. The
// development fallback exists only so local setup doesn't require a .env
// file on day one; it is never used when NODE_ENV=production.
export function resolveJwtSecret(env: NodeJS.ProcessEnv = process.env): string {
  const secret = env.JWT_SECRET;

  if (isProduction(env)) {
    if (!secret || !secret.trim()) {
      throw new EnvironmentConfigError(
        'JWT_SECRET is required in production. Set a strong, random secret of at least ' +
          `${MIN_JWT_SECRET_LENGTH} characters via the JWT_SECRET environment variable.`
      );
    }
    if (secret.trim().length < MIN_JWT_SECRET_LENGTH) {
      throw new EnvironmentConfigError(
        `JWT_SECRET is too short for production (${secret.trim().length} characters). ` +
          `Use a random secret of at least ${MIN_JWT_SECRET_LENGTH} characters.`
      );
    }
    return secret.trim();
  }

  return secret && secret.trim() ? secret.trim() : DEV_ONLY_JWT_SECRET;
}

// Resolves the MongoDB connection string. Production REQUIRES it to be set
// explicitly - the localhost fallback is development-only, so a production
// deployment can never silently connect to an unintended local database.
// This only validates that a value was configured; connectDB() separately
// verifies the connected deployment actually supports transactions (a
// replica set), which can't be known until after connecting.
export function resolveMongoUri(env: NodeJS.ProcessEnv = process.env): string {
  const uri = env.MONGODB_URI;

  if (isProduction(env)) {
    if (!uri || !uri.trim()) {
      throw new EnvironmentConfigError(
        'MONGODB_URI is required in production. Point it at a transaction-capable replica-set deployment.'
      );
    }
    return uri.trim();
  }

  return uri && uri.trim() ? uri.trim() : 'mongodb://127.0.0.1:27017/wave_electronics';
}

// Resolves the set of trusted CORS origins. Production REQUIRES at least
// one explicitly configured origin - no wildcard, no silent allow-all.
// Development preserves the existing wide-open behavior (`true`, meaning
// "reflect any origin") unless CORS_ORIGIN is explicitly set, so local dev
// workflows are unaffected by this change.
export function resolveCorsOrigins(env: NodeJS.ProcessEnv = process.env): string[] | true {
  const raw = env.CORS_ORIGIN;
  const parsed = raw
    ? raw
        .split(',')
        .map((o) => o.trim())
        .filter(Boolean)
    : [];

  if (isProduction(env)) {
    if (parsed.length === 0) {
      throw new EnvironmentConfigError(
        'CORS_ORIGIN is required in production. Set a comma-separated list of trusted frontend ' +
          'origins (e.g. https://app.example.com), not a wildcard.'
      );
    }
    return parsed;
  }

  return parsed.length > 0 ? parsed : true;
}

// Runs every production-readiness check and throws on the first problem
// found (EnvironmentConfigError), with a message specific enough to act on
// immediately. Called once at startup, before the server binds a port or
// connects to the database - a misconfigured production deployment fails
// fast and loud instead of silently running with an insecure default.
export function validateProductionEnv(env: NodeJS.ProcessEnv = process.env): void {
  resolveJwtSecret(env);
  resolveMongoUri(env);
  resolveCorsOrigins(env);
}
