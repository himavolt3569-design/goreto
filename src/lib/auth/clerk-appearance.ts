/**
 * Clerk component theme built from the Goreto design tokens (AGENTS §3).
 * Applied once on `ClerkProvider`; do not restyle Clerk elsewhere with ad-hoc
 * CSS. Variable names follow Clerk's `appearance.variables` reference.
 */
export const clerkAppearance = {
  variables: {
    colorPrimary: "#F97316", // primary-500
    colorPrimaryForeground: "#FFFFFF",
    colorForeground: "#0F172A", // neutral-900
    colorMutedForeground: "#64748B", // neutral-500
    colorMuted: "#F1F5F9", // neutral-100
    colorBackground: "#FFFFFF",
    colorInput: "#FFFFFF",
    colorInputForeground: "#0F172A",
    // Clerk draws borders at ~11% alpha of this base, so it takes the dark
    // neutral; on white that renders at about the neutral-200 field border.
    colorBorder: "#0F172A",
    colorRing: "#F97316",
    // Soft neutral-900 dim behind the sign-in/sign-up modals (no blur, §3.5).
    colorModalBackdrop: "rgba(15, 23, 42, 0.5)",
    colorDanger: "#EF4444", // error-500
    colorSuccess: "#22C55E", // success-500
    colorWarning: "#F59E0B", // warning-500
    colorNeutral: "#0F172A",
    fontFamily: "var(--font-inter), ui-sans-serif, system-ui, sans-serif",
    borderRadius: "12px", // md, the default control radius
  },
} as const;
