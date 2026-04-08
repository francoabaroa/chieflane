import { NextRequest, NextResponse } from "next/server";
import { savePushSubscription } from "@/lib/push";
import { z } from "zod";

const pushSubscriptionSchema = z.object({
  endpoint: z.string().min(1),
  expirationTime: z.number().nullable().optional(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
});

export async function POST(req: NextRequest) {
  let body: unknown;

  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const parsed = pushSubscriptionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "Invalid push subscription" },
      { status: 400 }
    );
  }

  savePushSubscription(parsed.data);
  return NextResponse.json({ ok: true });
}
