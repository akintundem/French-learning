import type { Metadata, Viewport } from "next";
import { Newsreader, Source_Sans_3 } from "next/font/google";
import "./globals.css";

// Newsreader carries the French text; Source Sans handles UI chrome.
const display = Newsreader({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

const text = Source_Sans_3({
  subsets: ["latin"],
  variable: "--font-text",
  display: "swap",
});

const ICON =
  "data:image/svg+xml," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">` +
      `<rect width="64" height="64" rx="12" fill="#f5f3ee"/>` +
      `<text x="32" y="46" text-anchor="middle" font-family="Georgia,serif" ` +
      `font-size="42" fill="#b8583c">É</text></svg>`
  );

export const metadata: Metadata = {
  title: "Moses’s Space — French spelling practice",
  description:
    "Spell your way through 1,400 French words, A2 to B1. Accents and articles count.",
  icons: { icon: ICON, apple: ICON },
  appleWebApp: { capable: true, title: "Moses’s Space", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#f5f3ee",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${display.variable} ${text.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
