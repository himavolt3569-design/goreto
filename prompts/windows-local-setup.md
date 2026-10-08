# Windows local setup

## Goal and scope
Install the repository's locked npm dependencies and verify that the existing application runs on this Windows machine. The user requested dependency installation and local setup. Preserve existing uncommitted work, package versions, credentials, and application behavior. No feature development, remote database changes, seed loading, or deployment.

## Inspection and decisions
- Inspected AGENTS.md, package.json, package-lock.json, README.md, .env.example, docs/releasing.md, next.config.ts, tsconfig.json, ESLint/Vitest configuration, routing and script inventory, and Git status.
- Node v24.20.0 and npm 11.19.0 are installed. node_modules is absent; use npm.cmd because PowerShell blocks npm.ps1 under its current execution policy.
- Existing environment files are present; do not print or replace their secrets.
- Nested script package manifests establish module boundaries rather than separate dependency installations.
- Installed Next.js documentation is unavailable until installation; read the installation/CLI guides afterward.
- No UI reference work, component changes, schema changes, generated-type changes, or auth/RLS changes are expected. Specialist skills will be read if verification requires work in their domains.

## Expected changes
- This prompt, ignored node_modules/build/test artifacts, and a Windows setup guide at docs/windows-setup.md if useful.
- Keep package.json and package-lock.json unchanged; use npm.cmd ci.
- Any concrete compatibility fixes discovered will be documented before editing and limited to Windows setup.

## Checks and acceptance
1. Install using npm.cmd ci and verify npm.cmd ls --depth=0.
2. Read installed Next.js setup documentation and confirm native Windows dependencies load.
3. Run npm.cmd run typecheck, npm.cmd run lint, npm.cmd test, and npm.cmd run build. Inspect test:db before running to ensure it uses an isolated local database.
4. Start npm.cmd run dev on localhost and request the homepage and a public route. Record status and any runtime failures without disclosing credentials.
5. Report actual check results and remaining external-service requirements.

## Manual verification
1. Open PowerShell in Q:\Work\goreto\goreto-project.
2. Run npm.cmd run dev.
3. Open http://localhost:3000 and confirm storefront content loads.
4. Open a product, search, and cart; confirm navigation works. Sign in separately to verify the user's account access if desired.

## Security and rollback
Use existing development configuration for runtime checks. Builds may load .env.production.local per Next.js precedence; do not run mutating service operations. No migrations or remote data changes are authorized by this setup task. Stop the local server with Ctrl+C; installed dependencies are reproducible from the unchanged lockfile.

## Authorized GitHub follow-up
The user additionally authorized pushing the code and choosing the branch and Vercel behavior. Remote inspection confirms `origin` is himavolt3569-design/goreto, the default branch is feat/design-system-homepage, and the working branch is feat/daraz-courier. Preserve and commit the existing approved courier/send-and-track work on that branch, together with the Windows setup documentation. Exclude the unrelated VS Code prompt and all ignored credentials/artifacts. Use the existing Vercel preview integration; do not merge into production or apply remote migrations. The active GitHub account initially lacked write permission; the already-authenticated repository owner account has admin/push access.

## Verification results
- npm.cmd ci: 539 packages installed; locked versions retained.
- npm.cmd ls --depth=0, typecheck, lint: passed.
- npm.cmd test: 105 files, 780 tests passed.
- npm.cmd run test:db: 19 files, 354 tests passed using isolated PGlite.
- npm.cmd run build: passed after allowing network access for Google Fonts; 57 static pages generated.
- Read installed Next.js installation, CLI, and environment-variable docs, and the Supabase skill for isolated database verification.
- npm audit: 10 findings; documented for follow-up instead of changing framework versions during setup.
- Development server at http://localhost:3000: homepage, search, and cart returned HTTP 200 with storefront content. No interactive browser automation tool is configured, so signed-in/browser interaction checks remain manual.
- Removed one extra trailing blank line in the existing Daraz dashboard detected by the staged whitespace check; no application logic changed.
