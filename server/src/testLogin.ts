// The admin login the seed script created, for test scripts that sign in.
// Read from the same variables the seed used, so there is no default
// password in the code for anyone to find.
export function seededAdminLogin(): { email: string; password: string } {
  const email = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!email || !password) {
    throw new Error('Set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD to the admin login the seed script created.');
  }
  return { email, password };
}
