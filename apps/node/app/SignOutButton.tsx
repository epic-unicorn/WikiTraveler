"use client";

export function SignOutButton() {
  function signOut() {
    document.cookie = "wt_token=; path=/; max-age=0";
    sessionStorage.removeItem("wt_node_token");
    window.location.href = "/login";
  }

  return (
    <button
      type="button"
      onClick={signOut}
      title="Sign out"
      aria-label="Sign out"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        fontSize: 13,
        fontWeight: 500,
        lineHeight: 1,
        borderRadius: 7,
        padding: "5px 10px",
        color: "rgba(255,255,255,0.82)",
        background: "rgba(255,255,255,0.08)",
        border: "1px solid rgba(255,255,255,0.16)",
        cursor: "pointer",
        transition: "opacity 0.12s",
        whiteSpace: "nowrap",
      }}
    >
      <svg
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
        <polyline points="16 17 21 12 16 7" />
        <line x1="21" y1="12" x2="9" y2="12" />
      </svg>
      Sign out
    </button>
  );
}
