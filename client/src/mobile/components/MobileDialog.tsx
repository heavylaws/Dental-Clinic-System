import { useRef, useEffect, useState } from "react";

interface MobileDialogProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  fullScreen?: boolean;
}

export default function MobileDialog({ open, onClose, title, children, fullScreen = false }: MobileDialogProps) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const [dragY, setDragY] = useState(0);
  const startY = useRef(0);
  const dragging = useRef(false);

  useEffect(() => {
    if (open) document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  const onTouchStart = (e: React.TouchEvent) => {
    startY.current = e.touches[0].clientY;
    dragging.current = true;
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (!dragging.current) return;
    const diff = e.touches[0].clientY - startY.current;
    if (diff > 0) setDragY(diff);
  };

  const onTouchEnd = () => {
    dragging.current = false;
    if (dragY > 100) { onClose(); }
    setDragY(0);
  };

  return (
    <>
      <div className={`bottom-sheet-overlay ${open ? "active" : ""}`} onClick={onClose} />
      <div
        ref={sheetRef}
        className={`bottom-sheet ${open ? "open" : ""}`}
        style={{
          transform: open ? `translateY(${dragY}px)` : "translateY(100%)",
          height: fullScreen ? "94vh" : undefined,
          display: "flex",
          flexDirection: "column",
          overflowY: "hidden", // Prevent outer scroll, let inner flex-1 scroll
        }}
      >
        <div onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd} style={{ flexShrink: 0 }}>
          <div className="bottom-sheet-handle" />
        </div>
        {title && (
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "4px 20px 16px",
            borderBottom: "1px solid rgba(255,255,255,0.06)",
            flexShrink: 0,
          }}>
            <h2 style={{
              fontSize: "1.15rem", fontWeight: 800, margin: 0,
              background: "linear-gradient(135deg, #f1f5f9, #93c5fd)",
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            }}>{title}</h2>
            <button onClick={onClose} className="touch-target"
              style={{
                fontSize: "18px", color: "#64748b", background: "rgba(255,255,255,0.06)",
                border: "none", borderRadius: "10px", width: "36px", height: "36px",
                display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
              }}>
              ✕
            </button>
          </div>
        )}
        <div style={{ padding: "16px 20px 60px", overflowY: "auto", flex: 1, WebkitOverflowScrolling: "touch" }}>{children}</div>
      </div>
    </>
  );
}
