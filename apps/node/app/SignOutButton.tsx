"use client";

export function SignOutButton() {
  function signOut() {
    document.cookie = "wt_token=; path=/; max-age=0";
    sessionStorage.removeItem("wt_node_token");
    window.location.href = "/login";
  }

  return (
    <button type="button" onClick={signOut} className="wt-toolbar-btn" title="Sign out" aria-label="Sign out">
      Sign out
    </button>
  );
}
