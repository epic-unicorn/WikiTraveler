import { getTierStyle } from "./constants";

interface Props {
  tier: string;
  label?: string;
}

export function TierBadge({ tier, label }: Props) {
  const style = getTierStyle(tier);
  return (
    <span
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
      {label ?? tier.replace(/_/g, " ")}
    </span>
  );
}
