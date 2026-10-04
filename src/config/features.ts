/**
 * Switches for storefront features that are linked from the UI but not built
 * yet. They show in `next dev` and Vercel preview deployments and are hidden in
 * every production build, so a missing variable can never expose them on the
 * live site. `NEXT_PUBLIC_VERCEL_ENV` is set by Vercel itself.
 *
 * When a feature ships, delete its flag and its checks; don't flip it to true.
 */

export type FeatureEnv = { nodeEnv?: string; vercelEnv?: string };

export function showUnfinishedFeatures({ nodeEnv, vercelEnv }: FeatureEnv): boolean {
  return nodeEnv === "development" || vercelEnv === "preview";
}

const showUnfinished = showUnfinishedFeatures({
  nodeEnv: process.env.NODE_ENV,
  vercelEnv: process.env.NEXT_PUBLIC_VERCEL_ENV,
});

export const features = {
  /** The /try-on hub and the entry points that lead to it. */
  arTryOn: showUnfinished,
  /** The /offers page. */
  offers: showUnfinished,
  /** /help, /about, /privacy, /terms and /cookies. */
  infoPages: showUnfinished,
} as const;

export type FeatureName = keyof typeof features;
