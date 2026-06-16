import type { CSSProperties } from "react";

interface LogoMarkProps {
  size?: number;
  className?: string;
  style?: CSSProperties;
}

/** Minimal geometric mark: hexagon + compass chevron + access bar */
export function LogoMark({ size = 32, className, style }: LogoMarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={style}
      aria-hidden
    >
      <path
        d="M16 2L28 9v14L16 30 4 23V9L16 2z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      <path d="M16 9l4 6H12l4-6z" fill="currentColor" />
      <path
        d="M10 20h12"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

interface LogoProps extends LogoMarkProps {
  product: "node" | "field-kit" | "lens";
  showWordmark?: boolean;
}

const WORDMARK: Record<LogoProps["product"], string> = {
  node: "Node",
  "field-kit": "Field Kit",
  lens: "Lens",
};

export function WikiTravelerLogo({
  product,
  size = 28,
  showWordmark = true,
  style,
  className,
}: LogoProps & { className?: string }) {
  return (
    <span className={className ? `wt-logo ${className}` : "wt-logo"} style={style}>
      <LogoMark size={size} className="wt-logo-mark" />
      {showWordmark && (
        <span className="wt-logo-wordmark">
          <span className="wt-logo-brand">WikiTraveler</span>
          <span className="wt-logo-sep" aria-hidden="true">
            ·
          </span>
          <span className="wt-logo-product">{WORDMARK[product]}</span>
        </span>
      )}
    </span>
  );
}
