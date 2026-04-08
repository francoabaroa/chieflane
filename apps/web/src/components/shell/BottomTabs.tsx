"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { Zap, Inbox, Calendar, PenLine, Users, BookOpen, Activity } from "lucide-react";
import type { Lane } from "@chieflane/surface-schema";

const ICON_MAP: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  Zap,
  Inbox,
  Calendar,
  PenLine,
  Users,
  BookOpen,
  Activity,
};

const TABS: { id: Lane; label: string; icon: string; href: string }[] = [
  { id: "today", label: "Today", icon: "Zap", href: "/today" },
  { id: "inbox", label: "Inbox", icon: "Inbox", href: "/inbox" },
  { id: "meetings", label: "Meetings", icon: "Calendar", href: "/meetings" },
  { id: "drafts", label: "Drafts", icon: "PenLine", href: "/drafts" },
  { id: "people", label: "People", icon: "Users", href: "/people" },
  { id: "research", label: "Research", icon: "BookOpen", href: "/research" },
  { id: "ops", label: "Ops", icon: "Activity", href: "/ops" },
];

export function BottomTabs() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-base md:hidden safe-area-bottom"
      aria-label="Main navigation"
    >
      <div className="grid grid-cols-7">
        {TABS.map((tab) => {
          const Icon = ICON_MAP[tab.icon];
          const isActive =
            pathname === tab.href || pathname.startsWith(tab.href + "/");

          return (
            <Link
              key={tab.id}
              href={tab.href}
              aria-current={isActive ? "page" : undefined}
              className={`relative flex flex-col items-center justify-center gap-0.5 py-2.5 min-h-[44px] text-[0.625rem] font-medium transition-colors ${
                isActive
                  ? "text-accent"
                  : "text-text-tertiary"
              }`}
            >
              {Icon && (
                <Icon
                  size={20}
                  className={isActive ? "text-accent" : undefined}
                  aria-hidden="true"
                />
              )}
              <span>{tab.label}</span>
              {isActive && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 h-[2px] w-6 bg-accent" aria-hidden="true" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
