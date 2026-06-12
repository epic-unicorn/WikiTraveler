import type { ReactNode } from "react";

interface Props {
  header: ReactNode;
  children: ReactNode;
  maxWidth?: number;
}

export function AppShell({ header, children, maxWidth = 960 }: Props) {
  return (
    <div style={{ minHeight: "100vh", background: "var(--wt-bg)" }}>
      {header}
      <main
        style={{
          maxWidth,
          margin: "0 auto",
          padding: "24px 20px 48px",
        }}
      >
        {children}
      </main>
    </div>
  );
}
