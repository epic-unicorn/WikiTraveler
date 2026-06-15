import type { ReactNode } from "react";

interface Props {
  header: ReactNode;
  children: ReactNode;
  maxWidth?: number;
}

export function AppShell({ header, children, maxWidth = 960 }: Props) {
  return (
    <div style={{ minHeight: "100vh", background: "var(--wt-bg)" }}>
      <a href="#main-content" className="wt-skip-link">
        Skip to main content
      </a>
      {header}
      <main
        id="main-content"
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
