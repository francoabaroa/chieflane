"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  Zap,
  Inbox,
  Calendar,
  PenLine,
  Users,
  BookOpen,
  Activity,
} from "lucide-react";
import { LANES } from "@/lib/types";
import { ThemeToggle } from "./ThemeToggle";

const ICON_MAP: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  Zap,
  Inbox,
  Calendar,
  PenLine,
  Users,
  BookOpen,
  Activity,
};

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex md:flex-col md:w-56 lg:w-64 border-r border-border bg-base h-screen sticky top-0">
      <div className="px-5 pt-8 pb-6">
        <h1 className="font-[family-name:var(--font-display)] text-[1.75rem] text-text-primary tracking-tight leading-none">
          Chieflane
        </h1>
        <p className="text-[0.6875rem] text-text-tertiary mt-1.5 tracking-[0.12em] uppercase font-medium font-[family-name:var(--font-mono)]">
          Command
        </p>
      </div>

      <nav className="flex-1 px-3 space-y-px" aria-label="Main navigation">
        {LANES.map((lane) => {
          const Icon = ICON_MAP[lane.icon];
          const href = `/${lane.id}`;
          const isActive =
            pathname === href || pathname.startsWith(href + "/");

          return (
            <Link
              key={lane.id}
              href={href}
              aria-current={isActive ? "page" : undefined}
              className={`flex items-center gap-3 px-3 py-2 text-[0.8125rem] font-medium transition-colors ${
                isActive
                  ? "text-accent border-l-[3px] border-accent -ml-px pl-[calc(0.75rem-2px)]"
                  : "text-text-secondary hover:text-text-primary hover:bg-surface-hover"
              }`}
            >
              {Icon && <Icon size={16} aria-hidden="true" />}
              <span>{lane.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="px-3 py-3 border-t border-border">
        <ThemeToggle />
      </div>
    </aside>
  );
}
