import { NextResponse } from "next/server";
import { getStore } from "@/lib/db";

export async function GET(req: Request) {
  const days = Number(new URL(req.url).searchParams.get("days") ?? 30);
  try {
    const data = await getStore().dashboard({
      days: Number.isFinite(days) ? days : 30,
    });
    return NextResponse.json(data);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[api/dashboard] query failed:", message);
    return NextResponse.json({ error: message }, { status: 503 });
  }
}

export async function DELETE() {
  try {
    await getStore().reset();
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[api/dashboard] reset failed:", e);
    return NextResponse.json({ ok: false }, { status: 503 });
  }
}
