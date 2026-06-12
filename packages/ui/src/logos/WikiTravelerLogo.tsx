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
}: LogoProps) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 10,
        color: "inherit",
        ...style,
      }}
    >
      <LogoMark size={size} />
      {showWordmark && (
        <span style={{ display: "flex", flexDirection: "column", lineHeight: 1.15 }}>
          <span style={{ fontSize: size * 0.55, fontWeight: 700, letterSpacing: "-0.02em" }}>
            WikiTraveler
          </span>
          <span style={{ fontSize: size * 0.38, opacity: 0.85, fontWeight: 500 }}>
            {WORDMARK[product]}
          </span>
        </span>
      )}
    </span>
  );
}
