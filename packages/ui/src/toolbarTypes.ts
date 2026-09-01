import type { ReactNode } from "react";

export interface ToolbarLink {
  href: string;
  label: string;
  active?: boolean;
  external?: boolean;
  /** Shown as a red count pill on the link (e.g. open signals). */
  badgeCount?: number;
  /** Overrides the link accessible name when `badgeCount` is set. */
  ariaLabel?: string;
}

export type ToolbarLinkWrap = (props: {
  href: string;
  className: string;
  children: ReactNode;
  external?: boolean;
  ariaLabel?: string;
}) => ReactNode;

export function toolbarLinkClass(active?: boolean): string {
  return active ? "wt-toolbar-link wt-toolbar-link--active" : "wt-toolbar-link";
}
