import { NodeAppShell } from "../NodeAppShell";

export const metadata = {
  title: "Accessibility — WikiTraveler",
  description: "Accessibility statement for WikiTraveler node, WikiTraveler Access, and Lens.",
};

export default function AccessibilityStatementPage() {
  return (
    <NodeAppShell maxWidth={720}>
      <article>
        <h1 style={{ fontSize: 26, fontWeight: 700, marginBottom: 8 }}>Accessibility statement</h1>
        <p style={{ color: "var(--wt-text-muted)", fontSize: 15, lineHeight: 1.6, marginBottom: 24 }}>
          WikiTraveler aims to meet <strong>WCAG 2.1 Level AA</strong> (EN 301 549) across Lens, WikiTraveler Access,
          this node dashboard, and the agency SDK widget.
        </p>

        <section style={{ marginBottom: 28 }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 10 }}>Conformance status</h2>
          <p style={{ lineHeight: 1.6, color: "var(--wt-text)" }}>
            We are actively improving accessibility. Core flows — sign-in, property search, map browse,
            field audit submission, and Lens popup — support keyboard navigation, visible focus, and
            screen-reader labels.
          </p>
        </section>

        <section style={{ marginBottom: 28 }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 10 }}>Measures we take</h2>
          <ul style={{ paddingLeft: 20, lineHeight: 1.7, color: "var(--wt-text)" }}>
            <li>Semantic HTML landmarks and skip links</li>
            <li>Visible <code>:focus-visible</code> indicators on interactive controls</li>
            <li>Form labels and announced error messages</li>
            <li>Non-color trust tier labels on facts and badges</li>
            <li>Keyboard-accessible Lens controls on listing pages</li>
            <li><code>prefers-reduced-motion</code> support in shared UI styles</li>
          </ul>
        </section>

        <section style={{ marginBottom: 28 }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 10 }}>Known limitations</h2>
          <ul style={{ paddingLeft: 20, lineHeight: 1.7, color: "var(--wt-text)" }}>
            <li>The interactive map relies on Leaflet; a keyboard property list is provided as an alternative.</li>
            <li>Some third-party booking sites may constrain how Lens overlays appear.</li>
          </ul>
        </section>

        <section style={{ marginBottom: 28 }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 10 }}>Feedback and contact</h2>
          <p style={{ lineHeight: 1.6, color: "var(--wt-text)" }}>
            If you encounter an accessibility barrier, contact your node operator or{" "}
            <a href="https://github.com/wikitraveler/wikitraveler/issues/new" style={{ color: "var(--wt-primary)" }}>
              open an issue
            </a>{" "}
            in the WikiTraveler project repository. Please include the app (Lens, WikiTraveler Access, or Node), your browser,
            and any assistive technology you use.
          </p>
        </section>

        <section style={{ marginBottom: 28 }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 10 }}>Technical reference</h2>
          <p style={{ lineHeight: 1.6 }}>
            Developer checklist and test commands are documented in <code>docs/ACCESSIBILITY.md</code> and the formal
            EN 301 549 report in <code>docs/CONFORMANCE.md</code>. Run <code>pnpm test:a11y</code> and{" "}
            <code>pnpm lighthouse:ci</code> for automated accessibility regression tests.
          </p>
        </section>

        <p style={{ fontSize: 13, color: "var(--wt-text-muted)" }}>
          Last updated: June 2026
        </p>
      </article>
    </NodeAppShell>
  );
}
