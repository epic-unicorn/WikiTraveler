import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "WikiTraveler Node Registry",
  description: "Node discovery and registration service",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
