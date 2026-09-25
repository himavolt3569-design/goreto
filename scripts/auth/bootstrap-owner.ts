/**
 * Makes one Clerk user the store owner (AGENTS §9.2). Trusted, server-only:
 * the browser can never assign `owner`.
 *
 *   npm run owner:bootstrap -- --email you@example.com
 *   npm run owner:bootstrap -- --user-id user_...
 *   add --dry-run            show the target and current owner, change nothing
 *   add --replace-existing   transfer ownership from the current owner (demoted to customer)
 *
 * Looks the user up with the Clerk Backend API (CLERK_SECRET_KEY), requires a
 * verified primary email, syncs their profile, then promotes them in one
 * transaction (`bootstrap_owner`). There is one active owner at a time; a
 * second run for the same user changes nothing. Keys are never printed.
 */
import { profileInputFromClerkUser, type ClerkProfileInput } from "../../src/lib/auth/clerk-user.ts";
import { createServiceClient, targetHost } from "../seed/lib/env.ts";

const CLERK_API = "https://api.clerk.com/v1";

type Args = { email?: string; userId?: string; dryRun: boolean; replaceExisting: boolean };

function parseArgs(argv: string[]): Args {
  const value = (flag: string) => {
    const index = argv.indexOf(flag);
    return index === -1 ? undefined : argv[index + 1];
  };
  const args: Args = {
    email: value("--email")?.trim().toLowerCase(),
    userId: value("--user-id")?.trim(),
    dryRun: argv.includes("--dry-run"),
    replaceExisting: argv.includes("--replace-existing"),
  };
  if (!args.email === !args.userId) {
    throw new Error("Pass exactly one of --email <address> or --user-id <user_...>.");
  }
  return args;
}

function clerkSecretKey(): string {
  const key = process.env.CLERK_SECRET_KEY;
  if (!key) throw new Error("CLERK_SECRET_KEY is not set. Run `clerk env pull` (see .env.example).");
  return key;
}

/** `sk_test_` keys belong to a development instance, `sk_live_` to production. */
function clerkInstanceLabel(): string {
  return clerkSecretKey().startsWith("sk_live_") ? "production" : "development";
}

async function clerkGet(path: string): Promise<unknown> {
  const response = await fetch(`${CLERK_API}${path}`, {
    headers: { Authorization: `Bearer ${clerkSecretKey()}` },
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Clerk API ${path.split("?")[0]} failed with HTTP ${response.status}`);
  return response.json();
}

async function findClerkUser(args: Args): Promise<ClerkProfileInput> {
  let user: unknown;
  if (args.userId) {
    user = await clerkGet(`/users/${encodeURIComponent(args.userId)}`);
    if (!user) throw new Error(`No Clerk user ${args.userId}.`);
  } else {
    const users = await clerkGet(`/users?email_address=${encodeURIComponent(args.email!)}`);
    if (!Array.isArray(users) || users.length !== 1) {
      throw new Error(`Expected exactly one Clerk user with that email, found ${Array.isArray(users) ? users.length : 0}.`);
    }
    user = users[0];
  }

  const parsed = profileInputFromClerkUser(user);
  if (!parsed.ok) throw new Error(`Unexpected Clerk user shape (${parsed.error}).`);
  if (!parsed.input.email) {
    throw new Error("That Clerk user has no verified primary email. Verify it in Clerk first.");
  }
  if (args.email && parsed.input.email !== args.email) {
    throw new Error("The matched Clerk user's primary email differs from --email; use --user-id to be explicit.");
  }
  return parsed.input;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const client = createServiceClient();

  const target = await findClerkUser(args);
  console.log(`Supabase:  ${targetHost()}`);
  console.log(`Clerk:     ${clerkInstanceLabel()} instance`);
  console.log(`New owner: ${target.clerkUserId} (${target.email})`);

  const { data: owners, error: ownersError } = await client
    .from("profiles")
    .select("clerk_user_id, email")
    .eq("role", "owner")
    .is("deleted_at", null);
  if (ownersError) throw new Error(`Could not read the current owner: ${ownersError.message}`);
  const current = (owners ?? []) as { clerk_user_id: string; email: string | null }[];
  console.log(
    `Current:   ${current.length ? current.map((o) => `${o.clerk_user_id} (${o.email ?? "no email"})`).join(", ") : "none"}`,
  );

  if (current.some((owner) => owner.clerk_user_id === target.clerkUserId)) {
    console.log("Already the owner. Nothing to do.");
    return;
  }
  const blocked = current.length > 0 && !args.replaceExisting;
  if (args.dryRun) {
    console.log(
      blocked
        ? "Dry run: would refuse (another owner is active; add --replace-existing)."
        : "Dry run: would promote. No changes made.",
    );
    return;
  }
  if (blocked) {
    throw new Error("Another owner is active. Re-run with --replace-existing to transfer ownership.");
  }

  const { error: syncError } = await client.rpc("sync_clerk_profile", {
    p_clerk_user_id: target.clerkUserId,
    p_email: target.email,
    p_full_name: target.fullName,
    p_phone_e164: target.phoneE164,
    p_clerk_updated_at: target.clerkUpdatedAt.toISOString(),
  });
  if (syncError) throw new Error(`Profile sync failed: ${syncError.message}`);

  const { error: promoteError } = await client.rpc("bootstrap_owner", {
    p_clerk_user_id: target.clerkUserId,
    p_replace_existing: args.replaceExisting,
  });
  if (promoteError) throw new Error(`Promotion failed: ${promoteError.message}`);

  console.log(
    current.length
      ? `Done. ${target.clerkUserId} is the owner; ${current[0].clerk_user_id} is now a customer.`
      : `Done. ${target.clerkUserId} is the owner.`,
  );
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
