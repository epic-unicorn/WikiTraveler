import type { Metadata } from "next";
import "./globals.css";

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
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
