# Run Goreto on Windows

Use PowerShell from the repository folder. This setup was verified with Node.js
24.20.0 and npm 11.19.0. The repository's utility scripts run TypeScript directly
with Node, so use Node 24 for the full toolchain.

```powershell
Set-Location Q:\Work\goreto\goreto-project
npm.cmd ci
npm.cmd run dev -- --hostname localhost
```

Open http://localhost:3000. Stop the server with Ctrl+C.

Use `npm.cmd` and `npx.cmd` in PowerShell if it reports that `npm.ps1` cannot run
because scripts are disabled. No execution-policy change is necessary.

## Configuration

Keep the existing `.env.local`. On a fresh checkout, copy `.env.example` to
`.env.local` and supply the development Clerk and Supabase values. Never commit
credentials. See [releasing.md](releasing.md) for the environment separation.

Internet access is required for Clerk, the hosted Supabase project, and the
Poppins download during a clean Next.js build. Use the same `localhost` hostname
in the server command and browser when testing authentication.

No separate dependency install is needed inside `scripts/`; their package files
only declare module boundaries. Docker is not required for the existing database
test suite, which uses an isolated in-memory PGlite database.

## Verification

```powershell
npm.cmd ls --depth=0
npm.cmd run typecheck
npm.cmd run lint
npm.cmd test
npm.cmd run test:db
npm.cmd run build
```

On a fresh checkout, if typecheck reports missing generated Next.js route types,
run `npx.cmd next typegen` first.

`build` uses production environment precedence, including `.env.production.local`
if present. Development uses `.env.local`. Do not run migration, seed, or owner
bootstrap commands merely to install dependencies.

## GitHub and Vercel

The repository is `himavolt3569-design/goreto`. The current courier work belongs
on `feat/daraz-courier`; the default integration branch is
`feat/design-system-homepage`. Vercel's existing Git integration deploys feature
branches as previews and `production` to the live store.

Keep this work on a preview until the database migrations and courier provider
configuration in [releasing.md](releasing.md) have been verified in the target
environment. Do not auto-merge the branch into production. Never give a preview
the live courier credentials.

The locked dependency installation reported 10 npm audit findings on 2026-10-08
(1 moderate, 8 high, 1 critical). Some affect runtime dependencies, including
Next.js; the critical finding is in the development geography tooling's xmldom
dependency. Review and test dependency fixes separately before a production
release; `npm audit fix --force` proposes incompatible package changes.
