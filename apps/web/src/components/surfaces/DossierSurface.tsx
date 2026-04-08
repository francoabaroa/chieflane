"use client";

import type { DossierData } from "@chieflane/surface-schema";
import { Signal, Mail } from "lucide-react";

const STRENGTH_COLORS: Record<string, string> = {
  low: "bg-info",
  medium: "bg-warning",
  high: "bg-critical",
};

export function DossierSurface({ data }: { data: DossierData }) {
  return (
    <div className="space-y-5">
      <p className="text-[0.8125rem] text-text-secondary leading-relaxed max-w-[65ch]">
        {data.summary}
      </p>

      {data.facts.length > 0 && (
        <div>
          <h3 className="text-[0.6875rem] font-medium uppercase tracking-wider text-text-tertiary font-[family-name:var(--font-mono)] mb-2">
            Key Facts
          </h3>
          <div className="border border-border divide-y divide-border">
            {data.facts.map((fact, i) => (
              <div
                key={i}
                className="flex items-center justify-between px-4 py-2.5"
              >
                <span className="text-[0.75rem] text-text-tertiary">{fact.label}</span>
                <span className="text-[0.8125rem] font-medium text-text-primary font-[family-name:var(--font-mono)] tabular-nums">
                  {fact.value}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {data.contacts.length > 0 && (
        <div>
          <h3 className="text-[0.6875rem] font-medium uppercase tracking-wider text-text-tertiary font-[family-name:var(--font-mono)] mb-2">
            Contacts
          </h3>
          <div className="border border-border divide-y divide-border">
            {data.contacts.map((contact, i) => (
              <div
                key={i}
                className="flex items-center gap-3 px-4 py-3 hover:bg-surface-hover transition-colors"
              >
                <div className="h-7 w-7 bg-surface flex items-center justify-center">
                  <span className="text-[0.625rem] font-bold text-accent font-[family-name:var(--font-mono)]">
                    {contact.name.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[0.8125rem] font-medium text-text-primary truncate">
                    {contact.name}
                  </p>
                  {contact.role && (
                    <p className="text-[0.625rem] text-text-tertiary">
                      {contact.role}
                    </p>
                  )}
                </div>
                {contact.email && (
                  <a
                    href={`mailto:${contact.email}`}
                    className="p-1.5 text-text-tertiary hover:text-text-primary transition-colors"
                    aria-label={`Email ${contact.name}`}
                  >
                    <Mail size={14} aria-hidden="true" />
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {data.signals.length > 0 && (
        <div>
          <h3 className="text-[0.6875rem] font-medium uppercase tracking-wider text-text-tertiary font-[family-name:var(--font-mono)] mb-2 flex items-center gap-1.5">
            <Signal size={12} className="text-accent" aria-hidden="true" />
            Signals
          </h3>
          <div className="border border-border divide-y divide-border">
            {data.signals.map((signal, i) => (
              <div key={i} className="px-4 py-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[0.8125rem] font-medium text-text-primary">
                    {signal.label}
                  </span>
                  <span
                    className={`h-1.5 w-6 ${STRENGTH_COLORS[signal.strength ?? "medium"]}`}
                    title={signal.strength}
                    aria-label={`Strength: ${signal.strength}`}
                  />
                </div>
                <p className="text-[0.75rem] text-text-secondary">{signal.detail}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
