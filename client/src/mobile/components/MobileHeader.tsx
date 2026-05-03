import { useNavigate } from "react-router-dom";

interface MobileHeaderProps {
  title: string;
  showBack?: boolean;
  rightAction?: React.ReactNode;
  subtitle?: string;
}

export default function MobileHeader({ title, showBack = false, rightAction, subtitle }: MobileHeaderProps) {
  const navigate = useNavigate();

  return (
    <header style={{
      position: "sticky",
      top: 0,
      zIndex: 80,
      padding: "14px 18px",
      display: "flex",
      alignItems: "center",
      gap: "12px",
      background: "rgba(15, 23, 42, 0.88)",
      backdropFilter: "blur(20px) saturate(180%)",
      WebkitBackdropFilter: "blur(20px) saturate(180%)",
      borderBottom: "1px solid rgba(255,255,255,0.06)",
    }}>
      {showBack && (
        <button
          onClick={() => navigate(-1)}
          className="touch-target touch-button"
          style={{
            fontSize: "20px",
            color: "#60a5fa",
            flexShrink: 0,
            minWidth: 40,
            background: "rgba(59,138,244,0.1)",
            borderRadius: "12px",
            border: "none",
            width: "40px",
            height: "40px",
          }}
        >
          ‹
        </button>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <h1 style={{
          fontSize: "1.2rem",
          fontWeight: 800,
          margin: 0,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
          background: "linear-gradient(135deg, #f1f5f9, #93c5fd)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
        }}>
          {title}
        </h1>
        {subtitle && (
          <p style={{ fontSize: "0.78rem", color: "#475569", margin: 0, fontWeight: 500 }}>{subtitle}</p>
        )}
      </div>
      {rightAction && <div style={{ flexShrink: 0 }}>{rightAction}</div>}
    </header>
  );
}
