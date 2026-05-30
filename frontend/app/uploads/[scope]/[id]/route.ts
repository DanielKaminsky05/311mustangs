import fs from "node:fs/promises";
import { NextResponse } from "next/server";
import {
  getAttachmentById,
  resolveAbsolutePath,
} from "../../../_server/uploads";

export async function GET(
  _request: Request,
  ctx: { params: Promise<{ scope: string; id: string }> },
) {
  const { scope, id } = await ctx.params;
  if (!["temp", "req"].includes(scope)) {
    return NextResponse.json({ error: "invalid_scope" }, { status: 400 });
  }
  const record = await getAttachmentById(id);
  if (!record || record.storage_scope !== scope) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  try {
    const buf = await fs.readFile(resolveAbsolutePath(record));
    return new NextResponse(new Uint8Array(buf), {
      status: 200,
      headers: {
        "Content-Type": record.mime_type,
        "Content-Disposition": `inline; filename="${record.display_name.replace(/"/g, "")}"`,
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch {
    return NextResponse.json({ error: "read_failed" }, { status: 500 });
  }
}
