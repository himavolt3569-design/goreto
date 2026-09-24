import { Logo } from "@/components/ui";

/** Centred auth surface for Clerk's sign-in and sign-up components. */
export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <main
      id="main"
      className="flex flex-1 flex-col items-center gap-8 bg-neutral-50 px-4 py-12 md:py-16"
    >
      <Logo href="/" />
      {children}
    </main>
  );
}
