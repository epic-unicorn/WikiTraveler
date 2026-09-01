"use client";

import { Fragment, type ReactNode } from "react";
import {
  toolbarLinkClass,
  type ToolbarLink,
  type ToolbarLinkWrap,
} from "./toolbarTypes";

export const defaultToolbarLinkWrap: ToolbarLinkWrap = ({
  href,
  className,
  children,
  external,
  ariaLabel,
}) => (
  <a
    href={href}
    className={className}
    aria-label={ariaLabel}
    {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
  >
    {children}
  </a>
);

export interface AppToolbarProps {
  title: ReactNode;
  titleHref?: string;
  links?: ToolbarLink[];
  start?: ReactNode;
  end?: ReactNode;
  /** Wrap internal links (e.g. Next.js `<Link>`). Defaults to `<a>`. */
  linkWrap?: ToolbarLinkWrap;
  ariaLabel?: string;
  className?: string;
}

export function AppToolbar({
  title,
  titleHref,
  links = [],
  start,
  end,
  linkWrap = defaultToolbarLinkWrap,
  ariaLabel = "App toolbar",
  className,
}: AppToolbarProps) {
  const titleContent = titleHref ? (
    linkWrap({
      href: titleHref,
      className: "wt-toolbar-title wt-toolbar-title--link",
      children: title,
    })
  ) : (
    <div className="wt-toolbar-title">{title}</div>
  );

  return (
    <header
      className={className ? `wt-toolbar ${className}` : "wt-toolbar"}
      aria-label={ariaLabel}
    >
      {start && <div className="wt-toolbar-start">{start}</div>}
      {titleContent}
      <div className="wt-toolbar-end">
        {links.length > 0 && (
          <nav className="wt-toolbar-nav" aria-label="Main navigation">
            {links.map((link) => (
              <Fragment key={link.href}>
                {linkWrap({
                  href: link.href,
                  className: toolbarLinkClass(link.active),
                  external: link.external,
                  ariaLabel:
                    link.badgeCount != null && link.badgeCount > 0
                      ? link.ariaLabel
                      : undefined,
                  children: (
                    <>
                      <span className="wt-toolbar-link-label">{link.label}</span>
                      {link.badgeCount != null && link.badgeCount > 0 && (
                        <span className="wt-toolbar-link-badge" aria-hidden="true">
                          {link.badgeCount > 9 ? "9+" : link.badgeCount}
                        </span>
                      )}
                    </>
                  ),
                })}
              </Fragment>
            ))}
          </nav>
        )}
        {end && <div className="wt-toolbar-actions">{end}</div>}
      </div>
    </header>
  );
}

export function ToolbarBackLink({
  href,
  label = "Back",
  linkWrap = defaultToolbarLinkWrap,
}: {
  href: string;
  label?: string;
  linkWrap?: ToolbarLinkWrap;
}) {
  return linkWrap({
    href,
    className: "wt-toolbar-back",
    children: (
      <>
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <polyline points="15 18 9 12 15 6" />
        </svg>
        {label}
      </>
    ),
  });
}

export function PageLead({ children }: { children: ReactNode }) {
  return <p className="wt-page-lead">{children}</p>;
}
