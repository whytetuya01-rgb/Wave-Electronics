# Deploying Wave Electronics to Vercel

A step-by-step guide, written for someone doing this for the first time. Work through the parts in order. Parts 1–7 get a **Preview** deployment of the `feature/form-validation-toasts-dropdowns` branch running and tested. Part 8 lists what has to happen before **Production**. Nothing here deploys to Production.

**Ground rules**

- Production data lives in the Atlas database `wave_electronics`. Preview uses `wave_electronics_preview`. Each has its own database user and password.
- Never run the seed script, tests, or any reset against `wave_electronics`. The scripts refuse to, but don't rely on that.
- Never paste connection strings, passwords or secrets into the repository, chat, tickets or screenshots. They go in Vercel's environment variables, or into your own terminal for a one-off command.

---

## Part 1 – How the app runs on Vercel (read once)

One Vercel project serves two parts of the repository, configured in [`vercel.json`](vercel.json):

| Part | Folder | Handles |
|---|---|---|
| `server` | `server/` | The API. Every address starting with `/api/`. |
| `client` | `client/` | The web app. Every other address. |

Both share one web address, so the browser talks to the API at `/api` on the same site. A push to `main` creates a Production deployment. A push to any other branch creates a Preview deployment with its own web address. Node.js 22 is used automatically.

Built-in safety checks:

- A **Preview** deployment refuses to start unless its database name ends in `_preview`. **Production** refuses a database whose name ends in `_preview`, `_dev` or `_test`.
- The seed script and the test scripts only run against a database whose name ends in `_preview`, `_dev` or `_test`, or one on your own computer.
- In Production, an account whose password is a known default (such as the old `admin123`) can't sign in until an admin gives it a new password.
- `/api/health` is public and only says `{"status":"ok"}` (200) or `{"status":"unavailable"}` (503). Connection details only go to the Vercel logs, which only your team can see.

---

## Part 2 – MongoDB Atlas: one database user per environment

