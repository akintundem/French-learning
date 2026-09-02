import { NextResponse } from "next/server";
import { getStore } from "@/lib/db";

export async function GET(req: Request) {
  const days = Number(new URL(req.url).searchParams.get("days") ?? 30);
  const data = await getStore().dashboard({ days: Number.isFinite(days) ? days : 30 });
  return NextResponse.json(data);
}

export async function DELETE() {
  await getStore().reset();
  return NextResponse.json({ ok: true });
}
