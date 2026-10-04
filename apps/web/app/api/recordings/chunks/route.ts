import { NextRequest, NextResponse } from "next/server";
import { uploadChunk } from '@/lib/storage'

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const sessionId = formData.get("sessionId");
  const index = formData.get("index");
  const blob = formData.get("blob");

  if (typeof sessionId !== "string" || typeof index !== "string" || !(blob instanceof Blob)) {
    return NextResponse.json({ error: "malformed chunk upload" }, { status: 400 });
  }

  try {
    const { key } = await uploadChunk(sessionId, Number(index), blob)
    return NextResponse.json({ok: true, key})
  } catch (err) {
    console.error(`failed to upload chunk sessionId=${sessionId} index=${index}`, err)
    return NextResponse.json({ error: "upload failed" }, {status: 500})
  }
}
