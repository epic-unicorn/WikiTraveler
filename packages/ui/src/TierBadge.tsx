import { getTierStyle } from "./constants";

interface Props {
  tier: string;
  label?: string;
}

export function TierBadge({ tier, label }: Props) {
  const style = getTierStyle(tier);
  const text = label ?? tier.replace(/_/g, " ");
  return (
    <span
      aria-label={`Trust tier: ${text}`}
      style={{
        ...style,
        borderRadius: 999,
        padding: "2px 8px",
        fontSize: 10,
        fontWeight: 600,
        display: "inline-block",
        whiteSpace: "nowrap",
      }}
    >
      {text}
    </span>
  );
}
