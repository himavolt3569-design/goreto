import type { Metadata } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Goreto.store",
    template: "%s | Goreto.store",
  },
  description:
    "Fashion discovery, virtual try-on and cash on delivery across Nepal.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${playfair.variable} h-full antialiased`}
      // The inline script below adds the `js` class before hydration.
      suppressHydrationWarning
    >
      <head>
        {/* Marks JS as available before first paint so GSAP reveal targets
            ([data-animate]) start hidden only when they will be animated in. */}
        <script
          dangerouslySetInnerHTML={{
            __html: "document.documentElement.classList.add('js')",
          }}
        />
      </head>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
