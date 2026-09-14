import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const sessionId = formData.get("sessionId");
  const index = formData.get("index");
  const blob = formData.get("blob");

  if (typeof sessionId !== "string" || typeof index !== "string" || !(blob instanceof Blob)) {
    return NextResponse.json({ error: "malformed chunk upload" }, { status: 400 });
  }

  console.log(`[stub] received chunk sessionId=${sessionId} index=${index} size=${blob.size}`);

  return NextResponse.json({ ok: true });
}