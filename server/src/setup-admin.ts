import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { User } from './models/User.js';
import { LEGACY_DEFAULT_PASSWORDS, passwordPolicyError } from './utils/passwordPolicy.js';

// Sets up an admin login on any database, production included:
//   npm run admin:setup -w server
// with MONGODB_URI, ADMIN_EMAIL, ADMIN_PASSWORD (12+ characters) and
// optionally ADMIN_NAME in the environment.
//
// - No user with that email: creates an active admin.
// - An admin with that email: sets the new password and re-activates it
//   (how a default password such as the old admin123 gets replaced).
// - Any other user with that email: refuses; change roles on the Users page.
//
// Never deletes anything. Afterwards it lists accounts still using one of the
// old seed passwords; reset those on the Users page. Deliberately does not
// read server/.env: the target database must be named on every run.
async function setupAdmin() {
  const mongoUri = process.env.MONGODB_URI;
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  const name = process.env.ADMIN_NAME?.trim() || 'Administrator';

  if (!mongoUri) throw new Error('Set MONGODB_URI to the database to set the admin up in.');
  if (!email) throw new Error('Set ADMIN_EMAIL to the admin login email address.');
  const passwordError = passwordPolicyError(password, email);
  if (passwordError) throw new Error(`ADMIN_PASSWORD: ${passwordError}.`);

  await mongoose.connect(mongoUri);
  // Name and host only: the URI itself contains the database password.
  console.log(`Connected to database "${mongoose.connection.name}" on ${mongoose.connection.host}`);

  const passwordHash = await bcrypt.hash(password as string, await bcrypt.genSalt(10));
  const existing = await User.findOne({ email });
  if (!existing) {
    await User.create({ name, email, passwordHash, role: 'admin', isActive: true });
    console.log(`✓ Created admin ${email}`);
  } else if (existing.role === 'admin') {
    existing.passwordHash = passwordHash;
    existing.isActive = true;
    await existing.save();
    console.log(`✓ Set a new password for admin ${email} (account active)`);
  } else {
    throw new Error(`${email} already exists with role "${existing.role}". Use a different email, or change the role on the Users page.`);
  }

  const stillDefault: string[] = [];
  for (const user of await User.find({ isActive: true })) {
    for (const legacy of LEGACY_DEFAULT_PASSWORDS) {
      if (await user.comparePassword(legacy)) {
        stillDefault.push(user.email);
        break;
      }
    }
  }
  if (stillDefault.length > 0) {
    console.log(`! Still using an old default password (reset these on the Users page): ${stillDefault.join(', ')}`);
  } else {
    console.log('✓ No active account uses an old default password');
  }
}

setupAdmin()
  .then(() => mongoose.disconnect())
  .catch(async (error) => {
    console.error('Admin setup failed:', error instanceof Error ? error.message : error);
    await mongoose.disconnect();
    process.exit(1);
  });
