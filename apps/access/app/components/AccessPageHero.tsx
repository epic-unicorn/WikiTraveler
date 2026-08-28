"use client";

import type { ReactNode } from "react";
import { WikiTravelerLogo } from "@wikitraveler/ui";
import { NotificationBell } from "./NotificationBell";

interface Props {
  /** Optional control on the right (e.g. custom action). Replaced by the bell when `notifyNodeUrl` is set. */
  trailing?: ReactNode;
  /** When set, show the notification bell with popup. */
  notifyNodeUrl?: string;
  /** Page subsection under the brand (Saved / Profile title). */
  sectionTitle?: string;
  sectionSubtitle?: string;
  /** Extra block in the blue hero (e.g. profile identity). */
  identity?: ReactNode;
  children?: ReactNode;
}

/** Shared navy Access hero: WikiTraveler · Access + optional page section / search. */
export function AccessPageHero({
  trailing,
  notifyNodeUrl,
  sectionTitle,
  sectionSubtitle,
  identity,
  children,
}: Props) {
  return (
    <header className={`fk-access-hero${identity ? " fk-access-hero--identity" : ""}`}>
      <div className="fk-access-hero__top">
        <div className="fk-access-hero__brand">
          <WikiTravelerLogo product="access" size={36} />
        </div>
        {notifyNodeUrl ? <NotificationBell homeNodeUrl={notifyNodeUrl} /> : trailing}
      </div>
      {identity}
      {(sectionTitle || sectionSubtitle) && (
        <div className="fk-access-hero__section">
          {sectionTitle && <h1 className="fk-access-hero__section-title">{sectionTitle}</h1>}
          {sectionSubtitle && (
            <p className="fk-access-hero__section-sub">{sectionSubtitle}</p>
          )}
        </div>
      )}
      {children}
    </header>
  );
}
