"use client";

import { useState } from "react";
import type { ComposerData } from "@chieflane/surface-schema";
import { Mail, MessageSquare, Send, Copy, Check } from "lucide-react";

const CHANNEL_ICONS: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  gmail: Mail,
  slack: MessageSquare,
  whatsapp: MessageSquare,
  telegram: Send,
  generic: Mail,
};

const CHANNEL_LABELS: Record<string, string> = {
  gmail: "Gmail",
  slack: "Slack",
  whatsapp: "WhatsApp",
  telegram: "Telegram",
  generic: "Message",
};

export function ComposerSurface({ data }: { data: ComposerData }) {
  const [activeVariant, setActiveVariant] = useState<string | null>(
    data.variants.length > 0 ? data.variants[0].id : null
  );
  const [copied, setCopied] = useState(false);

  const ChannelIcon = CHANNEL_ICONS[data.channel] ?? Mail;
  const displayBody = activeVariant
    ? data.variants.find((v) => v.id === activeVariant)?.body ?? data.body
    : data.body;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(displayBody);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-text-secondary">
        <ChannelIcon size={14} />
        <span className="text-[0.6875rem] font-medium uppercase tracking-wider font-[family-name:var(--font-mono)]">
          {CHANNEL_LABELS[data.channel]}
        </span>
      </div>

      {data.recipients.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[0.75rem] text-text-tertiary mr-1">To:</span>
          {data.recipients.map((r, i) => (
            <span
              key={i}
              className="inline-flex items-center px-2 py-0.5 bg-surface border border-border text-[0.75rem] text-text-secondary"
            >
              {r.name ?? r.address}
            </span>
          ))}
        </div>
      )}

      {data.subject && (
        <div className="border-b border-border pb-3">
          <p className="text-[0.6875rem] text-text-tertiary font-[family-name:var(--font-mono)] uppercase tracking-wider">Subject</p>
          <p className="text-[0.875rem] font-medium text-text-primary mt-0.5">
            {data.subject}
          </p>
        </div>
      )}

      {data.variants.length > 1 && (
        <div className="flex gap-px border-b border-border">
          {data.variants.map((variant) => (
            <button
              key={variant.id}
              onClick={() => setActiveVariant(variant.id)}
              className={`px-3 py-2 text-[0.75rem] font-medium transition-colors ${
                activeVariant === variant.id
                  ? "text-accent border-b-2 border-accent -mb-px"
                  : "text-text-secondary hover:text-text-primary"
              }`}
            >
              {variant.label}
            </button>
          ))}
        </div>
      )}

      <div className="relative border-l-[3px] border-accent pl-4 py-2">
        <pre className="text-[0.8125rem] text-text-primary leading-relaxed whitespace-pre-wrap font-[family-name:var(--font-body)] max-w-[65ch]">
          {displayBody}
        </pre>
        <button
          onClick={handleCopy}
          className="absolute top-2 right-0 p-1.5 text-text-tertiary hover:text-text-primary transition-colors"
          title="Copy to clipboard"
          aria-label="Copy draft to clipboard"
        >
          {copied ? (
            <Check size={14} className="text-success" aria-hidden="true" />
          ) : (
            <Copy size={14} aria-hidden="true" />
          )}
        </button>
      </div>
    </div>
  );
}
