import { NextResponse } from "next/server";
import { getPushPublicKey } from "@/lib/push";

export async function GET() {
  const publicKey = getPushPublicKey();
  return NextResponse.json({
    enabled: Boolean(publicKey),
    publicKey,
  });
}
