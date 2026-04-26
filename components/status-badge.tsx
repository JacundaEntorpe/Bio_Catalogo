type StatusBadgeProps = {
  status: "CONFIRMED" | "POSSIBLE" | "UNKNOWN";
};

const labels: Record<StatusBadgeProps["status"], string> = {
  CONFIRMED: "Confirmed",
  POSSIBLE: "Possible",
  UNKNOWN: "Unknown"
};

export function StatusBadge({ status }: StatusBadgeProps) {
  return <span className={`status-badge status-badge--${status.toLowerCase()}`}>{labels[status]}</span>;
}