import { useState, useRef, useCallback } from "react";

interface SwipeableCardProps {
  children: React.ReactNode;
  onSwipeRight?: () => void;
  onSwipeLeft?: () => void;
  rightLabel?: string;
  leftLabel?: string;
  rightColor?: string;
  leftColor?: string;
  disabled?: boolean;
}

export default function SwipeableCard({
  children,
  onSwipeRight,
  onSwipeLeft,
  rightLabel = "✓",
  leftLabel = "✕",
  rightColor = "#22c55e",
  leftColor = "#ef4444",
  disabled = false,
}: SwipeableCardProps) {
  const [offsetX, setOffsetX] = useState(0);
  const startX = useRef(0);
  const startY = useRef(0);
  const isDragging = useRef(false);
  const isHorizontal = useRef<boolean | null>(null);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (disabled) return;
    startX.current = e.touches[0].clientX;
    startY.current = e.touches[0].clientY;
    isDragging.current = true;
    isHorizontal.current = null;
  }, [disabled]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging.current || disabled) return;

    const deltaX = e.touches[0].clientX - startX.current;
    const deltaY = e.touches[0].clientY - startY.current;

    // Determine direction on first move
    if (isHorizontal.current === null) {
      if (Math.abs(deltaX) > 10 || Math.abs(deltaY) > 10) {
        isHorizontal.current = Math.abs(deltaX) > Math.abs(deltaY);
      }
      return;
    }

    if (!isHorizontal.current) return;

    // Only allow valid directions
    if (deltaX > 0 && !onSwipeRight) return;
    if (deltaX < 0 && !onSwipeLeft) return;

    // Apply resistance at edges
    const maxOffset = 100;
    const resistance = 0.6;
    const clampedOffset = Math.abs(deltaX) > maxOffset
      ? maxOffset + (Math.abs(deltaX) - maxOffset) * resistance
      : Math.abs(deltaX);

    setOffsetX(deltaX > 0 ? clampedOffset : -clampedOffset);
  }, [disabled, onSwipeLeft, onSwipeRight]);

  const handleTouchEnd = useCallback(() => {
    if (!isDragging.current || disabled) return;
    isDragging.current = false;
    isHorizontal.current = null;

    const threshold = 80;
    if (offsetX > threshold && onSwipeRight) {
      onSwipeRight();
    } else if (offsetX < -threshold && onSwipeLeft) {
      onSwipeLeft();
    }

    setOffsetX(0);
  }, [offsetX, onSwipeLeft, onSwipeRight, disabled]);

  return (
    <div className="swipeable-card" style={{ borderRadius: "16px", marginBottom: "8px" }}>
      {/* Left action background (swipe right reveals this) */}
      {onSwipeRight && offsetX > 0 && (
        <div
          className="swipeable-card-actions left"
          style={{
            width: "100%",
            borderRadius: "16px",
            background: rightColor,
            opacity: Math.min(offsetX / 80, 1),
          }}
        >
          <span style={{ fontSize: "20px", fontWeight: 700 }}>{rightLabel}</span>
        </div>
      )}

      {/* Right action background (swipe left reveals this) */}
      {onSwipeLeft && offsetX < 0 && (
        <div
          className="swipeable-card-actions right"
          style={{
            width: "100%",
            borderRadius: "16px",
            background: leftColor,
            opacity: Math.min(Math.abs(offsetX) / 80, 1),
          }}
        >
          <span style={{ fontSize: "20px", fontWeight: 700 }}>{leftLabel}</span>
        </div>
      )}

      {/* Card content */}
      <div
        className="swipeable-card-content"
        style={{
          transform: `translateX(${offsetX}px)`,
          transition: isDragging.current ? "none" : "transform 0.3s cubic-bezier(0.32, 0.72, 0, 1)",
          borderRadius: "16px",
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {children}
      </div>
    </div>
  );
}
