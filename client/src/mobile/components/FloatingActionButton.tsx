interface FloatingActionButtonProps {
  icon?: string;
  onClick: () => void;
  label?: string;
  variant?: "primary" | "success" | "danger";
}

const COLORS = {
  primary: { bg: "linear-gradient(135deg, #256ce9, #1d57d6)", shadow: "rgba(37, 108, 233, 0.4)" },
  success: { bg: "linear-gradient(135deg, #22c55e, #16a34a)", shadow: "rgba(34, 197, 94, 0.4)" },
  danger: { bg: "linear-gradient(135deg, #ef4444, #dc2626)", shadow: "rgba(239, 68, 68, 0.4)" },
};

export default function FloatingActionButton({
  icon = "➕",
  onClick,
  label,
  variant = "primary",
}: FloatingActionButtonProps) {
  const color = COLORS[variant];

  return (
    <button
      onClick={onClick}
      className="mobile-fab touch-element"
      style={{
        background: color.bg,
        boxShadow: `0 6px 20px ${color.shadow}`,
      }}
      aria-label={label || "Action"}
    >
      {icon}
    </button>
  );
}
