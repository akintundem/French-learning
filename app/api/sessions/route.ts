import { NextResponse } from "next/server";
import { getStore } from "@/lib/db";

export async function POST(req: Request) {
  const body = await req.json();
  const kind = body?.kind === "numbers" ? "numbers" : "vocab";
  try {
    const id = await getStore().startSession({
      kind,
      scope: String(body?.scope ?? "unknown"),
      direction: String(body?.direction ?? "n-a"),
    });
    return NextResponse.json({ id });
  } catch (e) {
    // Tracking is best-effort: a storage failure must not stop practice.
    console.error("[api/sessions] start failed:", e);
    return NextResponse.json({ id: null, error: "unavailable" }, { status: 503 });
  }
}

export async function PATCH(req: Request) {
  const body = await req.json();
  if (typeof body?.id !== "string")
    return NextResponse.json({ error: "id required" }, { status: 400 });
  try {
    await getStore().endSession(body.id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[api/sessions] end failed:", e);
    return NextResponse.json({ ok: false }, { status: 503 });
  }
}
