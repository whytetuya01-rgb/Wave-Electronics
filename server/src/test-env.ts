import { spawn, ChildProcess } from 'child_process';
import {
  resolveJwtSecret,
  resolveMongoUri,
  resolveCorsOrigins,
  validateProductionEnv,
  EnvironmentConfigError,
} from './config/env.js';

// Production Security & Environment Configuration tests. Two layers, same
// style as test-api.ts/test-pdf.ts: pure-function tests against the
// exported resolvers (fast, precise error messages, no process needed),
// plus real subprocess/HTTP tests that spawn the actual server.ts to verify
// what the task cares about end-to-end - a misconfigured production
// deployment really does refuse to start, and a restricted CORS origin
// really does get rejected at the HTTP layer, not just in a unit test.

let checks = 0;
const failures: string[] = [];

function assert(cond: boolean, label: string, detail?: unknown) {
  checks++;
  if (!cond) {
    failures.push(`${label}${detail ? ' :: ' + JSON.stringify(detail) : ''}`);
    console.log(`  ✗ FAIL: ${label}${detail ? ' :: ' + JSON.stringify(detail) : ''}`);
  } else {
    console.log(`  ✓ ${label}`);
  }
}

function expectThrows(fn: () => void, label: string) {
  try {
    fn();
    assert(false, label, 'expected EnvironmentConfigError, nothing was thrown');
  } catch (e) {
    assert(e instanceof EnvironmentConfigError, label, `expected EnvironmentConfigError, got: ${e}`);
  }
}

async function runPureFunctionTests() {
  console.log('====================================================');
  console.log('   PRODUCTION ENV CONFIG - PURE FUNCTION TESTS');
  console.log('====================================================\n');

  console.log('[Test 1]: JWT_SECRET - production requires a strong, explicit secret');
  expectThrows(() => resolveJwtSecret({ NODE_ENV: 'production' }), 'Missing JWT_SECRET in production throws');
  expectThrows(
    () => resolveJwtSecret({ NODE_ENV: 'production', JWT_SECRET: 'too_short' }),
    'JWT_SECRET shorter than 32 chars in production throws'
  );
  const strongSecret = 'a'.repeat(40);
  const resolved = resolveJwtSecret({ NODE_ENV: 'production', JWT_SECRET: strongSecret });
  assert(resolved === strongSecret, 'A sufficiently long JWT_SECRET in production is accepted as-is');
  const devSecret = resolveJwtSecret({ NODE_ENV: 'development' });
  assert(typeof devSecret === 'string' && devSecret.length > 0, 'Development without JWT_SECRET falls back to a dev-only value, does not throw');
  console.log('');

  console.log('[Test 2]: MONGODB_URI - production requires it to be explicitly set');
  expectThrows(() => resolveMongoUri({ NODE_ENV: 'production' }), 'Missing MONGODB_URI in production throws');
  const prodUri = resolveMongoUri({ NODE_ENV: 'production', MONGODB_URI: 'mongodb://real-host/db?replicaSet=rs0' });
  assert(prodUri === 'mongodb://real-host/db?replicaSet=rs0', 'An explicitly configured MONGODB_URI in production is returned as-is');
  const devUri = resolveMongoUri({ NODE_ENV: 'development' });
  assert(devUri.includes('127.0.0.1'), 'Development without MONGODB_URI falls back to a local default, does not throw');
  console.log('');

  console.log('[Test 3]: CORS_ORIGIN - production requires at least one explicit trusted origin');
  expectThrows(() => resolveCorsOrigins({ NODE_ENV: 'production' }), 'Missing CORS_ORIGIN in production throws');
  const prodOrigins = resolveCorsOrigins({ NODE_ENV: 'production', CORS_ORIGIN: 'https://app.example.com, https://admin.example.com' });
  assert(
    Array.isArray(prodOrigins) && prodOrigins.length === 2 && prodOrigins[0] === 'https://app.example.com',
    'A comma-separated CORS_ORIGIN list in production is parsed into an explicit array',
    prodOrigins
  );
  const devOrigins = resolveCorsOrigins({ NODE_ENV: 'development' });
  assert(devOrigins === true, 'Development without CORS_ORIGIN preserves the previous unrestricted (allow-all) behavior');
  const devOverride = resolveCorsOrigins({ NODE_ENV: 'development', CORS_ORIGIN: 'http://localhost:3000' });
  assert(Array.isArray(devOverride) && devOverride[0] === 'http://localhost:3000', 'Development can still opt into a restricted CORS_ORIGIN if explicitly set');
  console.log('');

  console.log('[Test 4]: validateProductionEnv - fails on the first missing/weak value, passes when all three are valid');
  expectThrows(() => validateProductionEnv({ NODE_ENV: 'production' }), 'All three missing in production throws');
  expectThrows(
    () => validateProductionEnv({ NODE_ENV: 'production', JWT_SECRET: strongSecret }),
    'JWT_SECRET valid but MONGODB_URI missing in production still throws'
  );
  expectThrows(
    () =>
      validateProductionEnv({
        NODE_ENV: 'production',
        JWT_SECRET: strongSecret,
        MONGODB_URI: 'mongodb://real-host/db?replicaSet=rs0',
      }),
    'JWT_SECRET and MONGODB_URI valid but CORS_ORIGIN missing in production still throws'
  );
  // No throw expected when all three are valid.
  validateProductionEnv({
    NODE_ENV: 'production',
    JWT_SECRET: strongSecret,
    MONGODB_URI: 'mongodb://real-host/db?replicaSet=rs0',
    CORS_ORIGIN: 'https://app.example.com',
  });
  assert(true, 'validateProductionEnv does not throw when all three are properly configured');
  console.log('');
}

