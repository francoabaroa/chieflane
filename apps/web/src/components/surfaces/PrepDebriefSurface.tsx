"use client";

import type { PrepData } from "@chieflane/surface-schema";
import {
  Users,
  ListChecks,
  MessageCircle,
  HelpCircle,
  CheckSquare,
  ChevronDown,
} from "lucide-react";
import { useState } from "react";

function CollapsibleSection({
  icon: Icon,
  title,
  count,
  children,
  defaultOpen = true,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  title: string;
  count?: number;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="border-b border-border last:border-0">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-surface-hover transition-colors"
        aria-expanded={open}
      >
        <Icon size={14} className="text-accent shrink-0" aria-hidden="true" />
        <span className="text-[0.8125rem] font-semibold text-text-primary flex-1 text-left">
          {title}
        </span>
        {count !== undefined && (
          <span className="text-[0.625rem] text-text-tertiary font-[family-name:var(--font-mono)] tabular-nums">
            {count}
          </span>
        )}
        <ChevronDown
          size={12}
          aria-hidden="true"
          className={`text-text-tertiary transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      <div
        className="grid transition-[grid-template-rows]"
        style={{ gridTemplateRows: open ? "1fr" : "0fr" }}
      >
        <div className="overflow-hidden">
          {children}
        </div>
      </div>
    </div>
  );
}

export function PrepDebriefSurface({ data }: { data: PrepData }) {
  return (
    <div>
      <p className="text-[0.8125rem] text-text-secondary leading-relaxed max-w-[65ch] mb-4">
        {data.summary}
      </p>

      <div className="border border-border">
        {data.attendees.length > 0 && (
          <CollapsibleSection
            icon={Users}
            title="Attendees"
            count={data.attendees.length}
          >
            <div className="divide-y divide-border">
              {data.attendees.map((attendee, i) => (
                <div key={i} className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="h-6 w-6 bg-surface flex items-center justify-center">
                      <span className="text-[0.625rem] font-bold text-accent font-[family-name:var(--font-mono)]">
                        {attendee.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <p className="text-[0.8125rem] font-medium text-text-primary">
                        {attendee.name}
                      </p>
                      {attendee.role && (
                        <p className="text-[0.625rem] text-text-tertiary">
                          {attendee.role}
                        </p>
                      )}
                    </div>
                  </div>
                  {attendee.notes && (
                    <p className="text-[0.75rem] text-text-secondary mt-2 ml-8">
                      {attendee.notes}
                    </p>
                  )}
                  {attendee.lastContact && (
                    <p className="text-[0.625rem] text-text-tertiary mt-1 ml-8 font-[family-name:var(--font-mono)]">
                      Last: {attendee.lastContact}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </CollapsibleSection>
        )}

        {data.agenda.length > 0 && (
          <CollapsibleSection
            icon={ListChecks}
            title="Agenda"
            count={data.agenda.length}
          >
            <div className="divide-y divide-border">
              {data.agenda.map((item, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-2.5">
                  <span className="text-[0.625rem] text-text-tertiary font-[family-name:var(--font-mono)] w-4 tabular-nums">
                    {i + 1}
                  </span>
                  <p className="text-[0.8125rem] text-text-primary flex-1">{item.item}</p>
                  {item.owner && (
                    <span className="text-[0.625rem] text-accent font-[family-name:var(--font-mono)]">{item.owner}</span>
                  )}
                </div>
              ))}
            </div>
          </CollapsibleSection>
        )}

        {data.talkingPoints.length > 0 && (
          <CollapsibleSection
            icon={MessageCircle}
            title="Talking Points"
            count={data.talkingPoints.length}
          >
            <div className="px-4 py-3 space-y-2">
              {data.talkingPoints.map((point, i) => (
                <div key={i} className="flex gap-2">
                  <span className="shrink-0 mt-1.5 h-1.5 w-1.5 bg-accent" aria-hidden="true" />
                  <p className="text-[0.8125rem] text-text-secondary">{point}</p>
                </div>
              ))}
            </div>
          </CollapsibleSection>
        )}

        {data.openQuestions.length > 0 && (
          <CollapsibleSection
            icon={HelpCircle}
            title="Open Questions"
            count={data.openQuestions.length}
          >
            <div className="px-4 py-3 space-y-2">
              {data.openQuestions.map((q, i) => (
                <div key={i} className="flex gap-2">
                  <span className="shrink-0 text-warning text-[0.8125rem] font-[family-name:var(--font-mono)]">?</span>
                  <p className="text-[0.8125rem] text-text-secondary">{q}</p>
                </div>
              ))}
            </div>
          </CollapsibleSection>
        )}

        {data.commitments.length > 0 && (
          <CollapsibleSection
            icon={CheckSquare}
            title="Commitments"
            count={data.commitments.length}
          >
            <div className="divide-y divide-border">
              {data.commitments.map((c, i) => (
                <div key={i} className="px-4 py-3">
                  <p className="text-[0.8125rem] text-text-primary">{c.description}</p>
                  <div className="flex gap-3 mt-1">
                    {c.owner && (
                      <span className="text-[0.625rem] text-accent font-[family-name:var(--font-mono)]">{c.owner}</span>
                    )}
                    {c.dueAt && (
                      <span className="text-[0.625rem] text-warning font-[family-name:var(--font-mono)]">{c.dueAt}</span>
                    )}
                    {c.status && (
                      <span className="text-[0.625rem] text-text-tertiary font-[family-name:var(--font-mono)]">
                        {c.status}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CollapsibleSection>
        )}
      </div>
    </div>
  );
}
