import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ||
      "https://llm-powered-failure-analyzer.vercel.app",
  ),
  title: {
    default: "Causelab — Understand agent failures",
    template: "%s · Causelab",
  },
  description:
    "Inspect agent traces, investigate failures, and test better behavior. An independent AI engineering project by Matías Sepúlveda.",
  icons: { icon: "/causelab.svg" },
  openGraph: {
    title: "Causelab — Understand agent failures. Test better behavior.",
    description: "A three-minute interactive AI reliability demo.",
    images: [{ url: "/opengraph-image", width: 1200, height: 630 }],
  },
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
