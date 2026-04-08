"use client";

import { useRef } from "react";
import {
  JSONUIProvider,
  Renderer,
  createStateStore,
  defineRegistry,
  useBoundProp,
  useFieldValidation,
} from "@json-render/react";
import { catalog } from "@chieflane/surface-catalog";
import { getSafeExternalHref, isValidEmail } from "@chieflane/shared";

type BlocksRendererProps = {
  spec: unknown;
  state?: Record<string, unknown>;
  onAction: (
    actionId: string,
    blockInput?: Record<string, unknown>
  ) => void | Promise<void>;
  onNavigate: (route: string) => void | Promise<void>;
};

type FlatSpec = {
  root: string | null;
  elements: Record<
    string,
    {
      type: string;
      props?: Record<string, unknown>;
      children?: string[];
      on?: Record<string, unknown>;
      visible?: unknown;
      repeat?: unknown;
    }
  >;
  state?: Record<string, unknown>;
};

function getStateStoreKey(state: Record<string, unknown>): string {
  const surfaceId =
    typeof state.surfaceId === "string" ? state.surfaceId : null;
  const surfaceVersion =
    typeof state.surfaceVersion === "number"
      ? state.surfaceVersion
      : typeof state.version === "number"
        ? state.version
        : null;

  if (surfaceId) {
    return surfaceVersion === null
      ? surfaceId
      : `${surfaceId}:${surfaceVersion}`;
  }

  return JSON.stringify(state);
}

const toneStyles: Record<string, string> = {
  neutral: "border-border bg-surface text-text-primary",
  good: "border-success/30 bg-success/[0.03] text-text-primary",
  warn: "border-warning/30 bg-warning/[0.03] text-text-primary",
  critical: "border-critical/30 bg-critical/[0.03] text-text-primary",
};

const actionVariants: Record<string, string> = {
  primary:
    "bg-accent text-base hover:bg-accent-hover",
  secondary:
    "border border-border bg-surface text-text-primary hover:bg-surface-hover",
  ghost: "text-text-secondary hover:bg-surface hover:text-text-primary",
};

