import { Outlet } from "react-router-dom";
import BottomTabBar from "./BottomTabBar";
import { Toaster } from "../../components/ui/Toaster";

interface MobileLayoutProps {
  user: any;
}

export default function MobileLayout({ user }: MobileLayoutProps) {
  return (
    <div className="mobile-root mobile-layout" style={{
      background: "linear-gradient(180deg, #0f172a 0%, #0f1629 100%)",
      minHeight: "100vh",
    }}>
      <Outlet />
      <BottomTabBar userRole={user.role} />
      <Toaster />
    </div>
  );
}