async function waitForServer(baseUrl: string, timeoutMs = 15000): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${baseUrl}/api/health`);
      if (res.ok) return true;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  return false;
}

function spawnServer(env: Record<string, string | undefined>): ChildProcess {
  return spawn('npx', ['tsx', 'src/server.ts'], {
    cwd: process.cwd(),
    env: { ...process.env, ...env },
    stdio: 'pipe',
    shell: process.platform === 'win32',
  });
}

async function waitForExit(proc: ChildProcess, timeoutMs = 8000): Promise<number | null> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(undefined as unknown as number | null), timeoutMs);
    proc.on('exit', (code) => {
      clearTimeout(timer);
      resolve(code);
    });
  });
}

async function runStartupFailureTests() {
  console.log('====================================================');
  console.log('   PRODUCTION STARTUP - REAL SUBPROCESS TESTS');
  console.log('====================================================\n');

  const basePort = process.env.ENV_TEST_SERVER_PORT || '5092';

  console.log('[Test 5]: Server refuses to start in production with no JWT_SECRET/MONGODB_URI/CORS_ORIGIN set');
  {
    // Empty string, not undefined: Node's child_process drops undefined-valued
    // keys entirely, which would let dotenv.config() (run inside server.ts)
    // silently fill the gap from the real server/.env file on this machine.
    // An explicit empty string IS present in the child's process.env, so
    // dotenv leaves it alone, and resolveJwtSecret() correctly treats it as
    // "not set".
    const proc = spawnServer({ NODE_ENV: 'production', PORT: basePort, JWT_SECRET: '', MONGODB_URI: '', CORS_ORIGIN: '' });
    let stderr = '';
    proc.stderr?.on('data', (d) => (stderr += d.toString()));
    const code = await waitForExit(proc);
    assert(code === 1, 'Process exits with code 1 (not left hanging, not a crash with a different code)', { code });
    assert(stderr.includes('[FATAL]') && stderr.includes('JWT_SECRET'), 'stderr contains a clear [FATAL] message naming JWT_SECRET', { stderr });
    try {
      proc.kill();
    } catch {
      /* already exited */
    }
  }
  console.log('');

  console.log('[Test 6]: Server refuses to start in production with a weak JWT_SECRET even if other vars are set');
  {
    const proc = spawnServer({
      NODE_ENV: 'production',
      PORT: basePort,
      JWT_SECRET: 'short',
      MONGODB_URI: 'mongodb://127.0.0.1:27017/does-not-matter',
      CORS_ORIGIN: 'https://app.example.com',
    });
    let stderr = '';
    proc.stderr?.on('data', (d) => (stderr += d.toString()));
    const code = await waitForExit(proc);
    assert(code === 1, 'Process exits with code 1 for a too-short JWT_SECRET');
    assert(stderr.includes('[FATAL]') && stderr.toLowerCase().includes('too short'), 'stderr clearly explains the secret is too short', { stderr });
    try {
      proc.kill();
    } catch {
      /* already exited */
    }
  }
  console.log('');

  console.log('[Test 7]: Server refuses to start in production with no CORS_ORIGIN even if JWT_SECRET/MONGODB_URI are valid');
  {
    const proc = spawnServer({
      NODE_ENV: 'production',
      PORT: basePort,
      JWT_SECRET: 'a'.repeat(40),
      MONGODB_URI: 'mongodb://127.0.0.1:27017/does-not-matter',
      CORS_ORIGIN: '',
    });
    let stderr = '';
    proc.stderr?.on('data', (d) => (stderr += d.toString()));
    const code = await waitForExit(proc);
    assert(code === 1, 'Process exits with code 1 for missing CORS_ORIGIN');
    assert(stderr.includes('[FATAL]') && stderr.includes('CORS_ORIGIN'), 'stderr contains a clear [FATAL] message naming CORS_ORIGIN', { stderr });
    try {
      proc.kill();
    } catch {
      /* already exited */
    }
  }
  console.log('');
}

async function runCorsRejectionTests() {
  console.log('====================================================');
  console.log('   CORS RESTRICTION - LIVE HTTP TESTS');
  console.log('====================================================\n');

  const port = process.env.ENV_TEST_SERVER_PORT || '5091';
  const baseUrl = `http://localhost:${port}`;
  const trustedOrigin = 'https://trusted.example.com';
  const untrustedOrigin = 'https://untrusted-attacker.example.com';

  // NODE_ENV deliberately left as development here (no real replica-set
  // Mongo needed for this check) - CORS_ORIGIN restriction applies the same
  // way regardless of NODE_ENV once explicitly set, by design (so it can
  // also be opted into in development/staging).
  const proc = spawnServer({
    NODE_ENV: 'development',
    PORT: port,
    CORS_ORIGIN: trustedOrigin,
    MONGODB_URI: process.env.MONGODB_URI,
  });

  try {
    const up = await waitForServer(baseUrl);
    assert(up, 'Server starts successfully with a restricted CORS_ORIGIN configured');
    if (!up) return;

    console.log('[Test 8]: Trusted origin is reflected in Access-Control-Allow-Origin');
    const trustedRes = await fetch(`${baseUrl}/api/health`, { headers: { Origin: trustedOrigin } });
    const trustedHeader = trustedRes.headers.get('access-control-allow-origin');
    assert(trustedHeader === trustedOrigin, 'Access-Control-Allow-Origin matches the trusted origin', { trustedHeader });
    console.log('');

    console.log('[Test 9]: Untrusted origin is NOT reflected - CORS rejects it');
    const untrustedRes = await fetch(`${baseUrl}/api/health`, { headers: { Origin: untrustedOrigin } });
    const untrustedHeader = untrustedRes.headers.get('access-control-allow-origin');
    assert(
      untrustedHeader !== untrustedOrigin,
      'Access-Control-Allow-Origin does NOT reflect the untrusted origin (browser would block the response)',
      { untrustedHeader }
    );
    console.log('');
  } finally {
    proc.kill();
  }
}

async function main() {
  await runPureFunctionTests();
  await runStartupFailureTests();
  await runCorsRejectionTests();

  console.log('====================================================');
  console.log(`   ${checks - failures.length}/${checks} CHECKS PASSED`);
  if (failures.length > 0) {
    console.log(`   ${failures.length} FAILURES:`);
    failures.forEach((f) => console.log('   - ' + f));
  }
  console.log('====================================================');

  process.exit(failures.length > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('Environment config test failed:', err);
  process.exit(1);
});
