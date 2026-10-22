import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import { readSecret } from './utils/readSecret.js';

// Replaces only the password inside MONGODB_URI in server/.env, after a
// rotation in Atlas:
//   npm run env:set-db-password -w server
// The new password is typed or pasted at a hidden prompt, tested against the
// database first, and written only if it signs in as the same user. Scheme,
// user, hosts, database name and options stay exactly as they were, and the
// password is never printed. `--file <path>` targets a different env file.

const MONGO_URI_PATTERN = /^(mongodb(?:\+srv)?:\/\/)([^:@/]+):([^@/]*)(@.*)$/;

async function main() {
  const fileFlag = process.argv.indexOf('--file');
  const envFile = path.resolve(fileFlag > -1 ? process.argv[fileFlag + 1] : path.join(__dirname, '..', '.env'));
  const text = fs.readFileSync(envFile, 'utf8');
  const eol = text.includes('\r\n') ? '\r\n' : '\n';
  const lines = text.split(/\r?\n/);
  const index = lines.findIndex((line) => /^\s*MONGODB_URI\s*=/.test(line));
  if (index === -1) throw new Error(`No MONGODB_URI line in ${envFile}`);

  const [, key, rawValue] = lines[index].match(/^(\s*MONGODB_URI\s*=\s*)(.*)$/)!;
  const quote = /^["']/.test(rawValue) ? rawValue[0] : '';
  const uri = quote ? rawValue.slice(1, rawValue.lastIndexOf(quote)) : rawValue.trim();
  const parts = uri.match(MONGO_URI_PATTERN);
  if (!parts) throw new Error('MONGODB_URI has no user:password@ part to update');
  const [, scheme, user, , rest] = parts;
  const username = decodeURIComponent(user);
  const database = connectionDb(uri);

  console.log(`File:     ${envFile}`);
  console.log(`User:     ${username}`);
  console.log(`Database: ${database}`);
  const password = await readSecret(`New password for ${username} (hidden): `);
  if (!password) throw new Error('No password entered; nothing changed.');

  const updated = `${scheme}${user}:${encodeURIComponent(password)}${rest}`;
  console.log('Testing the new password against the database...');
  const client = new mongoose.mongo.MongoClient(updated, { serverSelectionTimeoutMS: 20000 });
  try {
    await client.connect();
    const status = await client.db('admin').command({ connectionStatus: 1 });
    const signedIn: string[] = (status.authInfo?.authenticatedUsers ?? []).map((u: { user: string }) => u.user);
    if (!signedIn.includes(username)) {
      throw new Error(`Connected, but not signed in as ${username}; nothing changed.`);
    }
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`The new password did not work (${reason}). ${path.basename(envFile)} was NOT changed.`);
  } finally {
    await client.close();
  }

  lines[index] = `${key}${quote}${updated}${quote}`;
  fs.writeFileSync(envFile, lines.join(eol));
  console.log(`✓ Password for ${username} updated in ${path.basename(envFile)}; nothing else in the file changed.`);
  console.log('  Restart the API so it signs in with the new password.');
}

function connectionDb(uri: string): string {
  return new mongoose.mongo.MongoClient(uri).options.dbName;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
