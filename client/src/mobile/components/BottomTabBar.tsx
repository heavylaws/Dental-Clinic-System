import { useLocation, useNavigate } from "react-router-dom";
import { useHapticFeedback } from "../hooks/useHapticFeedback";

interface TabItem {
  path: string;
  label: string;
  icon: string;
  activeIcon: string;
  roles: string[];
}

const TABS: TabItem[] = [
  { path: "/m", label: "Queue", icon: "📋", activeIcon: "📋", roles: ["admin", "doctor", "reception"] },
  { path: "/m/patients", label: "Patients", icon: "👥", activeIcon: "👥", roles: ["admin", "doctor", "reception"] },
  { path: "/m/appointments", label: "Appts", icon: "📅", activeIcon: "📅", roles: ["admin", "doctor", "reception"] },
  { path: "/m/billing", label: "Billing", icon: "💰", activeIcon: "💰", roles: ["admin", "reception"] },
];

interface BottomTabBarProps {
  userRole: string;
}

export default function BottomTabBar({ userRole }: BottomTabBarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const haptic = useHapticFeedback();

  const visibleTabs = TABS.filter((tab) => tab.roles.includes(userRole));

  const isActive = (path: string) => {
    if (path === "/m") return location.pathname === "/m" || location.pathname === "/m/";
    return location.pathname.startsWith(path);
  };

  return (
    <nav
      className="mobile-tab-bar mobile-tab-bar-bottom"
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 90,
        background: "rgba(15, 23, 42, 0.92)",
        backdropFilter: "blur(24px) saturate(180%)",
        WebkitBackdropFilter: "blur(24px) saturate(180%)",
        borderTop: "1px solid rgba(255,255,255,0.06)",
        display: "flex",
        justifyContent: "space-around",
        alignItems: "center",
        height: "76px",
      }}
    >
      {visibleTabs.map((tab) => {
        const active = isActive(tab.path);
        return (
          <button
            key={tab.path}
            onClick={() => {
              if (!active) {
                haptic.light();
                navigate(tab.path);
              }
            }}
            className="touch-element"
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: "4px",
              flex: 1,
              height: "100%",
              border: "none",
              background: "transparent",
              cursor: "pointer",
              WebkitTapHighlightColor: "transparent",
              position: "relative",
              padding: 0,
            }}
          >
            {/* Active glow background */}
            {active && (
              <div style={{
                position: "absolute",
                top: "8px",
                width: "48px",
                height: "32px",
                borderRadius: "12px",
                background: "rgba(59,138,244,0.15)",
                filter: "blur(1px)",
              }} />
            )}

            {/* Active top indicator */}
            {active && (
              <div style={{
                position: "absolute",
                top: 0,
                width: "24px",
                height: "3px",
                borderRadius: "0 0 4px 4px",
                background: "linear-gradient(90deg, #3b8af4, #60a5fa)",
                boxShadow: "0 2px 12px rgba(59,138,244,0.5)",
              }} />
            )}

            <span style={{
              fontSize: "22px",
              lineHeight: 1,
              position: "relative",
              zIndex: 1,
              transition: "transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
              transform: active ? "scale(1.1) translateY(-1px)" : "scale(1)",
            }}>
              {active ? tab.activeIcon : tab.icon}
            </span>
            <span style={{
              fontSize: "10px",
              fontWeight: active ? 800 : 500,
              color: active ? "#60a5fa" : "#475569",
              transition: "color 0.2s ease",
              letterSpacing: "0.03em",
              position: "relative",
              zIndex: 1,
            }}>
              {tab.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
