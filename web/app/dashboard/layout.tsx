import type { Metadata } from "next";
import type { ReactNode } from "react";
import Shell from "./_components/Shell";
import "../dashboard/dashboard.css";

export const metadata: Metadata = {
  title: "Dashboard · DevPilot",
};

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return <Shell>{children}</Shell>;
}