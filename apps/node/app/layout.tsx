import type { Metadata } from "next";
import "./globals.css";
import "@wikitraveler/ui/tokens.css";
import "leaflet/dist/leaflet.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "WikiTraveler Node",
  description: "Distributed Travel Truth Layer — Accessibility Node",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