const { registry } = defineRegistry(catalog, {
  components: {
    SectionCard: ({ props, children }) => (
      <section
        className={`rounded-xl border p-4 ${toneStyles[props.tone ?? "neutral"]}`}
      >
        <h3 className="text-sm font-semibold text-text-primary">
          {props.title}
        </h3>
        <div className="mt-2 space-y-2">{children}</div>
      </section>
    ),

    MetricStrip: ({ props }) => (
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        {props.items.map((item) => (
          <div
            key={item.label}
            className="rounded-xl border border-border bg-surface p-3"
          >
            <p className="text-[10px] uppercase tracking-wider text-text-tertiary">
              {item.label}
            </p>
            <p className="mt-1 text-lg font-semibold text-text-primary">
              {item.value}
            </p>
          </div>
        ))}
      </div>
    ),

    EvidenceList: ({ props }) => (
      <div className="rounded-xl border border-border bg-surface">
        {props.items.map((item, index) => (
          <div
            key={`${item.label}-${index}`}
            className="border-b border-border/50 px-4 py-3 last:border-b-0"
          >
            <p className="text-xs uppercase tracking-wider text-text-tertiary">
              {item.label}
            </p>
            <p className="mt-1 text-sm leading-relaxed text-text-secondary">
              {item.detail}
            </p>
          </div>
        ))}
      </div>
    ),

    Checklist: ({ props }) => (
      <div className="space-y-2 rounded-xl border border-border bg-surface p-4">
        {props.items.map((item) => (
          <label
            key={item.id}
            className="flex items-center gap-3 text-sm text-text-primary"
          >
            <input
              type="checkbox"
              checked={item.done}
              readOnly
              className="h-4 w-4 rounded border-border bg-base text-accent"
            />
            <span className={item.done ? "line-through text-text-tertiary" : ""}>
              {item.label}
            </span>
          </label>
        ))}
      </div>
    ),

    SourceList: ({ props }) => (
      <div className="rounded-xl border border-border bg-surface p-4">
        <div className="space-y-3">
          {props.items.map((item, index) => {
            const safeHref = getSafeExternalHref(item.href);
            return (
              <div key={`${item.title}-${index}`}>
                {safeHref ? (
                  <a
                    href={safeHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-medium text-accent hover:underline"
                  >
                    {item.title}
                  </a>
                ) : (
                  <p className="text-sm font-medium text-text-primary">
                    {item.title}
                  </p>
                )}
                {item.subtitle ? (
                  <p className="text-xs text-text-secondary">{item.subtitle}</p>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    ),

    TextBlock: ({ props }) => (
      <div className="rounded-xl border border-border bg-surface p-4">
        <p className="text-sm leading-relaxed text-text-secondary">
          {props.content}
        </p>
      </div>
    ),

    ComparisonTable: ({ props }) => (
      <div className="overflow-hidden rounded-xl border border-border bg-surface">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-border text-left">
            <thead className="bg-elevated/80">
              <tr>
                {props.headers.map((header) => (
                  <th
                    key={header}
                    className="px-4 py-3 text-[10px] uppercase tracking-wider text-text-tertiary"
                  >
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {props.rows.map((row, rowIndex) => (
                <tr key={rowIndex}>
                  {row.map((cell, cellIndex) => (
                    <td
                      key={`${rowIndex}-${cellIndex}`}
                      className="px-4 py-3 text-sm text-text-secondary"
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    ),

    QuoteBlock: ({ props }) => (
      <blockquote className="rounded-xl border border-border bg-surface p-4">
        <p className="text-base leading-relaxed text-text-primary">
          “{props.text}”
        </p>
        {(props.attribution || props.source) && (
          <footer className="mt-3 text-xs text-text-tertiary">
            {[props.attribution, props.source].filter(Boolean).join(" · ")}
          </footer>
        )}
      </blockquote>
    ),

    StatusBanner: ({ props }) => (
      <div
        className={`rounded-xl border px-4 py-3 text-sm ${toneStyles[props.tone]}`}
      >
        {props.message}
      </div>
    ),

    ActionButton: ({ props, on }) => {
      const press = on("press");
      return (
        <button
          type="button"
          onClick={() => press.emit()}
          className={`inline-flex items-center rounded-lg px-4 py-2 text-sm font-medium transition-colors ${actionVariants[props.variant ?? "secondary"]}`}
        >
          {props.label}
        </button>
      );
    },

    TextField: ({ props, bindings }) => {
      const [value, setValue] = useBoundProp<string>(
        typeof props.value === "string" ? props.value : "",
        bindings?.value
      );
      const validation = useFieldValidation(
        bindings?.value ?? `/blocks/${props.name}`,
        {
          checks: props.checks,
          validateOn: props.validateOn,
        }
      );

      return (
        <label className="block space-y-2">
          <span className="text-xs font-medium uppercase tracking-wider text-text-tertiary">
            {props.label}
          </span>
          <input
            value={value ?? ""}
            onChange={(event) => {
              setValue(event.target.value);
              validation.touch();
              if (props.validateOn === "change") {
                void validation.validate();
              }
            }}
            onBlur={() => {
              validation.touch();
              if (props.validateOn !== "submit") {
                void validation.validate();
              }
            }}
            placeholder={props.placeholder ?? ""}
            className="w-full rounded-xl border border-border bg-base px-3 py-2.5 text-sm text-text-primary outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20"
          />
          {validation.errors.length > 0 && (
            <div className="space-y-1">
              {validation.errors.map((error, index) => (
                <p key={index} className="text-xs text-critical">
                  {error}
                </p>
              ))}
            </div>
          )}
        </label>
      );
    },
  },
  actions: {
    run_action: async (params) => {
      await Promise.resolve(params?.actionId);
    },
    navigate: async (params) => {
      await Promise.resolve(params?.route);
    },
  },
});

function isFlatSpec(spec: unknown): spec is FlatSpec {
  return Boolean(
    spec &&
      typeof spec === "object" &&
      "root" in spec &&
      "elements" in spec
  );
}

function normalizeBlocksSpec(spec: unknown): FlatSpec | null {
  if (!spec || typeof spec !== "object") {
    return null;
  }

  if (isFlatSpec(spec)) {
    return spec;
  }

  let counter = 0;
  const elements: FlatSpec["elements"] = {};

  const buildNode = (node: unknown): string => {
    if (!node || typeof node !== "object" || !("type" in node)) {
      throw new Error("Invalid block spec node");
    }

    const element = node as {
      type: string;
      props?: Record<string, unknown>;
      children?: unknown[];
      on?: Record<string, unknown>;
      visible?: unknown;
      repeat?: unknown;
    };

    const id = `block-${counter += 1}`;
    const childIds = Array.isArray(element.children)
      ? element.children.map(buildNode)
      : [];

    elements[id] = {
      type: element.type,
      props: element.props ?? {},
      children: childIds,
      on: element.on,
      visible: element.visible,
      repeat: element.repeat,
    };

    return id;
  };

  return {
    root: buildNode(spec),
    elements,
  };
}

export function SurfaceBlocksRenderer({
  spec,
  state = {},
  onAction,
  onNavigate,
}: BlocksRendererProps) {
  const storeKey = getStateStoreKey(state);
  const storeRef = useRef<{
    key: string;
    store: ReturnType<typeof createStateStore>;
  } | null>(null);

  if (!storeRef.current || storeRef.current.key !== storeKey) {
    storeRef.current = {
      key: storeKey,
      // Reset interactive block state when a surface is patched in place.
      store: createStateStore(state),
    };
  }

  const store = storeRef.current.store;
  let normalizedSpec: FlatSpec | null = null;

  try {
    normalizedSpec = normalizeBlocksSpec(spec);
  } catch (error) {
    console.error("Invalid surface block spec", error);
    return null;
  }

  if (!normalizedSpec) {
    return null;
  }

  return (
    <JSONUIProvider
      registry={registry}
      store={store}
      validationFunctions={{ isValidEmail }}
      handlers={{
        run_action: async (params) => {
          const actionId =
            typeof params.actionId === "string" ? params.actionId : null;
          if (actionId) {
            await onAction(actionId, store.getSnapshot());
          }
        },
        navigate: async (params) => {
          const route =
            typeof params.route === "string" ? params.route : null;
          if (route) {
            await onNavigate(route);
          }
        },
      }}
    >
      <div className="space-y-4">
        <Renderer spec={normalizedSpec as any} registry={registry} />
      </div>
    </JSONUIProvider>
  );
}

export type SurfaceBlocksRendererProps = BlocksRendererProps;
