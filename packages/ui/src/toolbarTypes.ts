import type { ReactNode } from "react";

export interface ToolbarLink {
  href: string;
  label: string;
  active?: boolean;
  external?: boolean;
}

export type ToolbarLinkWrap = (props: {
  href: string;
  className: string;
  children: ReactNode;
  external?: boolean;
}) => ReactNode;

export function toolbarLinkClass(active?: boolean): string {
  return active ? "wt-toolbar-link wt-toolbar-link--active" : "wt-toolbar-link";
}
