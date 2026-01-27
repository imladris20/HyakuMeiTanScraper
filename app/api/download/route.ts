import { NextRequest, NextResponse } from "next/server";

import * as fs from "fs";
import * as path from "path";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const pref = request.nextUrl.searchParams.get("pref");

  if (!pref) {
    return NextResponse.json({ message: "缺少 pref 參數" }, { status: 400 });
  }

  const fileName = `${pref}_hyakumeiten.csv`;
  const filePath = path.join(process.cwd(), "output", fileName);

  if (!fs.existsSync(filePath)) {
    return NextResponse.json(
      { message: "找不到對應的 CSV 檔案，請先執行爬蟲。" },
      { status: 404 }
    );
  }

  const fileBuffer = fs.readFileSync(filePath);

  return new NextResponse(fileBuffer, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${fileName}"`,
    },
  });
}
