"use client";

export function SignOutButton() {
  function signOut() {
    document.cookie = "wt_token=; path=/; max-age=0";
    sessionStorage.removeItem("wt_node_token");
    window.location.href = "/login";
  }

  return (
    <button
      onClick={signOut}
      style={{
        background: "rgba(255,255,255,0.12)",
        border: "1px solid rgba(255,255,255,0.3)",
        color: "#fff",
        borderRadius: 8,
        cursor: "pointer",
        fontSize: 12,
        padding: "5px 12px",
        fontWeight: 500,
      }}
    >
      Sign out
    </button>
  );
}
