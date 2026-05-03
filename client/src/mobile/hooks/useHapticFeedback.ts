/**
 * Haptic feedback using the Vibration API.
 * Works on Android Chrome and some other mobile browsers.
 * Silently no-ops on iOS Safari (which doesn't support Vibration API).
 */

type HapticStyle = "light" | "medium" | "heavy" | "success" | "warning" | "error";

const PATTERNS: Record<HapticStyle, number | number[]> = {
  light: 10,
  medium: 25,
  heavy: 50,
  success: [10, 50, 10],
  warning: [25, 50, 25],
  error: [50, 30, 50, 30, 50],
};

export function useHapticFeedback() {
  const vibrate = (style: HapticStyle = "light") => {
    if (!("vibrate" in navigator)) return;
    try {
      const pattern = PATTERNS[style];
      navigator.vibrate(pattern);
    } catch {
      // Silently ignore — some browsers block vibration
    }
  };

  return {
    light: () => vibrate("light"),
    medium: () => vibrate("medium"),
    heavy: () => vibrate("heavy"),
    success: () => vibrate("success"),
    warning: () => vibrate("warning"),
    error: () => vibrate("error"),
    vibrate,
  };
}
