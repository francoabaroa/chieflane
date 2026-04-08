import { defineCatalog } from "@json-render/core";
import { schema } from "@json-render/react/schema";
import { z } from "zod";

export const catalog = defineCatalog(schema, {
  components: {
    SectionCard: {
      props: z.object({
        title: z.string(),
        tone: z
          .enum(["neutral", "good", "warn", "critical"])
          .nullable()
          .default(null),
      }),
      slots: ["default"],
      description: "Card section for a shell surface",
    },

    MetricStrip: {
      props: z.object({
        items: z.array(z.object({ label: z.string(), value: z.string() })),
      }),
      description: "Compact metric row",
    },

    EvidenceList: {
      props: z.object({
        items: z.array(z.object({ label: z.string(), detail: z.string() })),
      }),
      description: "List of evidence or findings",
    },

    Checklist: {
      props: z.object({
        items: z.array(
          z.object({
            id: z.string(),
            label: z.string(),
            done: z.boolean(),
          })
        ),
      }),
      description: "Checklist block",
    },

    SourceList: {
      props: z.object({
        items: z.array(
          z.object({
            title: z.string(),
            subtitle: z.string().nullable().default(null),
            href: z.string().nullable().default(null),
          })
        ),
      }),
      description: "Human-readable source list with optional links",
    },

    TextBlock: {
      props: z.object({
        content: z.string(),
      }),
      description: "Longform analysis text",
    },

    ComparisonTable: {
      props: z.object({
        headers: z.array(z.string()),
        rows: z.array(z.array(z.string())),
      }),
      description: "Side-by-side comparison table",
    },

    QuoteBlock: {
      props: z.object({
        text: z.string(),
        attribution: z.string().nullable().default(null),
        source: z.string().nullable().default(null),
      }),
      description: "Highlighted quote with attribution",
    },

    StatusBanner: {
      props: z.object({
        message: z.string(),
        tone: z.enum(["neutral", "good", "warn", "critical"]),
      }),
      description: "Full-width status banner",
    },

    ActionButton: {
      props: z.object({
        label: z.string(),
        actionId: z.string(),
        variant: z
          .enum(["primary", "secondary", "ghost"])
          .default("secondary"),
      }),
      description: "Runs a shell action from inside a generative block",
    },

    TextField: {
      props: z.object({
        label: z.string(),
        name: z.string(),
        placeholder: z.string().nullable().default(null),
        value: z.unknown().optional(),
        checks: z
          .array(
            z.object({
              type: z.string(),
              message: z.string(),
              args: z.record(z.string(), z.unknown()).optional(),
            })
          )
          .default([]),
        validateOn: z.enum(["change", "blur", "submit"]).default("blur"),
      }),
      description: "Validated text input for compose and review surfaces",
    },
  },
  actions: {
    run_action: {
      params: z.object({ actionId: z.string() }),
      description: "Run a shell action",
    },
    navigate: {
      params: z.object({ route: z.string() }),
      description: "Navigate inside the shell",
    },
  },
  functions: {
    isValidEmail: {
      description: "Validate email formatting in compose surfaces",
    },
  },
});

export type SurfaceCatalog = typeof catalog;
