import { useRef } from "react";

interface MobileSearchBarProps {
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  onFocus?: () => void;
  autoFocus?: boolean;
}

export default function MobileSearchBar({ placeholder, value, onChange, onFocus, autoFocus }: MobileSearchBarProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      gap: "10px",
      background: "rgba(255,255,255,0.06)",
      borderRadius: "16px",
      padding: "0 16px",
      border: "1px solid rgba(255,255,255,0.08)",
      transition: "border-color 0.2s ease, box-shadow 0.2s ease",
    }}
      onFocus={() => {
        const el = inputRef.current?.parentElement;
        if (el) {
          el.style.borderColor = "rgba(59,138,244,0.3)";
          el.style.boxShadow = "0 0 0 4px rgba(59,138,244,0.08)";
        }
      }}
      onBlur={() => {
        const el = inputRef.current?.parentElement;
        if (el) {
          el.style.borderColor = "rgba(255,255,255,0.08)";
          el.style.boxShadow = "none";
        }
      }}
    >
      <span style={{ fontSize: "18px", opacity: 0.5, flexShrink: 0 }}>🔍</span>
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={onFocus}
        autoFocus={autoFocus}
        placeholder={placeholder || "Search..."}
        style={{
          flex: 1,
          border: "none",
          background: "transparent",
          outline: "none",
          padding: "14px 0",
          fontSize: "15px",
          color: "#f1f5f9",
          WebkitAppearance: "none",
        }}
      />
      {value && (
        <button
          onClick={() => onChange("")}
          className="touch-target"
          style={{
            fontSize: "16px", color: "#64748b", flexShrink: 0,
            background: "rgba(255,255,255,0.08)", border: "none",
            width: "28px", height: "28px", borderRadius: "8px",
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer",
          }}
        >
          ✕
        </button>
      )}
    </div>
  );
}