In [cloud.mongodb.com](https://cloud.mongodb.com), open the project that holds your cluster.

**2.1 Create the Preview database user**

1. Go to **Security → Database Access → Add New Database User**.
2. Authentication method: **Password**. Username: `wave_preview_app`.
3. Click **Autogenerate Secure Password**, then **Copy**. Keep it somewhere safe, such as a password manager. Generated passwords contain only letters and digits, so they work in a connection string as they are.
4. Under **Database User Privileges**, choose **Add Specific Privilege**: role `readWrite`, database `wave_electronics_preview`, collection left empty.
5. Click **Add User**.

This user can only read and write the Preview database. Even a mistake in Vercel can't reach production data with it.

**2.2 Create the Production database user**

Repeat 2.1 with username `wave_prod_app` and privilege `readWrite` on database `wave_electronics`. Don't reuse the user in your local `server/.env` file; that user may have wider rights.

**2.3 Network access (for testing)**

Vercel's servers have no fixed IP addresses. For the Preview testing phase:

1. Go to **Security → Network Access → Add IP Address**.
2. Choose **Allow Access from Anywhere** (`0.0.0.0/0`), add the comment `Vercel - temporary`, and confirm.

This is acceptable only because each user has a long generated password and access to one database only. Part 8 replaces it before Production.

**2.4 Build the two connection strings**

1. Go to **Database → Clusters → Connect → Drivers** and copy the string. It looks like:
   `mongodb+srv://<username>:<db_password>@cluster0.abcde.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`
2. Make two copies and fill them in:
   - **Preview:** username `wave_preview_app`, its password, and `wave_electronics_preview` between `.net/` and `?`:
     `mongodb+srv://wave_preview_app:PASSWORD@cluster0.abcde.mongodb.net/wave_electronics_preview?retryWrites=true&w=majority&appName=Cluster0`
   - **Production:** `wave_prod_app`, its password, and `wave_electronics`.

The database name in the string matters. It decides which database the app uses, and the safety checks read it.

---

## Part 3 – Fill the Preview database with demo data

The seed script **deletes everything** in the database it's pointed at, then adds demo categories, units, locations, components, vendors, one stock inward and one admin login. It refuses any database whose name doesn't end in `_preview`, `_dev` or `_test`.

Open **PowerShell** in the project folder (`C:\Project\wave-electronics`) and run these lines one at a time. `Read-Host` asks for the secret values, so they aren't saved in your PowerShell history.

```powershell
$env:MONGODB_URI = Read-Host "Paste the PREVIEW connection string"
$env:SEED_ADMIN_EMAIL = "your.name@yourcompany.com"
$env:SEED_ADMIN_PASSWORD = Read-Host "Choose the Preview admin password (12+ characters)"
npm run seed -w server
Remove-Item Env:MONGODB_URI, Env:SEED_ADMIN_EMAIL, Env:SEED_ADMIN_PASSWORD
```

Check the first line of the output. It must say `Connected to database "wave_electronics_preview"`. It ends with `SEED COMPLETE` and the admin email to sign in with. If it says it **refuses to run**, the connection string names the wrong database; fix it and run again.

Passwords must be at least 12 characters and not a common one (such as `Password1234`). This applies everywhere in the app.

---

## Part 4 – Connect GitHub to Vercel and create the project

Use the command line for this part. The dashboard's **Import Project** button starts a Production deployment of `main` straight away, which we don't want yet. These commands create the project without deploying anything.

1. Create a free account at [vercel.com](https://vercel.com/signup), choosing **Continue with GitHub**.
2. In PowerShell, in the project folder:
   ```powershell
   npx vercel@latest login
   ```
   Follow the prompts and approve the sign-in in your browser.
3. Create the project:
   ```powershell
   npx vercel@latest link
   ```
   Answer: set up this directory → **yes**; scope → your account or team; link to an existing project → **no**; project name → `wave-electronics`; code directory → `./` (the repository root, where `vercel.json` is). Accept the detected settings and don't change any build or output settings. If it offers to pull environment variables, answer **no**. This creates a `.vercel` folder, which git already ignores.
4. Connect the GitHub repository. If `link` offered to connect it, you're done. Otherwise, in the Vercel dashboard open the project → **Settings → Git → Connect Git Repository → GitHub** and pick `whytetuya01-rgb/Wave-Electronics`. The first time, GitHub asks you to install the **Vercel** app: choose **Only select repositories** and select `Wave-Electronics`.
5. Still in **Settings**:
   - **General → Root Directory** must be empty (the repository root).
   - **Environments → Production → Branch Tracking** should say `main`.
   - **Deployment Protection → Vercel Authentication** stays on. Previews then open only for people signed in to your Vercel team.

If a Production deployment of `main` starts anyway, open it under **Deployments** and use **⋯ → Cancel Deployment**. `main` doesn't contain the Vercel setup yet, so that deployment couldn't work anyway.

---

## Part 5 – Environment variables

Go to **Project → Settings → Environment Variables**. For each row: enter the **Key** and **Value**, tick only the environment named in the table, switch **Sensitive** on, and click **Save**.

**Preview** (tick only *Preview*)

| Key | Value |
|---|---|
| `MONGODB_URI` | The Preview connection string from 2.4 (ends in `/wave_electronics_preview?...`). |
| `JWT_SECRET` | A new random secret; see below. |
| `CORS_ORIGIN` | The branch address, e.g. `https://wave-electronics-git-feature-form-validation-toasts-dropdowns-yourteam.vercel.app`. Not known yet? Enter your Production address for now and correct it after Part 6. |

**Production** (tick only *Production*). You can add these now; nothing uses them until Production is approved.

| Key | Value |
|---|---|
| `MONGODB_URI` | The Production connection string (ends in `/wave_electronics?...`). |
| `JWT_SECRET` | A **different** new random secret. |
| `CORS_ORIGIN` | `https://wave-electronics.vercel.app` (the project's Production address, shown under **Settings → Domains**). Add a custom domain separated by a comma, e.g. `https://wave-electronics.vercel.app,https://stock.yourcompany.com`. |

Optional for both: `COMPANY_ADDRESS` and `COMPANY_GSTIN` are printed on the PDFs.

**Making a JWT secret.** Run this once per environment and paste the output into the value field:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Don't add** `NODE_ENV` or `PORT`; Vercel sets them. A different `JWT_SECRET` per environment means a sign-in on a Preview can never be used on Production.

**About `CORS_ORIGIN`.** It lists which *other* websites may call your API from a browser. Your own app calls the API on its own address and doesn't need it, so a slightly wrong value doesn't break the app. It must not be empty, though: the API refuses to start without it.

Changing a variable only affects **new** deployments. After editing one, redeploy (Part 6, step 3).

---

## Part 6 – Deploy the feature branch as a Preview

1. Vercel builds a Preview whenever the branch receives a new commit. To start the first one, run in the project folder:
   ```powershell
   git checkout feature/form-validation-toasts-dropdowns
   git pull
   git commit --allow-empty -m "chore: trigger Vercel preview"
   git push
   ```
2. In Vercel, open **Deployments**. The new deployment shows **Building**, then **Ready** after a few minutes. If it shows **Error**, open it and read the **Build Logs**.
3. Open the deployment and note its **Domains**. The address containing `-git-feature-...` is the branch address. If it differs from the `CORS_ORIGIN` you entered for Preview, update the variable, then use **⋯ → Redeploy** on the deployment.
4. Open the branch address and sign in with the admin email and password from Part 3.

---

## Part 7 – Test the Preview before any Production release

Everything here writes only to `wave_electronics_preview`.

**Health and logs**

- [ ] `https://<branch address>/api/health` shows exactly `{"status":"ok"}`.
- [ ] In the deployment's **Logs**, after the first page load: `[MongoDB Connected]: ... /wave_electronics_preview` (proves Preview uses the Preview database) and `[MongoDB Mode]: Replica Set (...) - ACID Transactions Active` (proves transactions are on). No `[FATAL]` lines.

**Sign-in and users**

- [ ] A wrong password shows "Invalid email or password".
- [ ] The admin from Part 3 signs in and lands on the Dashboard.
- [ ] **Users → Add User** with password `short` or `Password1234` is refused. A strong password works. Create a Store Keeper and a Production user and sign in as each.
- [ ] Refreshing the browser on a page such as `/jobs` reloads that page instead of showing an error.

**Day-to-day flow** (note the stock numbers before and after each step)

- [ ] Dashboard, Components, Vendors, Reports load without errors.
- [ ] Components: add a component; it appears in the list.
- [ ] Vendors: add a vendor (assembler).
- [ ] Stock Inward: record a goods inward; the component's stock goes up by that quantity.
- [ ] Circuits: a circuit with its BOM (bill of materials) exists, or create one.
- [ ] Jobs: create a job for that circuit and vendor.
- [ ] Approve the job: stock is reserved, and a shortage is reported if stock is too low.
- [ ] Issue material: a Delivery Challan is created; **download its PDF**.
- [ ] Record the job receipt (finished circuits and returned components); **download the Job Receipt PDF**.
- [ ] Close the job; component stock, the ledger and Finished Goods agree with what was issued and received.
- [ ] PDFs show the company name, address and GSTIN, and the logo once it's added (Part 8).

**Security spot checks**

- [ ] The login page has no "demo" buttons and no pre-filled accounts.
- [ ] After 20 wrong passwords within 15 minutes, sign-in is refused with "Too many login attempts", from any browser on the same network. Optional; it locks your own IP for 15 minutes.

Write down anything that fails, with the time and the page, and share it before going further.

---

## Part 8 – Before Production (needs your approval)

1. **Atlas network.** Replace `0.0.0.0/0` with fixed addresses. Vercel offers outbound **Static IPs**, and on Enterprise, **Secure Compute** (dedicated IPs plus private VPC peering with Atlas); check which your plan includes. Add those IPs under **Network Access** and delete the `0.0.0.0/0` entry. Better still, keep Preview in a separate Atlas project or cluster, so Preview networking can stay looser without affecting Production.
2. **Atlas hygiene.** Turn on backups for the production cluster, plus alerts for unusual connections. Give each person their own Atlas login with only the rights they need. Rotate a database password immediately if it's ever exposed.
3. **Replace default passwords in Production.** The production database still has the accounts created by the old seed script (`admin@wave.com` and others) with publicly known passwords. Production blocks those sign-ins, but replace the passwords so the accounts can be used. This **changes production data**, so do it only once Production is approved:
   ```powershell
   $env:MONGODB_URI = Read-Host "Paste the PRODUCTION connection string"
   $env:ADMIN_EMAIL = "admin@wave.com"
   $env:ADMIN_PASSWORD = Read-Host "New admin password (12+ characters)"
   npm run admin:setup -w server
   Remove-Item Env:MONGODB_URI, Env:ADMIN_EMAIL, Env:ADMIN_PASSWORD
   ```
   It sets a new password for that admin (or creates the admin if the email doesn't exist) and never deletes anything. It then lists any other account still on an old default password; sign in as the admin and use **Users → Reset Password** for each.
4. **Logo.** Add the company logo as `server/assets/company-logo.png` (PNG or JPEG, roughly square) and commit it. See [`server/assets/README.md`](server/assets/README.md).
5. **Production variables** from Part 5 are set (Production only).
6. **Release.** Merge the tested branch into `main`. Vercel then builds the Production deployment. Afterwards check `/api/health` and sign in, but don't create test records in Production.

---

## Reference

**Login rate limiting.** 20 attempts per 15 minutes per IP address, counted in MongoDB (`ratelimitcounters` collection) and shared by every server instance. MongoDB deletes old counters automatically.

**Local development.** `npm run dev:server` and `npm run dev:client`. Point `server/.env` at a development database, e.g. `wave_electronics_dev` on Atlas with its own `readWrite` user, or a local MongoDB. **Never point it at `wave_electronics`.**

**Running the regression tests.** They need a disposable database that's a replica set (for transactions); the four `test-*-safety.ts` files need a standalone (non-replica-set) one. Seed it first, then run each suite from `server/` on a freshly seeded database, because `test-api` uses up the demo stock that `test-pdf` needs:

```powershell
cd server
$env:MONGODB_URI = "mongodb://127.0.0.1:27017/wave_electronics_test?replicaSet=rs0"
$env:SEED_ADMIN_EMAIL = "qa-admin@example.test"
$env:SEED_ADMIN_PASSWORD = "any-long-test-password"
npm run seed
npx tsx src/test-api.ts
npm run seed
npx tsx src/test-pdf.ts
npx tsx src/test-env.ts
```
