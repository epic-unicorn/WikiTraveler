"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface RecentItem {
  id: string;
  name: string;
  location: string;
  auditedAt: string;
}

export function RecentTab() {
  const [items, setItems] = useState<RecentItem[]>([]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("wt_recent_audits");
      if (stored) setItems(JSON.parse(stored));
    } catch {
      /* ignore */
    }
  }, []);

  if (items.length === 0) {
    return (
      <div className="fk-empty" style={{ paddingTop: 48 }}>
        <span className="fk-empty-icon">📋</span>
        <p className="fk-empty-title">No recent audits</p>
        <p className="fk-empty-body">
          Properties you audit will appear here for quick access.
        </p>
      </div>
    );
  }

  return (
    <div className="tab-content" style={{ paddingTop: 16 }}>
      <p className="fk-section-header" style={{ paddingTop: 4 }}>
        Recently audited — {items.length} {items.length === 1 ? "property" : "properties"}
      </p>
      <div style={{ display: "grid", gap: 8 }}>
        {items.map((p) => {
          const date = new Date(p.auditedAt);
          const label = date.toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
          });
          return (
            <Link key={p.id} href={`/audit/${p.id}`} style={{ textDecoration: "none" }}>
              <div className="recent-row">
                <div
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: 10,
                    background: "var(--wt-accent-muted)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 20,
                    flexShrink: 0,
                  }}
                >
                  📝
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p className="recent-name">{p.name}</p>
                  <p className="recent-loc">{p.location}</p>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <p className="recent-date">{label}</p>
                  <p style={{ fontSize: 11, color: "var(--wt-primary)", marginTop: 3, fontWeight: 600 }}>
                    Re-audit →
                  </p>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
