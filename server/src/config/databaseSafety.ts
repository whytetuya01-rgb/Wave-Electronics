import mongoose from 'mongoose';

// Database names that mark a disposable copy: safe to seed, wipe, and run the
// write-heavy test scripts against. The production database must not use any
// of these (production is `wave_electronics`, preview `wave_electronics_preview`).
const DISPOSABLE_SUFFIXES = ['_preview', '_dev', '_test'];
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);

export function isDisposableDatabase(name: string, host: string): boolean {
  return DISPOSABLE_SUFFIXES.some((suffix) => name.endsWith(suffix)) || LOCAL_HOSTS.has(host);
}

// Stops a script that deletes or writes test data (seed, regression tests)
// before it touches a database that may hold real data. Call after connecting.
export function assertDisposableDatabase(purpose: string): void {
  const { name, host } = mongoose.connection;
  if (!isDisposableDatabase(name, host)) {
    throw new Error(
      `${purpose} refuses to run against database "${name}" on ${host}: it writes or deletes data. ` +
        `Point MONGODB_URI at a database whose name ends in ${DISPOSABLE_SUFFIXES.join(', ')}, or at a local MongoDB.`
    );
  }
}

// Keeps each Vercel environment on its own data. A Preview deployment may only
// use a *_preview database and Production never a disposable one, so a
// mis-pasted MONGODB_URI fails at connect time instead of letting Preview
// testing write to production. The Atlas users (one per database) are the
// main barrier; this is the second one. Returns the problem, or null.
export function deploymentDatabaseMismatch(
  name: string,
  vercelEnv: string | undefined = process.env.VERCEL_ENV
): string | null {
  if (vercelEnv === 'preview' && !name.endsWith('_preview')) {
    return `Preview deployments only use a database whose name ends in _preview; MONGODB_URI names "${name}".`;
  }
  if (vercelEnv === 'production' && DISPOSABLE_SUFFIXES.some((suffix) => name.endsWith(suffix))) {
    return `Production must not use a disposable database; MONGODB_URI names "${name}".`;
  }
  return null;
}
