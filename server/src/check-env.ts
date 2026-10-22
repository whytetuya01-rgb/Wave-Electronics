import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import { isDisposableDatabase } from './config/databaseSafety.js';

const { MongoClient } = mongoose.mongo;

// Prints which database and settings this machine's server would use, with
// every secret masked (passwords and JWT_SECRET are never printed):
//   npm run env:check -w server
// With --roles it also connects and asks MongoDB which roles the database
// user has. That is a read-only command: nothing is written, no models or
// indexes are loaded.

const MONGO_URI_PATTERN = /^(mongodb(?:\+srv)?):\/\/(?:([^:@/]*)(?::([^@/]*))?@)?([^/?]+)(?:\/([^?]*))?(?:\?(.*))?$/;

function mask(value: string): string {
  return value.length <= 2 ? '**' : `${value.slice(0, 2)}${'*'.repeat(Math.min(value.length - 2, 6))}`;
}

async function main() {
  const uri = process.env.MONGODB_URI?.trim();
  console.log('server/.env');
  console.log(`  NODE_ENV      ${process.env.NODE_ENV || '(not set - development)'}`);
  console.log(`  PORT          ${process.env.PORT || '(not set - 5000)'}`);

  if (!uri) {
    console.log('  MONGODB_URI   (not set - local mongodb://127.0.0.1:27017/wave_electronics_dev)');
  } else {
    const parts = uri.match(MONGO_URI_PATTERN);
    if (!parts) {
      console.log('  MONGODB_URI   set, but not in a recognised mongodb:// or mongodb+srv:// format');
    } else {
      const [, scheme, user, password, hosts, database, query] = parts;
      const name = database || 'test';
      const firstHost = hosts.split(',')[0].split(':')[0];
      const options = query ? query.split('&').map((pair) => pair.split('=')[0]).join(', ') : 'none';
      console.log(`  MONGODB_URI   ${scheme}://${user ? mask(decodeURIComponent(user)) : '(no user)'}:${password ? '<password set, hidden>' : '(no password)'}@${hosts}/${name}`);
      console.log(`                options: ${options}`);
      console.log(`  Database      "${name}"${database ? '' : ' (no name in the URI, so MongoDB uses "test")'}`);
      if (name === 'wave_electronics') {
        console.log('  !! This is the PRODUCTION database. Local development must use wave_electronics_dev.');
      } else if (isDisposableDatabase(name, firstHost)) {
        console.log('  OK            a development/test database: local development may use it.');
      } else {
        console.log('  !! Not a development database: a local development server refuses it.');
      }
    }
  }

  const jwt = process.env.JWT_SECRET;
  console.log(`  JWT_SECRET    ${jwt ? `set, ${jwt.length} characters${jwt.length < 32 ? ' (too short for production)' : ''}` : '(not set - development fallback)'}`);
  console.log(`  CORS_ORIGIN   ${process.env.CORS_ORIGIN || '(not set - all origins allowed in development)'}`);
  for (const key of ['COMPANY_ADDRESS', 'COMPANY_GSTIN', 'COMPANY_LOGO_PATH']) {
    console.log(`  ${key.padEnd(13)} ${process.env[key] ? 'set' : '(not set)'}`);
  }

  if (process.argv.includes('--roles') && uri) {
    const client = new MongoClient(uri, { serverSelectionTimeoutMS: 15000 });
    try {
      await client.connect();
      const status = await client.db('admin').command({ connectionStatus: 1 });
      const roles: { role: string; db: string }[] = status.authInfo?.authenticatedUserRoles ?? [];
      console.log('\nDatabase user roles (read-only check)');
      console.log(`  ${roles.length ? roles.map((r) => `${r.role} on ${r.db}`).join('\n  ') : '(none reported)'}`);
      const broad = roles.filter((r) => ['atlasAdmin', 'readWriteAnyDatabase', 'dbAdminAnyDatabase', 'root', 'clusterAdmin'].includes(r.role));
      if (broad.length) {
        console.log('  !! This user can reach every database, production included. Give each environment its own');
        console.log('     user limited to its own database (DEPLOYMENT.md, Part 2).');
      }
    } finally {
      await client.close();
    }
  }
}

main().catch((error) => {
  console.error('env:check failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
