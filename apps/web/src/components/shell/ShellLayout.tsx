"use client";

import { Sidebar } from "./Sidebar";
import { BottomTabs } from "./BottomTabs";

export function ShellLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-base">
      <Sidebar />
      <main id="main" className="flex-1 min-w-0 pb-14 md:pb-0">{children}</main>
      <BottomTabs />
    </div>
  );
}
