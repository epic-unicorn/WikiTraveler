"use client";

import type { ReactNode } from "react";
import { WikiTravelerLogo } from "@wikitraveler/ui";

interface Props {
  /** Optional control on the right (e.g. notifications). */
  trailing?: ReactNode;
  /** Page subsection under the brand (Saved / Profile title). */
  sectionTitle?: string;
  sectionSubtitle?: string;
  children?: ReactNode;
}

/** Shared navy Access hero: WikiTraveler · Access + optional page section / search. */
export function AccessPageHero({
  trailing,
  sectionTitle,
  sectionSubtitle,
  children,
}: Props) {
  return (
    <header className="fk-access-hero">
      <div className="fk-access-hero__top">
        <div className="fk-access-hero__brand">
          <WikiTravelerLogo product="access" size={36} />
        </div>
        {trailing}
      </div>
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
