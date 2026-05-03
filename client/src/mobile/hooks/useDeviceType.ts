import { useState, useEffect } from "react";

export type DeviceType = "phone" | "tablet" | "desktop";
export type Orientation = "portrait" | "landscape";

interface DeviceInfo {
  type: DeviceType;
  orientation: Orientation;
  isTouch: boolean;
  width: number;
  height: number;
  isPhone: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  isLandscape: boolean;
}

function getDeviceInfo(): DeviceInfo {
  const width = window.innerWidth;
  const height = window.innerHeight;
  const isTouch = "ontouchstart" in window || navigator.maxTouchPoints > 0;
  const orientation: Orientation = width > height ? "landscape" : "portrait";

  let type: DeviceType;
  if (width < 768) {
    type = "phone";
  } else if (width < 1024) {
    type = "tablet";
  } else {
    // Large screen but touch = tablet in landscape
    type = isTouch && width < 1366 ? "tablet" : "desktop";
  }

  return {
    type,
    orientation,
    isTouch,
    width,
    height,
    isPhone: type === "phone",
    isTablet: type === "tablet",
    isDesktop: type === "desktop",
    isLandscape: orientation === "landscape",
  };
}

export function useDeviceType(): DeviceInfo {
  const [info, setInfo] = useState<DeviceInfo>(getDeviceInfo);

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;
    const handleResize = () => {
      clearTimeout(timeout);
      timeout = setTimeout(() => setInfo(getDeviceInfo()), 100);
    };

    window.addEventListener("resize", handleResize);
    window.addEventListener("orientationchange", handleResize);

    return () => {
      clearTimeout(timeout);
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("orientationchange", handleResize);
    };
  }, []);

  return info;
}
