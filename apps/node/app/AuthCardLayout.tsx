import { WikiTravelerLogo } from "@wikitraveler/ui";

export function AuthCardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
    >
      <div style={{ width: "100%", maxWidth: 420 }}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <WikiTravelerLogo product="node" size={36} />
        </div>
        {children}
      </div>
    </div>
  );
}

export function AuthCard({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        background: "var(--wt-bg-elevated)",
        borderRadius: "var(--wt-radius-lg)",
        border: "1px solid var(--wt-border)",
        padding: "36px 32px",
        boxShadow: "var(--wt-shadow)",
      }}
    >
      {children}
    </div>
  );
}
