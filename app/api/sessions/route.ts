import { NextResponse } from "next/server";
import { getStore } from "@/lib/db";

export async function POST(req: Request) {
  const body = await req.json();
  const kind = body?.kind === "numbers" ? "numbers" : "vocab";
  const id = await getStore().startSession({
    kind,
    scope: String(body?.scope ?? "unknown"),
    direction: String(body?.direction ?? "n-a"),
  });
  return NextResponse.json({ id });
}

export async function PATCH(req: Request) {
  const body = await req.json();
  if (typeof body?.id !== "string")
    return NextResponse.json({ error: "id required" }, { status: 400 });
  await getStore().endSession(body.id);
  return NextResponse.json({ ok: true });
}
