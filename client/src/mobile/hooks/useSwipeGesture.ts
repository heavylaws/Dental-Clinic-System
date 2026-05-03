import { useRef, useCallback } from "react";

interface SwipeConfig {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
  onSwiping?: (deltaX: number, deltaY: number) => void;
  onSwipeEnd?: () => void;
  threshold?: number; // minimum px to trigger swipe
  preventScrollOnHorizontal?: boolean;
}

interface SwipeHandlers {
  onTouchStart: (e: React.TouchEvent) => void;
  onTouchMove: (e: React.TouchEvent) => void;
  onTouchEnd: (e: React.TouchEvent) => void;
}

export function useSwipeGesture(config: SwipeConfig): SwipeHandlers {
  const {
    onSwipeLeft,
    onSwipeRight,
    onSwipeUp,
    onSwipeDown,
    onSwiping,
    onSwipeEnd,
    threshold = 50,
    preventScrollOnHorizontal = true,
  } = config;

  const startX = useRef(0);
  const startY = useRef(0);
  const isSwiping = useRef(false);
  const direction = useRef<"horizontal" | "vertical" | null>(null);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    startX.current = touch.clientX;
    startY.current = touch.clientY;
    isSwiping.current = true;
    direction.current = null;
  }, []);

  const onTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!isSwiping.current) return;

      const touch = e.touches[0];
      const deltaX = touch.clientX - startX.current;
      const deltaY = touch.clientY - startY.current;

      // Determine direction on first significant move
      if (!direction.current && (Math.abs(deltaX) > 10 || Math.abs(deltaY) > 10)) {
        direction.current = Math.abs(deltaX) > Math.abs(deltaY) ? "horizontal" : "vertical";
      }

      // Prevent scroll when swiping horizontally
      if (preventScrollOnHorizontal && direction.current === "horizontal") {
        e.preventDefault();
      }

      onSwiping?.(deltaX, deltaY);
    },
    [onSwiping, preventScrollOnHorizontal]
  );

  const onTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (!isSwiping.current) return;
      isSwiping.current = false;

      const touch = e.changedTouches[0];
      const deltaX = touch.clientX - startX.current;
      const deltaY = touch.clientY - startY.current;

      const absX = Math.abs(deltaX);
      const absY = Math.abs(deltaY);

      if (absX > absY && absX > threshold) {
        if (deltaX > 0) onSwipeRight?.();
        else onSwipeLeft?.();
      } else if (absY > absX && absY > threshold) {
        if (deltaY > 0) onSwipeDown?.();
        else onSwipeUp?.();
      }

      onSwipeEnd?.();
      direction.current = null;
    },
    [onSwipeLeft, onSwipeRight, onSwipeUp, onSwipeDown, onSwipeEnd, threshold]
  );

  return { onTouchStart, onTouchMove, onTouchEnd };
}
