import mongoose from 'mongoose';
import { resolveMongoUri } from './env.js';

// Database names that mark a disposable copy: safe to seed, wipe, and run the
// write-heavy test scripts against. The production database must not use any
// of these (production is `wave_electronics`, preview `wave_electronics_preview`,
// local development `wave_electronics_dev`).
const DISPOSABLE_SUFFIXES = ['_preview', '_dev', '_test'];
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);

export function isDisposableDatabase(name: string, host: string): boolean {
  return DISPOSABLE_SUFFIXES.some((suffix) => name.endsWith(suffix)) || LOCAL_HOSTS.has(host);
}

// The database name and first host a connection string points at, read
// without connecting. Every guard runs on this BEFORE connecting: once
// Mongoose connects it starts creating collections and indexes, so checking
// afterwards would already have touched a refused database.
export function connectionTarget(uri: string): { name: string; host: string } {
  const { options } = new mongoose.mongo.MongoClient(uri);
  return { name: options.dbName, host: options.srvHost ?? options.hosts[0]?.host ?? '' };
}

// Stops a script that deletes or writes test data (seed, regression tests)
// before it connects to a database that may hold real data.
export function assertDisposableDatabase(purpose: string, uri: string = resolveMongoUri()): void {
  const { name, host } = connectionTarget(uri);
  if (!isDisposableDatabase(name, host)) {
    throw new Error(
      `${purpose} refuses to run against database "${name}" on ${host}: it writes or deletes data. ` +
        `Point MONGODB_URI at a database whose name ends in ${DISPOSABLE_SUFFIXES.join(', ')}, or at a local MongoDB.`
    );
  }
}

// Keeps each environment on its own data, so a mis-pasted MONGODB_URI is
// refused before connecting instead of letting testing write to production:
// - Vercel Preview: only a *_preview database.
// - Vercel Production: never a disposable (*_preview/_dev/_test) database.
// - Anywhere else without NODE_ENV=production (local development, tests,
//   `vercel dev`): only a disposable or local database - never production.
// The Atlas users (one per database) are the main barrier; this is the second
// one. Returns the problem, or null.
export function environmentDatabaseMismatch(
  name: string,
  host: string,
  env: NodeJS.ProcessEnv = process.env
): string | null {
  if (env.VERCEL_ENV === 'preview') {
    return name.endsWith('_preview')
      ? null
      : `Preview deployments only use a database whose name ends in _preview; MONGODB_URI names "${name}".`;
  }
  if (env.VERCEL_ENV === 'production') {
    return DISPOSABLE_SUFFIXES.some((suffix) => name.endsWith(suffix))
      ? `Production must not use a disposable database; MONGODB_URI names "${name}".`
      : null;
  }
  if (env.NODE_ENV !== 'production' && !isDisposableDatabase(name, host)) {
    return (
      `Development only uses a database whose name ends in ${DISPOSABLE_SUFFIXES.join(', ')} ` +
      `(e.g. wave_electronics_dev) or a local MongoDB; MONGODB_URI names "${name}" on ${host}.`
    );
  }
  return null;
}
